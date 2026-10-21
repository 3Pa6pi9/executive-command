import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername } from "@/lib/constants";

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function safeInsert(db: any, table: string, row: any) {
  const payload = { ...row };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await db.from(table).insert([payload]).select().maybeSingle();
    if (!error) return { data, error: null };
    const m = error.message?.match(/Could not find the '([^']+)' column/);
    if (m && m[1] && m[1] in payload) {
      delete payload[m[1]];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: { message: "Max column retry exceeded" } };
}

async function safeUpdate(db: any, table: string, row: any, matchCol: string, matchVal: any) {
  const payload = { ...row };
  delete payload.id;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await db.from(table).update(payload).eq(matchCol, matchVal).select().maybeSingle();
    if (!error) return { data, error: null };
    const m = error.message?.match(/Could not find the '([^']+)' column/);
    if (m && m[1] && m[1] in payload) {
      delete payload[m[1]];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: { message: "Max column retry exceeded" } };
}

async function upsertMetricRowSafely(db: any, row: any) {
  if (!row?.asset_id || !row?.week_of) return null;
  const { data: existing } = await db
    .from("weekly_metrics")
    .select("id")
    .eq("asset_id", row.asset_id)
    .eq("week_of", row.week_of)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await safeUpdate(db, "weekly_metrics", row, "id", existing.id);
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await safeInsert(db, "weekly_metrics", row);
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function GET() {
  try {
    const db = getDb();
    const [{ data: logsRaw }, { data: profs }, { data: assets }, { data: authList }, { data: metrics }] = await Promise.all([
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(600),
      db.from("profiles").select("*").order("created_at", { ascending: false }),
      db.from("social_assets").select("*").order("created_at", { ascending: false }),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("weekly_metrics").select("*").order("week_of", { ascending: false }).limit(4000)
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

    const logs = workingLogs.map((l: any, idx: number) => {
      const snap = l.record_snapshot?.after || l.record_snapshot?.before || l.record_snapshot || {};
      const matchedAsset = assetList.find((a: any) => a.id === l.entity_id) || assetList[idx % Math.max(1, assetList.length)];
      const matchedProf = profList.find((p: any) => p.id === l.entity_id) || profList[idx % Math.max(1, profList.length)];

      const act = (l.action || "CREATE").toUpperCase();
      const ent = (l.entity_type || (snap.account_id ? "ASSET" : snap.full_name ? "EMPLOYEE" : "ASSET")).toUpperCase();
      const actor = l.actor_name || matchedProf?.full_name || "Master Admin";

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
      const smmOwner = profList.find((p: any) => p.id === finalSnap?.smm_id);
      const tlOwner = profList.find((p: any) => p.id === (finalSnap?.team_leader_id || smmOwner?.team_leader_id));

      return {
        ...l,
        action: act,
        entity_type: ent,
        actor_name: actor,
        actor_role: l.actor_role || "admin",
        summary: sum,
        details: sum,
        description: sum,
        record_snapshot: {
          ...finalSnap,
          _resolved_smm_name: smmOwner?.full_name || undefined,
          _resolved_tl_name: tlOwner?.full_name || undefined,
          _login_username: finalSnap?.id ? emails[finalSnap.id] : undefined,
          _current_password: finalSnap?.id ? passwords[finalSnap.id] : undefined
        }
      };
    });

    return NextResponse.json({ logs, passwords, emails, profiles: profList, assets: assetList, metrics: metrics || [] });
  } catch (e: any) {
    return NextResponse.json({ logs: [], passwords: {}, emails: {}, profiles: [], assets: [], metrics: [], error: e.message });
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
    if (!actor) {
      const { data: firstAdmin } = await db.from("profiles").select("*").eq("role", "admin").limit(1).maybeSingle();
      actor = firstAdmin || { id: actorId || "admin", full_name: "Master Admin", role: "admin" };
    }

    const log = async (act: string, ent: string, id: string, sum: string, snap: any) => {
      try {
        await db.from("audit_logs").insert([{
          actor_id: actor.id, actor_name: actor.full_name, actor_role: actor.role,
          action: act, entity_type: ent, entity_id: id, summary: sum, record_snapshot: snap || {}
        }]);
      } catch (_e) {}
    };

    if (entity === "profile" && action === "lock_all") {
      const lockState = Boolean(payload.is_locked);
      const { data: allProfs } = await db.from("profiles").select("id, role");
      const smmIds = (allProfs || []).filter((p: any) => p.role !== "admin").map((p: any) => p.id);
      if (smmIds.length > 0) {
        await db.from("profiles").update({ is_locked: lockState }).in("id", smmIds);
      }
      const { data: allAssets } = await db.from("social_assets").select("id");
      const assetIds = (allAssets || []).map((a: any) => a.id);
      if (assetIds.length > 0) {
        await db.from("social_assets").update({ status: lockState ? "locked" : "active" }).in("id", assetIds);
      }
      await log(
        lockState ? "LOCK_ALL" : "UNLOCK_ALL",
        "EMPLOYEE",
        "ALL_ACCOUNTS",
        `${lockState ? "🔒 Locked" : "🔓 Unlocked"} all ${smmIds.length} staff profiles and ${assetIds.length} social assets`,
        { is_locked: lockState, staff_count: smmIds.length, asset_count: assetIds.length }
      );
      return NextResponse.json({ success: true, count: smmIds.length, assetCount: assetIds.length, is_locked: lockState });
    }

    if (entity === "profile" && action === "toggle_lock") {
      const lockState = Boolean(payload.is_locked);
      const { data: updated } = await db.from("profiles").update({ is_locked: lockState }).eq("id", payload.targetId).select().maybeSingle();
      await db.from("social_assets").update({ status: lockState ? "locked" : "active" }).eq("smm_id", payload.targetId);
      await log(lockState ? "LOCK" : "UNLOCK", "EMPLOYEE", payload.targetId, `${lockState ? "🔒 Locked" : "🔓 Unlocked"} staff & assets: ${updated?.full_name || payload.targetId}`, updated || payload);
      return NextResponse.json({ success: true, is_locked: lockState });
    }

    if (entity === "asset" && action === "toggle_lock") {
      const lockState = Boolean(payload.is_locked);
      const nextStatus = lockState ? "locked" : "active";
      const { data: updated } = await db.from("social_assets").update({ status: nextStatus }).eq("id", payload.id).select().maybeSingle();
      await log(lockState ? "LOCK" : "UNLOCK", "ASSET", payload.id, `${lockState ? "🔒 Locked" : "🔓 Unlocked"} asset: [${(updated?.platform || "").toUpperCase()}] ${updated?.bio || updated?.account_id}`, updated || payload);
      return NextResponse.json({ success: true, status: nextStatus });
    }

    if (entity === "metric" && action === "bulk_upsert") {
      if (actor.role === "smm" && actor.is_locked) {
        return NextResponse.json({ error: "Your account is locked by the Administrator." }, { status: 403 });
      }
      const rows = (payload.rows || []).filter((r: any) => r.asset_id && r.week_of);
      const saved: any[] = [];
      for (const row of rows) {
        const res = await upsertMetricRowSafely(db, row);
        if (res) saved.push(res);
      }
      await log(
        "UPSERT",
        "METRIC",
        "BATCH",
        `Saved weekly performance & post rate for ${saved.length} accounts (Week of ${rows[0]?.week_of || "current"})`,
        { count: saved.length, week_of: rows[0]?.week_of, sample: rows.slice(0, 5) }
      );
      return NextResponse.json({ success: true, count: saved.length, saved });
    }

    if (entity === "metric" && action === "upsert") {
      const saved = await upsertMetricRowSafely(db, payload);
      await log("UPSERT", "METRIC", saved?.id || payload.asset_id, `Logged weekly performance (${payload.week_of})`, saved || payload);
      return NextResponse.json({ success: true, metric: saved });
    }

    if (entity === "metric" && action === "delete") {
      await db.from("weekly_metrics").delete().eq("id", payload.id);
      await log("DELETE", "METRIC", payload.id, `Deleted weekly metric record ${payload.id}`, payload);
      return NextResponse.json({ success: true });
    }

    if (entity === "audit" && action === "restore") {
      const { data: en } = await db.from("audit_logs").select("*").eq("id", payload.logId).maybeSingle();
      const rawSnap = en?.record_snapshot?.before || en?.record_snapshot || {};
      const s = { ...rawSnap };
      delete s._resolved_smm_name;
      delete s._resolved_tl_name;
      delete s._login_username;
      delete s._current_password;
      if (!s || Object.keys(s).length === 0) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      const t = en.entity_type === "ASSET" ? "social_assets" : en.entity_type === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      if (s.id) {
        const { data: ex } = await db.from(t).select("id").eq("id", s.id).maybeSingle();
        if (ex?.id) await safeUpdate(db, t, s, "id", s.id);
        else await safeInsert(db, t, s);
      } else {
        await safeInsert(db, t, s);
      }
      await log("RESTORE", en.entity_type, s.id || "ID", `Restored ${en.entity_type}: ${s.bio || s.account_id || s.full_name || s.id}`, s);
      return NextResponse.json({ success: true });
    }

    if (entity === "profile") {
      if (action === "create") {
        const role = actor.role === "team_leader" ? "smm" : payload.role || "smm";
        const email = normalizeAuthUsername(payload.email || payload.full_name, role === "team_leader" ? "tl" : role === "admin" ? "admin" : "smm");
        const pass = payload.password || (role === "admin" ? "Admin@2026!" : "Welcome@2026!");
        const { data: u, error: e } = await db.auth.admin.createUser({
          email, password: pass, email_confirm: true,
          user_metadata: { plain_password: pass }
        });
        if (e) return NextResponse.json({ error: e.message }, { status: 400 });
        const tlId = actor.role === "team_leader" ? actor.id : payload.team_leader_id || null;
        const rec = {
          id: u.user.id,
          role,
          full_name: payload.full_name,
          country: payload.country || "Kenya",
          team_leader_id: role === "smm" ? tlId : null,
          team_leader_ids: role === "smm" && tlId ? [tlId] : [],
          platforms: payload.platforms || ["twitter"],
          is_locked: Boolean(payload.is_locked)
        };
        await safeInsert(db, "profiles", rec);
        if (role === "team_leader" && Array.isArray(payload.assignedSmmIds) && payload.assignedSmmIds.length > 0) {
          await db.from("profiles").update({ team_leader_id: u.user.id }).in("id", payload.assignedSmmIds);
        }
        await log("CREATE", "EMPLOYEE", rec.id, `Added ${role.toUpperCase()}: ${rec.full_name} (${formatDisplayUsername(email)})`, { ...rec, email: formatDisplayUsername(email), plain_password: pass });
        return NextResponse.json({ success: true, profile: rec });
      }

      if (action === "update") {
        const { targetId, newPassword, newEmail, assignedSmmIds, assignedAssetIds, ...upd } = payload;
        await safeUpdate(db, "profiles", upd, "id", targetId);
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
        if (Array.isArray(assignedSmmIds)) {
          await db.from("profiles").update({ team_leader_id: targetId }).in("id", assignedSmmIds);
        }
        if (Array.isArray(assignedAssetIds)) {
          await db.from("social_assets").update({ smm_id: targetId }).in("id", assignedAssetIds);
        }
        await log("UPDATE", "EMPLOYEE", targetId, `Updated employee profile: ${upd.full_name || targetId}`, { ...upd, targetId });
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { data: oldP } = await db.from("profiles").select("*").eq("id", payload.targetId).maybeSingle();
        await db.from("profiles").delete().eq("id", payload.targetId);
        await db.auth.admin.deleteUser(payload.targetId);
        await log("DELETE", "EMPLOYEE", payload.targetId, `Deleted employee: ${oldP?.full_name || payload.targetId}`, oldP);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "asset") {
      const cl = { ...payload };
      delete cl.recovery_email;
      delete cl.recovery_password;
      delete cl.account_name;
      if (action === "create") {
        const { data: c, error } = await safeInsert(db, "social_assets", cl);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("CREATE", "ASSET", c.id, `Added [${(c.platform || "").toUpperCase()}] ${c.bio || c.account_id} (${c.account_id})`, c);
        return NextResponse.json({ success: true, asset: c });
      }
      if (action === "update") {
        const { id, ...f } = cl;
        const { data: a, error } = await safeUpdate(db, "social_assets", f, "id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await log("UPDATE", "ASSET", id, `Updated [${(a?.platform || "").toUpperCase()}] ${a?.bio || a?.account_id || id}`, a || f);
        return NextResponse.json({ success: true });
      }
      if (action === "delete") {
        const { data: oldA } = await db.from("social_assets").select("*").eq("id", payload.id).maybeSingle();
        await db.from("social_assets").delete().eq("id", payload.id);
        await log("DELETE", "ASSET", payload.id, `Deleted [${oldA?.platform?.toUpperCase() || "ASSET"}] ${oldA?.bio || oldA?.account_id || payload.id}`, oldA);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
