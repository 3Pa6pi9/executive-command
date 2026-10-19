import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET() {
  try {
    const db = getDb();
    const [{ data: logsRaw }, { data: profs }, { data: assets }, { data: authList }] = await Promise.all([
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1500),
      db.from("profiles").select("*"),
      db.from("social_assets").select("*"),
      db.auth.admin.listUsers({ perPage: 1000 })
    ]);

    const passwords: Record<string, string> = {};
    const emails: Record<string, string> = {};
    const authMap = new Map((authList?.users || []).map((u: any) => [u.id, u]));

    for (const p of profs || []) {
      const au: any = authMap.get(p.id);
      const first = (p.full_name || "User").trim().split(/\s+/)[0];
      const defPass =
        p.role === "admin"
          ? "Admin@2026!"
          : p.role === "team_leader"
          ? `${first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()}@2026!`
          : "Welcome@2026!";
      passwords[p.id] = au?.user_metadata?.plain_password || defPass;
      emails[p.id] = formatDisplayUsername(au?.email || `${first.toLowerCase()}@${p.role === "team_leader" ? "tl" : p.role}`);
    }

    const assetList = assets || [];
    const profList = profs || [];
    const workingLogs = logsRaw || [];

    const logs = await Promise.all(
      workingLogs.map(async (l: any, idx: number) => {
        const snap = l.record_snapshot?.after || l.record_snapshot?.before || l.record_snapshot || {};
        const matchedAsset = assetList.find((a: any) => a.id === l.entity_id) || assetList[idx % Math.max(1, assetList.length)];
        const matchedProf = profList.find((p: any) => p.id === l.entity_id) || profList[idx % Math.max(1, profList.length)];

        const act = (l.action || "CREATE").toUpperCase();
        const ent = (l.entity_type || (snap.account_id ? "ASSET" : snap.full_name ? "EMPLOYEE" : "ASSET")).toUpperCase();
        const actor = l.actor_name || matchedProf?.full_name || "Administrator";

        let sum = (l.summary || "").trim();
        if (!sum) {
          if (snap.account_id) {
            sum = `${act} [${(snap.platform || "SM").toUpperCase()}] ${snap.bio || snap.account_id} (${snap.account_id})`;
          } else if (snap.full_name) {
            sum = `${act} ${(snap.role || "SMM").toUpperCase()}: ${snap.full_name}`;
          } else if (matchedAsset && ent === "ASSET") {
            sum = `${act} [${(matchedAsset.platform || "SM").toUpperCase()}] ${matchedAsset.bio || matchedAsset.account_id} (${matchedAsset.account_id})`;
          } else if (matchedProf) {
            sum = `${act} ${(matchedProf.role || "USER").toUpperCase()}: ${matchedProf.full_name}`;
          } else {
            sum = `${act} ${ent} Record #${idx + 1}`;
          }
        }

        const finalSnap = Object.keys(snap).length > 0 ? snap : (ent === "EMPLOYEE" ? matchedProf : matchedAsset) || {};

        if (l.id && (!l.summary || !l.action || !l.entity_type)) {
          await db
            .from("audit_logs")
            .update({ action: act, entity_type: ent, actor_name: actor, summary: sum, record_snapshot: finalSnap })
            .eq("id", l.id);
        }

        return {
          ...l,
          action: act,
          entity_type: ent,
          actor_name: actor,
          summary: sum,
          details: sum,
          description: sum,
          record_snapshot: finalSnap
        };
      })
    );

    return NextResponse.json({ logs, passwords, emails });
  } catch (e: any) {
    return NextResponse.json({ logs: [], passwords: {}, emails: {}, error: e.message });
  }
}

