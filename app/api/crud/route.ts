import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function safeWrite(db: any, table: string, row: any, idVal?: string) {
  const d = { ...row };
  if (idVal) delete d.id;
  for (let i = 0; i < 12; i++) {
    const q = idVal ? db.from(table).update(d).eq("id", idVal) : db.from(table).insert([d]);
    const { data, error } = await q.select().maybeSingle();
    if (!error) return { data, error: null };
    const m = error.message?.match(/Could not find the '([^']+)' column/);
    if (m && m[1] && m[1] in d) { delete d[m[1]]; continue; }
    return { data: null, error };
  }
  return { data: null, error: { message: "Schema retry limit" } };
}

async function saveMetricRow(db: any, row: any) {
  if (!row?.asset_id || !row?.week_of) return null;
  const { data: ex } = await db.from("weekly_metrics").select("id").eq("asset_id", row.asset_id).eq("week_of", row.week_of).maybeSingle();
  const { data, error } = await safeWrite(db, "weekly_metrics", row, ex?.id);
  if (error) throw new Error(error.message);
  return data;
}

export async function GET() {
  try {
    const db = getDb();
    const [{ data: lRaw }, { data: profs }, { data: assets }, { data: auth }, { data: metrics }] = await Promise.all([
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(800),
      db.from("profiles").select("*").order("created_at", { ascending: false }),
      db.from("social_assets").select("*").order("created_at", { ascending: false }),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("weekly_metrics").select("*").order("week_of", { ascending: false }).limit(4000)
    ]);

    const passwords: Record<string, string> = {};
    const emails: Record<string, string> = {};
    const uMap = new Map((auth?.users || []).map((u: any) => [u.id, u]));

    for (const p of profs || []) {
      const u: any = uMap.get(p.id);
      const fn = (p.full_name || "User").trim().split(/\s+/)[0];
      const dp = p.role === "admin" ? "Admin@2026!" : p.role === "team_leader" ? `${fn.charAt(0).toUpperCase() + fn.slice(1).toLowerCase()}@2026!` : "Welcome@2026!";
      passwords[p.id] = u?.user_metadata?.plain_password || dp;
      emails[p.id] = formatDisplayUsername(u?.email || `${fn.toLowerCase()}@${p.role === "team_leader" ? "tl" : p.role}`);
    }

    const aList = assets || [], pList = profs || [];
    const allLogs = (lRaw || []).map((l: any, i: number) => {
      const snap = l.record_snapshot?.after || l.record_snapshot?.before || l.record_snapshot || {};
      const mA = aList.find((a: any) => a.id === l.entity_id) || aList[i % Math.max(1, aList.length)];
      const mP = pList.find((p: any) => p.id === l.entity_id) || pList[i % Math.max(1, pList.length)];
      const act = (l.action || "CREATE").toUpperCase();
      const ent = (l.entity_type || (snap.account_id ? "ASSET" : snap.full_name ? "EMPLOYEE" : "ASSET")).toUpperCase();
      const actor = l.actor_name || mP?.full_name || "Master Admin";
      let sum = (l.summary || "").trim();
      if (!sum) {
        sum = snap.account_id ? `${act} [${(snap.platform || "SM").toUpperCase()}] ${snap.bio || snap.account_id} (${snap.account_id})`
          : snap.full_name ? `${act} ${(snap.role || "SMM").toUpperCase()}: ${snap.full_name}`
          : mA && ent === "ASSET" ? `${act} [${(mA.platform || "SM").toUpperCase()}] ${mA.bio || mA.account_id} (${mA.account_id})`
          : `${act} ${ent}: ${mP?.full_name || "Record #" + (i + 1)}`;
      }
      const fSnap = Object.keys(snap).length ? snap : (ent === "EMPLOYEE" ? mP : mA) || {};
      const smm = pList.find((p: any) => p.id === fSnap?.smm_id);
      const tl = pList.find((p: any) => p.id === (fSnap?.team_leader_id || smm?.team_leader_id));
      return {
        ...l, action: act, entity_type: ent, actor_name: actor, actor_role: l.actor_role || "admin",
        summary: sum, details: sum, description: sum,
        record_snapshot: { ...fSnap, assigned_smm: smm?.full_name, assigned_tl: tl?.full_name }
      };
    });

    // Extract Hierarchical MEL Reports (SMM -> TL -> Admin) stored in audit_logs
    const reports = allLogs
      .filter((l: any) => l.entity_type === "MEL_REPORT")
      .map((l: any) => ({ id: l.id, created_at: l.created_at, ...(l.record_snapshot || {}) }));

    return NextResponse.json({ logs: allLogs, reports, passwords, emails, profiles: pList, assets: aList, metrics: metrics || [] });
  } catch (e: any) {
    return NextResponse.json({ logs: [], reports: [], passwords: {}, emails: {}, profiles: [], assets: [], metrics: [], error: e.message });
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
      if (data?.user) actor = (await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle()).data;
    }
    if (!actor && actorId) actor = (await db.from("profiles").select("*").eq("id", actorId).maybeSingle()).data;
    if (!actor) actor = (await db.from("profiles").select("*").eq("role", "admin").limit(1).maybeSingle()).data || { id: "admin", full_name: "Master Admin", role: "admin" };

    const log = async (act: string, ent: string, id: string, sum: string, snap: any) => {
      try { await db.from("audit_logs").insert([{ actor_id: actor.id, actor_name: actor.full_name, actor_role: actor.role, action: act, entity_type: ent, entity_id: id, summary: sum, record_snapshot: snap || {} }]); } catch {}
    };

    // HIERARCHICAL MEL REPORTING SYSTEM (SMM -> TL -> ADMIN)
    if (entity === "report") {
      if (action === "submit_smm") {
        const rep = {
          tier: "smm_to_tl",
          horizon: payload.horizon,
          period: payload.period,
          smm_id: actor.id,
          smm_name: actor.full_name,
          tl_id: payload.tl_id,
          tl_name: payload.tl_name,
          stats: payload.stats,
          highlights: payload.highlights,
          blockers: payload.blockers,
          next_steps: payload.next_steps,
          evidence_link: payload.evidence_link || "",
          status: "Pending TL Review",
          submitted_at: new Date().toISOString()
        };
        await log("SUBMIT_REPORT", "MEL_REPORT", `SMM_${payload.horizon.toUpperCase()}_${payload.period}`, `[SMM ${payload.horizon.toUpperCase()} REPORT] ${actor.full_name} submitted ${payload.period} report to TL ${payload.tl_name || ""}`, rep);
        return NextResponse.json({ success: true });
      }

      if (action === "submit_tl") {
        // Mark included SMM reports as forwarded
        if (Array.isArray(payload.includedReportIds)) {
          for (const rId of payload.includedReportIds) {
            const { data: oldR } = await db.from("audit_logs").select("*").eq("id", rId).maybeSingle();
            if (oldR) {
              const updatedSnap = { ...(oldR.record_snapshot || {}), status: "Approved & Forwarded to Admin" };
              await db.from("audit_logs").update({ record_snapshot: updatedSnap }).eq("id", rId);
            }
          }
        }
        const rep = {
          tier: "tl_to_admin",
          horizon: payload.horizon,
          period: payload.period,
          tl_id: actor.id,
          tl_name: actor.full_name,
          country: actor.country || "Squad",
          smm_reports_count: (payload.includedReportIds || []).length,
          stats: payload.stats,
          executive_summary: payload.executive_summary,
          regional_learnings: payload.regional_learnings,
          escalations: payload.escalations,
          status: "Submitted to Master Admin",
          submitted_at: new Date().toISOString()
        };
        await log("SUBMIT_SQUAD_REPORT", "MEL_REPORT", `TL_${payload.horizon.toUpperCase()}_${payload.period}`, `[TL SQUAD ${payload.horizon.toUpperCase()} REPORT] ${actor.full_name} submitted consolidated ${payload.period} report to Admin`, rep);
        return NextResponse.json({ success: true });
      }

      if (action === "update_status") {
        const { data: oldR } = await db.from("audit_logs").select("*").eq("id", payload.reportId).maybeSingle();
        if (oldR) {
          const updatedSnap = { ...(oldR.record_snapshot || {}), status: payload.status, admin_feedback: payload.feedback || "" };
          await db.from("audit_logs").update({
            summary: `${oldR.summary} [${payload.status}]`,
            record_snapshot: updatedSnap
          }).eq("id", payload.reportId);
        }
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "profile" && action === "lock_all") {
      const lock = Boolean(payload.is_locked);
      const { data: pAll } = await db.from("profiles").select("id, role");
      const sIds = (pAll || []).filter((p: any) => p.role !== "admin").map((p: any) => p.id);
      if (sIds.length) await db.from("profiles").update({ is_locked: lock }).in("id", sIds);
      const { data: aAll } = await db.from("social_assets").select("id");
      const aIds = (aAll || []).map((a: any) => a.id);
      if (aIds.length) await db.from("social_assets").update({ status: lock ? "locked" : "active" }).in("id", aIds);
      await log(lock ? "LOCK_ALL" : "UNLOCK_ALL", "EMPLOYEE", "ALL", `${lock ? "🔒 Locked" : "🔓 Unlocked"} ${sIds.length} staff & ${aIds.length} assets`, { is_locked: lock, staff: sIds.length, assets: aIds.length });
      return NextResponse.json({ success: true, count: sIds.length, assetCount: aIds.length, is_locked: lock });
    }

    if (entity === "profile" && action === "toggle_lock") {
      const lock = Boolean(payload.is_locked);
      const { data: u } = await db.from("profiles").update({ is_locked: lock }).eq("id", payload.targetId).select().maybeSingle();
      await db.from("social_assets").update({ status: lock ? "locked" : "active" }).eq("smm_id", payload.targetId);
      await log(lock ? "LOCK" : "UNLOCK", "EMPLOYEE", payload.targetId, `${lock ? "🔒 Locked" : "🔓 Unlocked"} ${u?.full_name || payload.targetId}`, u || payload);
      return NextResponse.json({ success: true, is_locked: lock });
    }

    if (entity === "metric" && (action === "bulk_upsert" || action === "upsert")) {
      if (actor.role === "smm" && actor.is_locked) return NextResponse.json({ error: "Account locked by Admin" }, { status: 403 });
      const rows = action === "bulk_upsert" ? (payload.rows || []) : [payload];
      const saved: any[] = [];
      for (const r of rows) {
        if (r?.asset_id && r?.week_of) saved.push(await saveMetricRow(db, r));
      }
      await log("UPSERT", "METRIC", "BATCH", `Saved weekly metrics for ${saved.length} accounts (${rows[0]?.week_of || ""})`, { count: saved.length, week_of: rows[0]?.week_of });
      return NextResponse.json({ success: true, count: saved.length, saved });
    }

    if (entity === "audit" && action === "restore") {
      const { data: en } = await db.from("audit_logs").select("*").eq("id", payload.logId).maybeSingle();
      const s = { ...(en?.record_snapshot?.before || en?.record_snapshot || {}) };
      delete s.assigned_smm; delete s.assigned_tl;
      const tbl = en.entity_type === "ASSET" ? "social_assets" : en.entity_type === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      const { data: ex } = s.id ? await db.from(tbl).select("id").eq("id", s.id).maybeSingle() : { data: null };
      await safeWrite(db, tbl, s, ex?.id);
      await log("RESTORE", en.entity_type, s.id || "ID", `Restored ${en.entity_type}: ${s.bio || s.account_id || s.full_name}`, s);
      return NextResponse.json({ success: true });
    }

    if (entity === "profile") {
      if (action === "create") {
        const role = actor.role === "team_leader" ? "smm" : payload.role || "smm";
        const email = normalizeAuthUsername(payload.email || payload.full_name, role === "team_leader" ? "tl" : role === "admin" ? "admin" : "smm");
        const pass = payload.password || (role === "admin" ? "Admin@2026!" : "Welcome@2026!");
        const { data: u, error: e } = await db.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { plain_password: pass } });
        if (e) return NextResponse.json({ error: e.message }, { status: 400 });
        const tlId = actor.role === "team_leader" ? actor.id : payload.team_leader_id || null;
        const rec = { id: u.user.id, role, full_name: payload.full_name, country: payload.country || "Kenya", team_leader_id: role === "smm" ? tlId : null, team_leader_ids: role === "smm" && tlId ? [tlId] : [], platforms: payload.platforms || ["twitter"], is_locked: Boolean(payload.is_locked) };
        await safeWrite(db, "profiles", rec);
        await log("CREATE", "EMPLOYEE", rec.id, `Added ${role.toUpperCase()}: ${rec.full_name}`, { ...rec, email: formatDisplayUsername(email) });
        return NextResponse.json({ success: true, profile: rec });
      }
      if (action === "update") {
        const { targetId, newPassword, newEmail, assignedSmmIds, assignedAssetIds, ...upd } = payload;
        await safeWrite(db, "profiles", upd, targetId);
        const au: any = {};
        if (newPassword && newPassword.trim().length >= 6) { au.password = newPassword.trim(); au.user_metadata = { plain_password: newPassword.trim() }; }
        if (newEmail && newEmail.trim()) { const r = upd.role || "smm"; au.email = normalizeAuthUsername(newEmail.trim(), r === "team_leader" ? "tl" : r === "admin" ? "admin" : "smm"); au.email_confirm = true; }
        if (Object.keys(au).length) await db.auth.admin.updateUserById(targetId, au);
        if (Array.isArray(assignedSmmIds)) await db.from("profiles").update({ team_leader_id: targetId }).in("id", assignedSmmIds);
        if (Array.isArray(assignedAssetIds)) await db.from("social_assets").update({ smm_id: targetId }).in("id", assignedAssetIds);
        await log("UPDATE", "EMPLOYEE", targetId, `Updated profile: ${upd.full_name || targetId}`, upd);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        const { data: oldP } = await db.from("profiles").select("*").eq("id", payload.targetId).maybeSingle();
        await db.from("profiles").delete().eq("id", payload.targetId);
        await db.auth.admin.deleteUser(payload.targetId);
        await log("DELETE", "EMPLOYEE", payload.targetId, `Deleted user: ${oldP?.full_name || payload.targetId}`, oldP);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "asset") {
      const cl = { ...payload }; delete cl.recovery_email; delete cl.recovery_password; delete cl.account_name;
      if (action === "create") { const { data: c, error } = await safeWrite(db, "social_assets", cl); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("CREATE", "ASSET", c.id, `Added [${(c.platform || "").toUpperCase()}] ${c.bio || c.account_id}`, c); return NextResponse.json({ success: true, asset: c }); }
      if (action === "update") { const { id, ...f } = cl; const { data: a, error } = await safeWrite(db, "social_assets", f, id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await log("UPDATE", "ASSET", id, `Updated [${(a?.platform || "").toUpperCase()}] ${a?.bio || a?.account_id}`, a); return NextResponse.json({ success: true }); }
      if (action === "delete") { const { data: oldA } = await db.from("social_assets").select("*").eq("id", payload.id).maybeSingle(); await db.from("social_assets").delete().eq("id", payload.id); await log("DELETE", "ASSET", payload.id, `Deleted asset ${oldA?.bio || oldA?.account_id}`, oldA); return NextResponse.json({ success: true }); }
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
