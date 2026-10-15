import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    const { data: logs, error } = await adminSupabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500);

    if (!error && logs && logs.length > 0) {
      return NextResponse.json({ logs });
    }

    // Fallback + Auto-Seed: Build complete Archive Vault entries from profiles, social_assets, and weekly_metrics
    const [{ data: profs }, { data: assets }, { data: metrics }] = await Promise.all([
      adminSupabase.from("profiles").select("*").order("created_at", { ascending: false }),
      adminSupabase.from("social_assets").select("*").order("created_at", { ascending: false }),
      adminSupabase.from("weekly_metrics").select("*").order("week_of", { ascending: false }).limit(300),
    ]);

    const synthetic: any[] = [];
    for (const p of profs || []) {
      synthetic.push({
        id: `emp-${p.id}`,
        created_at: p.created_at || new Date().toISOString(),
        actor_id: p.id,
        actor_name: p.full_name || "System Archive",
        actor_role: p.role || "admin",
        action: "CREATE",
        entity_type: "EMPLOYEE",
        entity_id: p.id,
        summary: `Registered ${String(p.role || "smm").toUpperCase()}: ${p.full_name} (${p.country || "Global"})`,
        record_snapshot: p,
      });
    }
    for (const a of assets || []) {
      synthetic.push({
        id: `ast-${a.id}`,
        created_at: a.created_at || new Date().toISOString(),
        actor_id: a.smm_id,
        actor_name: "Asset Vault",
        actor_role: "smm",
        action: "CREATE",
        entity_type: "ASSET",
        entity_id: a.id,
        summary: `Vaulted Asset: [${(a.platform || "").toUpperCase()}] ${a.account_id} (${a.country_language || "Global"} • ${a.language || "English"})`,
        record_snapshot: a,
      });
    }
    for (const m of metrics || []) {
      synthetic.push({
        id: `met-${m.id}`,
        created_at: m.created_at || `${m.week_of}T12:00:00Z`,
        actor_id: m.asset_id,
        actor_name: "Weekly Ledger",
        actor_role: "smm",
        action: "UPSERT",
        entity_type: "METRIC",
        entity_id: m.id,
        summary: `Weekly Metric (${m.week_of}): ${(m.impressions || 0).toLocaleString()} Impr, ${(m.engagements || 0).toLocaleString()} Eng`,
        record_snapshot: m,
      });
    }

    // Attempt to seed into audit_logs if table exists
    if (!error && synthetic.length > 0) {
      await adminSupabase.from("audit_logs").insert(
        synthetic.map(({ id, ...rest }) => rest)
      );
    }

    return NextResponse.json({ logs: synthetic });
  } catch (err: any) {
    return NextResponse.json({ logs: [], error: err.message }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { actorId, action, entity, payload } = await request.json();
    const adminSupabase = getAdminClient();

    const { data: actor } = await adminSupabase.from("profiles").select("*").eq("id", actorId).single();
    if (!actor) return NextResponse.json({ error: "Unauthorized actor." }, { status: 403 });

    const logAudit = async (act: string, ent: string, entId: string, summary: string, snapshot: any) => {
      try {
        await adminSupabase.from("audit_logs").insert([
          {
            actor_id: actor.id,
            actor_name: actor.full_name,
            actor_role: actor.role,
            action: act,
            entity_type: ent,
            entity_id: entId,
            summary,
            record_snapshot: snapshot || {},
          },
        ]);
      } catch {
        // Ignore if audit_logs table is not yet migrated
      }
    };

    if (entity === "campaign" && action === "dispatch") {
      const { platforms, targetMode, targetTlIds, targetSmmIds, topic, direction } = payload;
      const [{ data: allAssets }, { data: allProfiles }] = await Promise.all([
        adminSupabase.from("social_assets").select("*"),
        adminSupabase.from("profiles").select("*"),
      ]);

      const matchingIds = (allAssets || [])
        .filter((a: any) => {
          if (platforms?.length && !platforms.includes(a.platform)) return false;
          if (targetMode === "tl") {
            const smm = (allProfiles || []).find((p: any) => p.id === a.smm_id);
            const smmTls = smm?.team_leader_ids || (smm?.team_leader_id ? [smm.team_leader_id] : []);
            return targetTlIds.includes(a.team_leader_id) || targetTlIds.some((id: string) => smmTls.includes(id));
          }
          return targetSmmIds.includes(a.smm_id);
        })
        .map((a: any) => a.id);

      if (matchingIds.length > 0) {
        await adminSupabase
          .from("social_assets")
          .update({
            project_name: topic,
            tl_campaign: topic,
            tl_task: direction,
            tl_comment: `Dispatched by ${actor.full_name} (${new Date().toLocaleDateString()})`,
          })
          .in("id", matchingIds);
      }

      await logAudit(
        "CREATE",
        "ASSET",
        "CAMPAIGN",
        `Dispatched Campaign "${topic}" (${(platforms || []).join(", ").toUpperCase()}) to ${matchingIds.length} Assets`,
        payload
      );
      return NextResponse.json({ success: true, count: matchingIds.length });
    }

    if (entity === "audit" && action === "restore") {
      const { snapshot, entityType } = payload;
      if (!snapshot) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      const tbl = entityType === "ASSET" ? "social_assets" : entityType === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      await adminSupabase.from(tbl).upsert([snapshot]);
      await logAudit("RESTORE", entityType || "ASSET", snapshot.id, `Restored ${entityType} from Archive Vault`, snapshot);
      return NextResponse.json({ success: true });
    }

    if (entity === "profile") {
      if (action === "create") {
        const targetRole = actor.role === "team_leader" ? "smm" : payload.role || "smm";
        const roleTag = targetRole === "team_leader" ? "tl" : targetRole === "admin" ? "admin" : "smm";
        const normEmail = normalizeAuthUsername(payload.email, roleTag);
        const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: normEmail,
          password: payload.password,
          email_confirm: true,
        });
        if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

        const tlId = actor.role === "team_leader" ? actor.id : payload.team_leader_id || null;
        const tlIds = actor.role === "team_leader" ? [actor.id] : payload.team_leader_ids || (tlId ? [tlId] : []);
        const rec = {
          id: authData.user.id,
          role: targetRole,
          full_name: payload.full_name,
          country: payload.country || "Kenya",
          team_leader_id: targetRole === "smm" ? tlId : null,
          team_leader_ids: targetRole === "smm" ? tlIds : [],
          platforms: payload.platforms || ["twitter"],
        };
        const { error: pErr } = await adminSupabase.from("profiles").insert([rec]);
        if (pErr) {
          await adminSupabase.auth.admin.deleteUser(authData.user.id);
          return NextResponse.json({ error: pErr.message }, { status: 400 });
        }
        await logAudit("CREATE", "EMPLOYEE", rec.id, `Created ${targetRole.toUpperCase()}: ${rec.full_name} (${formatDisplayUsername(normEmail)})`, rec);
        return NextResponse.json({ success: true });
      }

      if (action === "update") {
        const {
          targetId,
          full_name,
          country,
          role,
          team_leader_id,
          team_leader_ids,
          platforms,
          is_locked,
          newPassword,
          assignedSmmIds,
          assignedAssetIds,
        } = payload;
        const { data: before } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        const upd: any = {};
        if (full_name !== undefined) upd.full_name = full_name;
        if (country !== undefined) upd.country = country;
        if (platforms !== undefined) upd.platforms = platforms;
        if (is_locked !== undefined && actor.role !== "smm") upd.is_locked = is_locked;
        if (team_leader_ids !== undefined) {
          upd.team_leader_ids = team_leader_ids;
          upd.team_leader_id = team_leader_ids[0] || null;
        } else if (team_leader_id !== undefined) {
          upd.team_leader_id = team_leader_id || null;
          upd.team_leader_ids = team_leader_id ? [team_leader_id] : [];
        }
        if (actor.role === "admin" && role !== undefined) upd.role = role;

        await adminSupabase.from("profiles").update(upd).eq("id", targetId);

        // When Admin edits a Team Leader's assigned SMM squad members
        if (actor.role === "admin" && Array.isArray(assignedSmmIds)) {
          const { data: allSmms } = await adminSupabase.from("profiles").select("*").eq("role", "smm");
          for (const smm of allSmms || []) {
            const curTls: string[] = smm.team_leader_ids || (smm.team_leader_id ? [smm.team_leader_id] : []);
            const shouldHave = assignedSmmIds.includes(smm.id);
            const has = curTls.includes(targetId);
            if (shouldHave && !has) {
              const next = [...curTls, targetId];
              await adminSupabase.from("profiles").update({ team_leader_id: smm.team_leader_id || targetId, team_leader_ids: next }).eq("id", smm.id);
            } else if (!shouldHave && has) {
              const next = curTls.filter((id) => id !== targetId);
              await adminSupabase
                .from("profiles")
                .update({ team_leader_id: smm.team_leader_id === targetId ? next[0] || null : smm.team_leader_id, team_leader_ids: next })
                .eq("id", smm.id);
            }
          }
        }

        // When Admin or TL edits an SMM's assigned Social Media Assets
        if ((actor.role === "admin" || actor.role === "team_leader") && Array.isArray(assignedAssetIds)) {
          if (assignedAssetIds.length > 0) {
            await adminSupabase.from("social_assets").update({ smm_id: targetId }).in("id", assignedAssetIds);
          }
          const { data: prev } = await adminSupabase.from("social_assets").select("id").eq("smm_id", targetId);
          const detach = (prev || []).map((a: any) => a.id).filter((id: string) => !assignedAssetIds.includes(id));
          if (detach.length > 0) {
            await adminSupabase.from("social_assets").update({ smm_id: null }).in("id", detach);
          }
        }

        if (newPassword && newPassword.trim().length >= 6) {
          await adminSupabase.auth.admin.updateUserById(targetId, { password: newPassword.trim() });
        }
        await logAudit("UPDATE", "EMPLOYEE", targetId, `Updated profile: ${full_name || before?.full_name}`, { before, after: upd });
        return NextResponse.json({ success: true });
      }

      if (action === "batch_lock") {
        const { smmIds, is_locked } = payload;
        let q = adminSupabase.from("profiles").update({ is_locked }).eq("role", "smm");
        if (Array.isArray(smmIds) && smmIds.length > 0) q = q.in("id", smmIds);
        await q;
        await logAudit("BATCH_LOCK", "EMPLOYEE", "SQUAD", `${is_locked ? "Locked" : "Unlocked"} SMM metric inputs`, payload);
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { targetId } = payload;
        const { data: oldProf } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        await adminSupabase.from("profiles").delete().eq("id", targetId);
        await adminSupabase.auth.admin.deleteUser(targetId);
        await logAudit("DELETE", "EMPLOYEE", targetId, `Deleted employee: ${oldProf?.full_name || targetId}`, oldProf);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "asset") {
      if (action === "create") {
        const { language, ...dbPayload } = payload;
        let { data: created, error } = await adminSupabase
          .from("social_assets")
          .insert([{ ...dbPayload, ...(language ? { language } : {}) }])
          .select()
          .single();
        // Fallback if 'language' column isn't added in DB yet
        if (error && error.message?.includes("language")) {
          const retry = await adminSupabase.from("social_assets").insert([dbPayload]).select().single();
          created = retry.data;
          error = retry.error;
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("CREATE", "ASSET", created.id, `Created [${created.platform.toUpperCase()}] ${created.account_id}`, created);
        return NextResponse.json({ success: true, asset: created });
      }
      if (action === "bulk_create") {
        let { data: ins, error } = await adminSupabase.from("social_assets").insert(payload.items || []).select();
        if (error && error.message?.includes("language")) {
          const stripped = (payload.items || []).map(({ language, ...rest }: any) => rest);
          const retry = await adminSupabase.from("social_assets").insert(stripped).select();
          ins = retry.data;
          error = retry.error;
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("BULK_CREATE", "ASSET", "BULK", `Bulk registered ${ins?.length || 0} Assets`, { count: ins?.length });
        return NextResponse.json({ success: true, count: ins?.length || 0 });
      }
      if (action === "update") {
        const { id, created_at, ...fields } = payload;
        const { data: before } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        let { data: after, error } = await adminSupabase.from("social_assets").update(fields).eq("id", id).select().single();
        if (error && error.message?.includes("language")) {
          const { language, ...safeFields } = fields;
          const retry = await adminSupabase.from("social_assets").update(safeFields).eq("id", id).select().single();
          after = retry.data;
          error = retry.error;
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPDATE", "ASSET", id, `Updated Asset [${after.platform.toUpperCase()}] ${after.account_id}`, { before, after });
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        const { id } = payload;
        const { data: oldA } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        await adminSupabase.from("social_assets").delete().eq("id", id);
        await logAudit("DELETE", "ASSET", id, `Deleted Asset [${oldA?.platform?.toUpperCase()}] ${oldA?.account_id}`, oldA);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "metric") {
      if (actor.role === "smm" && actor.is_locked) return NextResponse.json({ error: "Locked by Team Leader." }, { status: 403 });
      if (action === "upsert") {
        const { data: saved, error } = await adminSupabase.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPSERT", "METRIC", saved.id, `Logged weekly metrics (${payload.week_of})`, saved);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        const { id } = payload;
        const { data: oldM } = await adminSupabase.from("weekly_metrics").select("*").eq("id", id).single();
        await adminSupabase.from("weekly_metrics").delete().eq("id", id);
        await logAudit("DELETE", "METRIC", id, `Deleted weekly metric (${oldM?.week_of})`, oldM);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid CRUD operation." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