export async function POST(req: Request) {
  try {
    const { actorId, action, entity, payload } = await req.json();
    const db = getDb();
    let actor: any = null;
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (tok) {
      const { data } = await db.auth.getUser(tok);
      if (data?.user) actor = (await db.from("profiles").select("*").eq("id", data.user.id).single()).data;
    }
    if (!actor && actorId) actor = (await db.from("profiles").select("*").eq("id", actorId).single()).data;
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const log = async (act: string, ent: string, id: string, sum: string, snap: any) => {
      await db.from("audit_logs").insert([{
        actor_id: actor.id, actor_name: actor.full_name, actor_role: actor.role,
        action: act, entity_type: ent, entity_id: id, summary: sum, record_snapshot: snap || {}
      }]);
    };

    if (entity === "metric" && action === "bulk_upsert") {
      if (actor.role === "smm" && actor.is_locked) return NextResponse.json({ error: "Metric entry is locked." }, { status: 403 });
      const rows = (payload.rows || []).filter((r: any) => r.asset_id && r.week_of);
      const { data, error } = await db.from("weekly_metrics").upsert(rows, { onConflict: "asset_id,week_of" }).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await log("UPSERT", "METRIC", "BATCH", `Submitted weekly metrics for ${rows.length} accounts (${rows[0]?.week_of || ""})`, { count: rows.length });
      return NextResponse.json({ success: true, count: data?.length || rows.length });
    }

    if (entity === "audit" && action === "restore") {
      const { data: en } = await db.from("audit_logs").select("*").eq("id", payload.logId).single();
      const s = en?.record_snapshot?.before || en?.record_snapshot;
      if (!s) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      const t = en.entity_type === "ASSET" ? "social_assets" : en.entity_type === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      await db.from(t).upsert([s]);
      await log("RESTORE", en.entity_type, s.id || "ID", `Restored ${en.entity_type}: ${s.bio || s.account_id || s.full_name || s.id}`, s);
      return NextResponse.json({ success: true });
    }

    if (entity === "campaign" && action === "dispatch") {
      const { platforms, targetMode, targetTlIds, targetSmmIds, topic, direction } = payload;
      const [{ data: allA }, { data: allP }] = await Promise.all([db.from("social_assets").select("*"), db.from("profiles").select("*")]);
      const ids = (allA || [])
        .filter((a: any) => {
          if (platforms?.length && !platforms.includes(a.platform)) return false;
          if (targetMode === "tl") {
            const s = (allP || []).find((p: any) => p.id === a.smm_id);
            const tls = s?.team_leader_ids || (s?.team_leader_id ? [s.team_leader_id] : []);
            return targetTlIds.includes(a.team_leader_id) || targetTlIds.some((id: string) => tls.includes(id));
          }
          return targetSmmIds.includes(a.smm_id);
        })
        .map((a: any) => a.id);
      if (ids.length) await db.from("social_assets").update({ project_name: topic, tl_campaign: topic, tl_task: direction }).in("id", ids);
      await log("UPDATE", "ASSET", "CAMPAIGN", `Assigned directive "${topic}" to ${ids.length} accounts`, payload);
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (entity === "profile") {
      if (action === "create") {
        const role = actor.role === "team_leader" ? "smm" : payload.role || "smm";
        const email = normalizeAuthUsername(payload.email, role === "team_leader" ? "tl" : role === "admin" ? "admin" : "smm");
        const { data: u, error: e } = await db.auth.admin.createUser({
          email, password: payload.password, email_confirm: true,
          user_metadata: { plain_password: payload.password }
        });
        if (e) return NextResponse.json({ error: e.message }, { status: 400 });
        const tlId = actor.role === "team_leader" ? actor.id : payload.team_leader_id || null;
        const rec = {
          id: u.user.id, role, full_name: payload.full_name, country: payload.country || "Kenya",
          team_leader_id: role === "smm" ? tlId : null,
          team_leader_ids: role === "smm" && tlId ? [tlId] : [],
          platforms: payload.platforms || ["twitter"]
        };
        await db.from("profiles").insert([rec]);
        await log("CREATE", "EMPLOYEE", rec.id, `Added ${role.toUpperCase()}: ${rec.full_name}`, rec);
        return NextResponse.json({ success: true });
      }

      if (action === "update") {
        const { targetId, newPassword, newEmail, assignedSmmIds, assignedAssetIds, ...upd } = payload;
        await db.from("profiles").update(upd).eq("id", targetId);
        const authUpd: any = {};
        if (newPassword && newPassword.trim().length >= 6) {
          authUpd.password = newPassword.trim();
          authUpd.user_metadata = { plain_password: newPassword.trim() };
        }
        if (newEmail && newEmail.trim()) {
          const targetRole = upd.role || actor.role || "smm";
          authUpd.email = normalizeAuthUsername(newEmail.trim(), targetRole === "team_leader" ? "tl" : targetRole === "admin" ? "admin" : "smm");
          authUpd.email_confirm = true;
        }
        if (Object.keys(authUpd).length > 0) await db.auth.admin.updateUserById(targetId, authUpd);
        await log("UPDATE", "EMPLOYEE", targetId, `Updated profile: ${upd.full_name || targetId}`, upd);
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { data: oldP } = await db.from("profiles").select("*").eq("id", payload.targetId).single();
        await db.from("profiles").delete().eq("id", payload.targetId);
        await db.auth.admin.deleteUser(payload.targetId);
        await log("DELETE", "EMPLOYEE", payload.targetId, `Deleted user: ${oldP?.full_name || payload.targetId}`, oldP);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "asset") {
      const cl = { ...payload };
      delete cl.recovery_email;
      delete cl.recovery_password;
      delete cl.account_name;
      if (action === "create") {
        const { data: c, error } = await db.from("social_assets").insert([cl]).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("CREATE", "ASSET", c.id, `Added [${c.platform.toUpperCase()}] ${c.bio || c.account_id} (${c.account_id})`, c);
        return NextResponse.json({ success: true, asset: c });
      }
      if (action === "bulk_create") {
        const { data: ins, error } = await db.from("social_assets").insert(payload.items || []).select();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("BULK_CREATE", "ASSET", "BULK", `Bulk added ${ins?.length || 0} accounts`, { count: ins?.length });
        return NextResponse.json({ success: true, count: ins?.length || 0 });
      }
      if (action === "update") {
        const { id, ...f } = cl;
        const { data: a, error } = await db.from("social_assets").update(f).eq("id", id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("UPDATE", "ASSET", id, `Updated [${a.platform.toUpperCase()}] ${a.bio || a.account_id} (${a.account_id})`, a);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        const { data: oldA } = await db.from("social_assets").select("*").eq("id", payload.id).single();
        await db.from("social_assets").delete().eq("id", payload.id);
        await log("DELETE", "ASSET", payload.id, `Deleted [${oldA?.platform?.toUpperCase() || "ASSET"}] ${oldA?.bio || oldA?.account_id || payload.id}`, oldA);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "metric") {
      if (action === "upsert") {
        const { data: s, error } = await db.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("UPSERT", "METRIC", s.id, `Logged metrics (${payload.week_of})`, s);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        await db.from("weekly_metrics").delete().eq("id", payload.id);
        await log("DELETE", "METRIC", payload.id, `Deleted metric ${payload.id}`, payload);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
