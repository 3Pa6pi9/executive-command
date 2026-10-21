import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function periodToValidDate(period: string): string {
  const p = (period || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  if (/^\d{4}-\d{2}$/.test(p)) return `${p}-01`;
  const qMatch = p.match(/^(\d{4})-Q([1-4])$/i);
  if (qMatch) {
    const month = String((Number(qMatch[2]) - 1) * 3 + 1).padStart(2, "0");
    return `${qMatch[1]}-${month}-01`;
  }
  if (/^\d{4}$/.test(p)) return `${p}-01-01`;
  return new Date().toISOString().split("T")[0];
}

async function safeWrite(db: any, table: string, row: any, idVal?: string) {
  const d = { ...row };
  if (idVal) delete d.id;
  for (let i = 0; i < 12; i++) {
    const q = idVal ? db.from(table).update(d).eq("id", idVal) : db.from(table).insert([d]);
    const { data, error } = await q.select().maybeSingle();
    if (!error) return { data, error: null };
    const m = error.message?.match(/Could not find the '([^']+)' column/);
    if (m && m[1] && m[1] in d) {
      delete d[m[1]];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: { message: "Schema retry limit" } };
}

async function saveMetricRow(db: any, row: any) {
  if (!row?.asset_id) return null;
  const validDate = periodToValidDate(row.week_of);
  const cleanRow = { ...row, week_of: validDate };
  const { data: ex } = await db
    .from("weekly_metrics")
    .select("id")
    .eq("asset_id", cleanRow.asset_id)
    .eq("week_of", validDate)
    .maybeSingle();
  const { data, error } = await safeWrite(db, "weekly_metrics", cleanRow, ex?.id);
  if (error) throw new Error(error.message);
  return data;
}

export async function GET() {
  try {
    const db = getDb();
    const [{ data: lRaw }, { data: profs }, { data: assets }, { data: auth }, { data: metrics }] = await Promise.all([
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(2000),
      db.from("profiles").select("*").order("created_at", { ascending: false }),
      db.from("social_assets").select("*").order("created_at", { ascending: false }),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("weekly_metrics").select("*").order("week_of", { ascending: false }).limit(5000)
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

    const aList = assets || [];
    const pList = profs || [];
    const rawLogs = lRaw || [];

    // Inclusive report record extraction
    const reportRecords = rawLogs
      .filter((l: any) => l.entity_type === "REPORT_RECORD" || l.action?.includes("REPORT") || (l.record_snapshot && l.record_snapshot.horizon))
      .map((l: any) => {
        const snap = l.record_snapshot?.after || l.record_snapshot?.before || l.record_snapshot || {};
        const smmProf = pList.find((p: any) => p.id === (snap.smm_id || l.actor_id));
        const tlId = snap.tl_id || smmProf?.team_leader_id || (smmProf?.team_leader_ids && smmProf.team_leader_ids[0]) || "";
        const tlProf = pList.find((p: any) => p.id === tlId);

        return {
          id: l.id,
          created_at: l.created_at,
          actor_id: l.actor_id || snap.smm_id,
          smm_id: snap.smm_id || l.actor_id,
          smm_name: snap.smm_name || smmProf?.full_name || l.actor_name || "SMM User",
          tl_id: tlProf?.id || tlId || "unassigned",
          tl_name: tlProf?.full_name || snap.tl_name || "Team Leader",
          horizon: snap.horizon || "weekly",
          period: snap.period || "current",
          account_count: snap.account_count || (snap.rows || []).length,
          totals: snap.totals || { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, followers: 0, gained: 0, lost: 0 },
          rows: snap.rows || [],
          status: snap.status || "Submitted to TL",
          forwarded_to_admin: Boolean(snap.forwarded_to_admin),
          submitted_at: snap.submitted_at || l.created_at
        };
      });

    const activityLogs = rawLogs
      .filter((l: any) => l.entity_type !== "REPORT_RECORD" && !l.action?.includes("REPORT"))
      .map((l: any, i: number) => {
        const snap = l.record_snapshot?.after || l.record_snapshot?.before || l.record_snapshot || {};
        const mA = aList.find((a: any) => a.id === l.entity_id) || aList[i % Math.max(1, aList.length)];
        const mP = pList.find((p: any) => p.id === l.entity_id) || pList[i % Math.max(1, pList.length)];
        const act = (l.action || "CREATE").toUpperCase();
        const ent = (l.entity_type || (snap.account_id ? "ASSET" : snap.full_name ? "EMPLOYEE" : "ASSET")).toUpperCase();
        const actor = l.actor_name || mP?.full_name || "Master Admin";
        let sum = (l.summary || "").trim();
        if (!sum) {
          sum = snap.account_id
            ? `${act} [${(snap.platform || "SM").toUpperCase()}] ${snap.bio || snap.account_id} (${snap.account_id})`
            : snap.full_name
            ? `${act} ${(snap.role || "SMM").toUpperCase()}: ${snap.full_name}`
            : mA && ent === "ASSET"
            ? `${act} [${(mA.platform || "SM").toUpperCase()}] ${mA.bio || mA.account_id} (${mA.account_id})`
            : `${act} ${ent}: ${mP?.full_name || "Record #" + (i + 1)}`;
        }
        const fSnap = Object.keys(snap).length ? snap : (ent === "EMPLOYEE" ? mP : mA) || {};
        const smm = pList.find((p: any) => p.id === fSnap?.smm_id);
        const tl = pList.find((p: any) => p.id === (fSnap?.team_leader_id || smm?.team_leader_id));
        return {
          ...l,
          action: act,
          entity_type: ent,
          actor_name: actor,
          actor_role: l.actor_role || "admin",
          summary: sum,
          details: sum,
          description: sum,
          record_snapshot: { ...fSnap, assigned_smm: smm?.full_name, assigned_tl: tl?.full_name }
        };
      });

    return NextResponse.json({
      logs: activityLogs,
      reportRecords,
      passwords,
      emails,
      profiles: pList,
      assets: aList,
      metrics: metrics || []
    });
  } catch (e: any) {
    return NextResponse.json({ logs: [], reportRecords: [], passwords: {}, emails: {}, profiles: [], assets: [], metrics: [], error: e.message });
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
      try {
        await db.from("audit_logs").insert([{
          actor_id: actor.id,
          actor_name: actor.full_name,
          actor_role: actor.role,
          action: act,
          entity_type: ent,
          entity_id: id,
          summary: sum,
          record_snapshot: snap || {}
        }]);
      } catch {}
    };

    if (entity === "report_record") {
      if (action === "submit_smm_report") {
        if (actor.role === "smm" && actor.is_locked) {
          return NextResponse.json({ error: "Report submissions are currently locked by your Team Leader or Admin." }, { status: 403 });
        }
        const horizon = payload.horizon || "weekly";
        const period = payload.period || new Date().toISOString().split("T")[0];
        const rows = payload.rows || [];

        for (const r of rows) {
          if (r?.asset_id) await saveMetricRow(db, { ...r, week_of: period });
        }

        const { data: allProfs } = await db.from("profiles").select("*");
        const profList = allProfs || [];
        const smmProf = profList.find((p: any) => p.id === actor.id) || actor;
        const tlId = payload.tl_id || smmProf.team_leader_id || (smmProf.team_leader_ids && smmProf.team_leader_ids[0]) || "";
        const tlProf = profList.find((p: any) => p.id === tlId) || profList.find((p: any) => p.role === "team_leader");

        const totals = rows.reduce(
          (acc: any, r: any) => {
            acc.posts += Number(r.posts_published || 0);
            acc.views += Number(r.impressions || 0);
            acc.likes += Number(r.likes || 0);
            acc.comments += Number(r.comments || 0);
            acc.shares += Number(r.shares_reposts || 0);
            acc.followers += Number(r.total_followers || 0);
            acc.gained += Number(r.followers_gained || 0);
            acc.lost += Number(r.followers_lost || 0);
            return acc;
          },
          { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, followers: 0, gained: 0, lost: 0 }
        );

        const reportSnapshot = {
          record_type: "smm_report",
          horizon,
          period,
          smm_id: actor.id,
          smm_name: actor.full_name,
          smm_country: smmProf.country || "Kenya",
          tl_id: tlProf?.id || tlId || "unassigned",
          tl_name: tlProf?.full_name || "Team Leader",
          account_count: rows.length,
          totals,
          rows,
          status: "Submitted to TL",
          forwarded_to_admin: false,
          submitted_at: new Date().toISOString()
        };

        await log(
          "SUBMIT_REPORT",
          "REPORT_RECORD",
          `SMM_${actor.id}_${horizon}_${period}`,
          `[${horizon.toUpperCase()} REPORT] ${actor.full_name} (${period}) — ${rows.length} accounts, ${totals.posts} posts`,
          reportSnapshot
        );

        return NextResponse.json({ success: true, report: reportSnapshot });
      }

      if (action === "forward_tl_reports") {
        const { horizon, period, reportIds } = payload;
        const { data: matching } = await db.from("audit_logs").select("*").eq("entity_type", "REPORT_RECORD");
        const targetLogs = (matching || []).filter((l: any) => {
          const s = l.record_snapshot || {};
          if (Array.isArray(reportIds) && reportIds.length > 0) return reportIds.includes(l.id);
          return s.horizon === horizon && s.period === period;
        });

        for (const l of targetLogs) {
          const nextSnap = {
            ...(l.record_snapshot || {}),
            status: "Forwarded to Admin by TL",
            forwarded_to_admin: true,
            forwarded_by_tl_id: actor.id,
            forwarded_by_tl_name: actor.full_name,
            forwarded_at: new Date().toISOString()
          };
          await db.from("audit_logs").update({ record_snapshot: nextSnap }).eq("id", l.id);
        }

        return NextResponse.json({ success: true, forwardedCount: targetLogs.length });
      }
    }

    if (entity === "profile" && action === "lock_all") {
      const lock = Boolean(payload.is_locked);
      const { data: pAll } = await db.from("profiles").select("id, role, team_leader_id, team_leader_ids");
      const targetSmms = (pAll || []).filter((p: any) => {
        if (p.role === "admin") return false;
        if (actor.role === "team_leader" && payload.scope === "squad") {
          return p.team_leader_id === actor.id || (p.team_leader_ids || []).includes(actor.id);
        }
        return p.role === "smm";
      });
      const sIds = targetSmms.map((p: any) => p.id);
      if (sIds.length) await db.from("profiles").update({ is_locked: lock }).in("id", sIds);

      const { data: aAll } = await db.from("social_assets").select("id, smm_id");
      const aIds = (aAll || [])
        .filter((a: any) => (actor.role === "team_leader" && payload.scope === "squad" ? sIds.includes(a.smm_id) : true))
        .map((a: any) => a.id);
      if (aIds.length) await db.from("social_assets").update({ status: lock ? "locked" : "active" }).in("id", aIds);

      await log(lock ? "LOCK_ALL" : "UNLOCK_ALL", "EMPLOYEE", "SUBMISSIONS", `${lock ? "🔒 Locked" : "🔓 Unlocked"} report submissions for ${sIds.length} SMMs`, { is_locked: lock, count: sIds.length });
      return NextResponse.json({ success: true, count: sIds.length, is_locked: lock });
    }

    if (entity === "profile" && action === "toggle_lock") {
      const lock = Boolean(payload.is_locked);
      const { data: u } = await db.from("profiles").update({ is_locked: lock }).eq("id", payload.targetId).select().maybeSingle();
      await db.from("social_assets").update({ status: lock ? "locked" : "active" }).eq("smm_id", payload.targetId);
      await log(lock ? "LOCK" : "UNLOCK", "EMPLOYEE", payload.targetId, `${lock ? "🔒 Locked" : "🔓 Unlocked"} report submissions for ${u?.full_name || payload.targetId}`, u || payload);
      return NextResponse.json({ success: true, is_locked: lock });
    }

    if (entity === "metric" && (action === "bulk_upsert" || action === "upsert")) {
      if (actor.role === "smm" && actor.is_locked) return NextResponse.json({ error: "Report submissions are locked" }, { status: 403 });
      const rows = action === "bulk_upsert" ? (payload.rows || []) : [payload];
      const saved: any[] = [];
      for (const r of rows) {
        if (r?.asset_id) saved.push(await saveMetricRow(db, r));
      }
      return NextResponse.json({ success: true, count: saved.length, saved });
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
