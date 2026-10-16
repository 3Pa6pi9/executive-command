import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername } from "@/lib/constants";

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const db = getDb();
    let { data: logs } = await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1500);
    if (!logs?.length) {
      const { data: a } = await db.from("social_assets").select("*").limit(200);
      if (a?.length) {
        await db.from("audit_logs").insert(a.map((x: any) => ({ actor_id: x.smm_id, actor_name: "System", actor_role: "admin", action: "CREATE", entity_type: "ASSET", entity_id: x.id, summary: `Account [${x.platform}] ${x.account_id}`, record_snapshot: x })));
        logs = (await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1500)).data || [];
      }
    }
    return NextResponse.json({ logs: logs || [] });
  } catch (e: any) { return NextResponse.json({ logs: [], error: e.message }); }
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
      await db.from("audit_logs").insert([{ actor_id: actor.id, actor_name: actor.full_name, actor_role: actor.role, action: act, entity_type: ent, entity_id: id, summary: sum, record_snapshot: snap || {} }]);
    };

    if (entity === "metric" && action === "bulk_upsert") {
      const rows = (payload.rows || []).filter((r: any) => r.asset_id && r.week_of);
      const { data, error } = await db.from("weekly_metrics").upsert(rows, { onConflict: "asset_id,week_of" }).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await log("UPSERT", "METRIC", "BATCH", `Saved weekly metrics (${rows.length} accounts)`, { count: rows.length });
      return NextResponse.json({ success: true, count: data?.length || rows.length });
    }
    if (entity === "audit" && action === "restore") {
      const { data: en } = await db.from("audit_logs").select("*").eq("id", payload.logId).single();
      const s = en?.record_snapshot?.before || en?.record_snapshot;
      if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const t = en.entity_type === "ASSET" ? "social_assets" : en.entity_type === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      await db.from(t).upsert([s]);
      await log("RESTORE", en.entity_type, s.id || "ID", `Restored ${en.entity_type}`, s);
      return NextResponse.json({ success: true });
    }
    if (entity === "campaign" && action === "dispatch") {
      const { platforms, targetMode, targetTlIds, targetSmmIds, topic, direction } = payload;
      const { data: allA } = await db.from("social_assets").select("*");
      const ids = (allA || []).filter((a: any) => (!platforms?.length || platforms.includes(a.platform)) && (targetMode === "tl" ? targetTlIds.includes(a.team_leader_id) : targetSmmIds.includes(a.smm_id))).map((a: any) => a.id);
      if (ids.length) await db.from("social_assets").update({ project_name: topic, tl_campaign: topic, tl_task: direction }).in("id", ids);
      await log("UPDATE", "ASSET", "CAMPAIGN", `Assigned "${topic}" to ${ids.length} accounts`, payload);
      return NextResponse.json({ success: true, count: ids.length });
    }
    if (entity === "profile") {
      if (action === "create") {
        const role = actor.role === "team_leader" ? "smm" : (payload.role || "smm");
        const email = normalizeAuthUsername(payload.email, role === "team_leader" ? "tl" : role === "admin" ? "admin" : "smm");
        const { data: u, error: e } = await db.auth.admin.createUser({ email, password: payload.password, email_confirm: true });
        if (e) return NextResponse.json({ error: e.message }, { status: 400 });
        const tlId = actor.role === "team_leader" ? actor.id : (payload.team_leader_id || null);
        const rec = { id: u.user.id, role, full_name: payload.full_name, country: payload.country || "Kenya", team_leader_id: role === "smm" ? tlId : null, team_leader_ids: role === "smm" && tlId ? [tlId] : [], platforms: payload.platforms || ["twitter"] };
        await db.from("profiles").insert([rec]);
        await log("CREATE", "EMPLOYEE", rec.id, `Created ${role}: ${rec.full_name}`, rec);
        return NextResponse.json({ success: true });
      }
      if (action === "update") {
        const { targetId, newPassword, assignedSmmIds, assignedAssetIds, ...upd } = payload;
        await db.from("profiles").update(upd).eq("id", targetId);
        if (newPassword && newPassword.trim().length >= 6) await db.auth.admin.updateUserById(targetId, { password: newPassword.trim() });
        await log("UPDATE", "EMPLOYEE", targetId, `Updated ${upd.full_name || targetId}`, upd);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        await db.from("profiles").delete().eq("id", payload.targetId);
        await db.auth.admin.deleteUser(payload.targetId);
        await log("DELETE", "EMPLOYEE", payload.targetId, `Deleted ${payload.targetId}`, payload);
        return NextResponse.json({ success: true });
      }
    }
    if (entity === "asset") {
      const cl = { ...payload }; delete cl.recovery_email; delete cl.recovery_password;
      if (action === "create") { const { data: c, error } = await db.from("social_assets").insert([cl]).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("CREATE", "ASSET", c.id, `Added [${c.platform}] ${c.account_id}`, c); return NextResponse.json({ success: true, asset: c }); }
      if (action === "bulk_create") { const { data: ins, error } = await db.from("social_assets").insert(payload.items || []).select(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("BULK_CREATE", "ASSET", "BULK", `Added ${ins?.length || 0} accounts`, {}); return NextResponse.json({ success: true, count: ins?.length || 0 }); }
      if (action === "update") { const { id, ...f } = cl; const { data: a, error } = await db.from("social_assets").update(f).eq("id", id).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("UPDATE", "ASSET", id, `Updated ${a.account_id}`, a); return NextResponse.json({ success: true }); }
      if (action === "delete") { await db.from("social_assets").delete().eq("id", payload.id); await log("DELETE", "ASSET", payload.id, `Deleted asset`, payload); return NextResponse.json({ success: true }); }
    }
    if (entity === "metric") {
      if (action === "upsert") { const { data: s, error } = await db.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" }).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("UPSERT", "METRIC", s.id, `Saved metric (${payload.week_of})`, s); return NextResponse.json({ success: true }); }
      if (action === "delete") { await db.from("weekly_metrics").delete().eq("id", payload.id); await log("DELETE", "METRIC", payload.id, `Deleted metric`, payload); return NextResponse.json({ success: true }); }
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
