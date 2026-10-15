import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { actorId, action, entity, payload } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: actor } = await adminSupabase.from("profiles").select("*").eq("id", actorId).single();
    if (!actor) return NextResponse.json({ error: "Unauthorized actor." }, { status: 403 });

    const logAudit = async (act: string, ent: string, entId: string, summary: string, snapshot: any) => {
      await adminSupabase.from("audit_logs").insert([{
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: act,
        entity_type: ent,
        entity_id: entId,
        summary,
        record_snapshot: snapshot || {}
      }]);
    };

    if (entity === "audit" && action === "restore") {
      if (actor.role !== "admin") return NextResponse.json({ error: "Only Admins can restore archived records." }, { status: 403 });
      const { logId } = payload;
      const { data: logEntry } = await adminSupabase.from("audit_logs").select("*").eq("id", logId).single();
      if (!logEntry || !logEntry.record_snapshot) {
        return NextResponse.json({ error: "Archive snapshot not found." }, { status: 404 });
      }

      const snap = logEntry.record_snapshot.before || logEntry.record_snapshot;
      if (logEntry.entity_type === "ASSET") {
        const { error } = await adminSupabase.from("social_assets").upsert([snap]);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("RESTORE", "ASSET", snap.id, `Restored Asset [${(snap.platform || "").toUpperCase()}] ${snap.account_id} from Archive Vault`, snap);
        return NextResponse.json({ success: true });
      }

      if (logEntry.entity_type === "METRIC") {
        const { error } = await adminSupabase.from("weekly_metrics").upsert([snap]);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("RESTORE", "METRIC", snap.id, `Restored Weekly Metric (${snap.week_of}) from Archive Vault`, snap);
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "This entity type cannot be auto-restored." }, { status: 400 });
    }

    if (entity === "profile") {
      if (action === "create") {
        if (actor.role === "smm") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        const targetRole = actor.role === "team_leader" ? "smm" : (payload.role || "smm");
        const roleTag = targetRole === "team_leader" ? "tl" : targetRole === "admin" ? "admin" : "smm";
        const normEmail = normalizeAuthUsername(payload.email, roleTag);

        const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: normEmail,
          password: payload.password,
          email_confirm: true
        });
        if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

        const tlId = actor.role === "team_leader" ? actor.id : (payload.team_leader_id || null);
        const tlIds = actor.role === "team_leader" ? [actor.id] : (payload.team_leader_ids || (tlId ? [tlId] : []));

        const profileRecord = {
          id: authData.user.id,
          role: targetRole,
          full_name: payload.full_name,
          country: payload.country || "Ethiopia",
          team_leader_id: targetRole === "smm" ? tlId : null,
          team_leader_ids: targetRole === "smm" ? tlIds : [],
          platforms: payload.platforms || ["twitter"]
        };

        const { error: profErr } = await adminSupabase.from("profiles").insert([profileRecord]);
        if (profErr) {
          await adminSupabase.auth.admin.deleteUser(authData.user.id);
          return NextResponse.json({ error: profErr.message }, { status: 400 });
        }

        await logAudit("CREATE", "EMPLOYEE", authData.user.id, `Created ${targetRole.toUpperCase()} employee: ${payload.full_name} (${formatDisplayUsername(normEmail)})`, { ...profileRecord, username: formatDisplayUsername(normEmail) });
        return NextResponse.json({ success: true });
      }

      if (action === "bulk_create") {
        if (actor.role === "smm") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        const rows = payload.rows || [];
        let createdCount = 0;
        const errors: string[] = [];

        for (const r of rows) {
          const roleToUse = actor.role === "team_leader" ? "smm" : (r.role || "smm");
          const rTag = roleToUse === "team_leader" ? "tl" : roleToUse === "admin" ? "admin" : "smm";
          const normEmail = normalizeAuthUsername(r.email, rTag);

          const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
            email: normEmail,
            password: r.password || "Welcome@2026!",
            email_confirm: true
          });
          if (authErr || !authData?.user) {
            errors.push(`${r.email}: ${authErr?.message || "Failed"}`);
            continue;
          }
          const tlId = actor.role === "team_leader" ? actor.id : (r.team_leader_id || null);
          const profRec = {
            id: authData.user.id,
            role: roleToUse,
            full_name: r.full_name,
            country: r.country || "Ethiopia",
            team_leader_id: roleToUse === "smm" ? tlId : null,
            team_leader_ids: roleToUse === "smm" && tlId ? [tlId] : [],
            platforms: r.platforms || ["twitter"]
          };
          const { error: pErr } = await adminSupabase.from("profiles").insert([profRec]);
          if (!pErr) {
            createdCount++;
            await logAudit("BULK_CREATE", "EMPLOYEE", authData.user.id, `Bulk onboarded ${roleToUse.toUpperCase()}: ${r.full_name} (${formatDisplayUsername(normEmail)})`, { ...profRec, username: formatDisplayUsername(normEmail) });
          } else {
            await adminSupabase.auth.admin.deleteUser(authData.user.id);
            errors.push(`${r.email}: ${pErr.message}`);
          }
        }
        return NextResponse.json({ success: true, createdCount, errors });
      }

      if (action === "update") {
        const { targetId, full_name, country, role, team_leader_id, team_leader_ids, platforms, is_locked, newPassword } = payload;
        if (actor.role === "smm" && actor.id !== targetId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

        const { data: before } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        const updateObj: any = {};
        if (full_name !== undefined) updateObj.full_name = full_name;
        if (country !== undefined) updateObj.country = country;
        if (platforms !== undefined) updateObj.platforms = platforms;
        if (is_locked !== undefined && actor.role !== "smm") updateObj.is_locked = is_locked;
        if (actor.role === "admin") {
          if (role !== undefined) updateObj.role = role;
          if (team_leader_ids !== undefined) {
            updateObj.team_leader_ids = team_leader_ids;
            updateObj.team_leader_id = team_leader_ids[0] || null;
          } else if (team_leader_id !== undefined) {
            updateObj.team_leader_id = team_leader_id || null;
            updateObj.team_leader_ids = team_leader_id ? [team_leader_id] : [];
          }
        }

        const { error } = await adminSupabase.from("profiles").update(updateObj).eq("id", targetId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        if (newPassword && newPassword.trim().length >= 6 && (actor.role === "admin" || actor.id === targetId)) {
          await adminSupabase.auth.admin.updateUserById(targetId, { password: newPassword.trim() });
        }

        await logAudit("UPDATE", "EMPLOYEE", targetId, `Updated employee profile: ${full_name || before?.full_name}`, { before, after: updateObj });
        return NextResponse.json({ success: true });
      }

      if (action === "remove_from_squad") {
        const { targetId, tlId } = payload;
        const { data: smm } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        if (!smm) return NextResponse.json({ error: "SMM not found." }, { status: 404 });

        const updatedIds = (smm.team_leader_ids || []).filter((id: string) => id !== tlId);
        const nextPrimary = updatedIds.length > 0 ? updatedIds[0] : null;
        await adminSupabase.from("profiles").update({
          team_leader_id: smm.team_leader_id === tlId ? nextPrimary : smm.team_leader_id,
          team_leader_ids: updatedIds
        }).eq("id", targetId);

        await logAudit("DETACH_SQUAD", "EMPLOYEE", targetId, `Removed SMM ${smm.full_name} from squad`, smm);
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        if (actor.role !== "admin") return NextResponse.json({ error: "Only Admins can permanently delete personnel." }, { status: 403 });
        const { targetId } = payload;
        const { data: oldProf } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        const { error } = await adminSupabase.auth.admin.deleteUser(targetId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        await logAudit("DELETE", "EMPLOYEE", targetId, `Permanently deleted employee: ${oldProf?.full_name || targetId}`, oldProf);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "asset") {
      if (action === "create") {
        const { data: created, error } = await adminSupabase.from("social_assets").insert([payload]).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("CREATE", "ASSET", created.id, `Created [${created.platform.toUpperCase()}] Asset: ${created.account_id}`, created);
        return NextResponse.json({ success: true, asset: created });
      }

      if (action === "bulk_create") {
        const items = payload.items || [];
        if (items.length === 0) return NextResponse.json({ error: "No assets provided." }, { status: 400 });
        const { data: inserted, error } = await adminSupabase.from("social_assets").insert(items).select();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        await logAudit("BULK_CREATE", "ASSET", "BULK", `Bulk registered ${inserted?.length || 0} Social Media Assets`, { count: inserted?.length, sample: inserted?.slice(0, 20) });
        return NextResponse.json({ success: true, count: inserted?.length || 0 });
      }

      if (action === "update") {
        const { id, ...updateFields } = payload;
        const { data: before } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        const { data: after, error } = await adminSupabase.from("social_assets").update(updateFields).eq("id", id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        const statusChanged = before?.status !== after?.status;
        const summaryText = statusChanged
          ? `Marked Asset [${after.platform.toUpperCase()}] ${after.account_id} as ${after.status.toUpperCase()}`
          : `Updated Asset [${after.platform.toUpperCase()}] ${after.account_id}`;

        await logAudit("UPDATE", "ASSET", id, summaryText, { before, after });
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { id } = payload;
        const { data: oldAsset } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        const { error } = await adminSupabase.from("social_assets").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        await logAudit("DELETE", "ASSET", id, `Deleted Asset [${oldAsset?.platform?.toUpperCase()}] ${oldAsset?.account_id}`, oldAsset);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "metric") {
      if (actor.role === "smm" && actor.is_locked) {
        return NextResponse.json({ error: "Weekly metric input is locked by your Team Leader." }, { status: 403 });
      }

      if (action === "upsert") {
        const { data: saved, error } = await adminSupabase.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPSERT", "METRIC", saved.id, `Logged weekly metrics for week ${payload.week_of}`, saved);
        return NextResponse.json({ success: true });
      }

      if (action === "update") {
        const { id, ...fields } = payload;
        const { data: after, error } = await adminSupabase.from("weekly_metrics").update(fields).eq("id", id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPDATE", "METRIC", id, `Updated weekly metric record (${after?.week_of})`, after);
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { id } = payload;
        const { data: oldMetric } = await adminSupabase.from("weekly_metrics").select("*").eq("id", id).single();
        const { error } = await adminSupabase.from("weekly_metrics").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("DELETE", "METRIC", id, `Deleted weekly metric log (${oldMetric?.week_of})`, oldMetric);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid CRUD operation." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
