import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthUsername, formatDisplayUsername, getAssetAccountName } from "@/lib/constants";
import fs from "fs";

const ARCHIVE_FILE = "/tmp/executive_archive_ledger.json";
const MILESTONE_FILE = "/tmp/executive_milestones.json";
const ASSET_NAMES_FILE = "/tmp/executive_asset_names.json";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function readLocalFileJson(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {}
  return [];
}

function writeLocalFileJson(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
  } catch {}
}

function readAssetNameMap(): Record<string, string> {
  try {
    if (fs.existsSync(ASSET_NAMES_FILE)) {
      return JSON.parse(fs.readFileSync(ASSET_NAMES_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function saveAssetName(assetId: string, accountName?: string) {
  if (!assetId || !accountName) return;
  try {
    const map = readAssetNameMap();
    map[assetId] = accountName.trim();
    fs.writeFileSync(ASSET_NAMES_FILE, JSON.stringify(map), "utf8");
  } catch {}
}

async function readJsonSlot(adminSupabase: any, slotId: number, fallbackFile: string): Promise<any[]> {
  const fileItems = readLocalFileJson(fallbackFile);
  try {
    const { data } = await adminSupabase.from("system_settings").select("motd").eq("id", slotId).maybeSingle();
    if (data?.motd) {
      const dbItems = JSON.parse(data.motd);
      return [...fileItems, ...dbItems];
    }
  } catch {}
  return fileItems;
}

async function writeJsonSlot(adminSupabase: any, slotId: number, fallbackFile: string, arr: any[]) {
  writeLocalFileJson(fallbackFile, arr);
  try {
    await adminSupabase
      .from("system_settings")
      .upsert([{ id: slotId, daily_target: 0, motd: JSON.stringify(arr) }], { onConflict: "id" });
  } catch {}
}

export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    const [{ data: dbLogs }, storedLogs, milestones, { data: profs }, { data: assets }, { data: metrics }] =
      await Promise.all([
        adminSupabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(800),
        readJsonSlot(adminSupabase, 999, ARCHIVE_FILE),
        readJsonSlot(adminSupabase, 998, MILESTONE_FILE),
        adminSupabase.from("profiles").select("*").order("created_at", { ascending: false }),
        adminSupabase.from("social_assets").select("*").order("created_at", { ascending: false }),
        adminSupabase.from("weekly_metrics").select("*").order("week_of", { ascending: false }).limit(400),
      ]);

    const nameMap = readAssetNameMap();
    const combined: any[] = [...(storedLogs || []), ...(dbLogs || [])];
    const seenIds = new Set(combined.map((x) => x.id));

    for (const a of assets || []) {
      const accName = a.account_name || nameMap[a.id] || getAssetAccountName(a);
      const owner = (profs || []).find((p: any) => p.id === a.smm_id);
      const isSusp = a.status === "suspended";
      const stateId = `state-${a.id}-${a.status}`;
      if (!seenIds.has(stateId)) {
        combined.push({
          id: stateId,
          created_at: a.updated_at || a.created_at || new Date().toISOString(),
          actor_id: a.smm_id,
          actor_name: owner?.full_name || "Handler",
          actor_role: "smm",
          action: isSusp ? "SUSPENDED" : "ACTIVE",
          entity_type: "ASSET",
          entity_id: a.id,
          summary: `${isSusp ? "Account Suspended" : "Account Active"}: ${accName} (${a.account_id}) on ${(a.platform || "").toUpperCase()}`,
          record_snapshot: { ...a, account_name: accName },
        });
        seenIds.add(stateId);
      }
    }

    for (const p of profs || []) {
      const empId = `emp-${p.id}-${p.is_locked ? "locked" : "open"}`;
      if (!seenIds.has(empId)) {
        combined.push({
          id: empId,
          created_at: p.created_at || new Date().toISOString(),
          actor_id: p.id,
          actor_name: p.full_name || "System",
          actor_role: p.role || "smm",
          action: p.is_locked ? "LOCKED" : "CREATE",
          entity_type: "EMPLOYEE",
          entity_id: p.id,
          summary: `${String(p.role || "smm").toUpperCase()}: ${p.full_name} (${p.country || "Global"}) ${p.is_locked ? "[LOCKED]" : ""}`,
          record_snapshot: p,
        });
        seenIds.add(empId);
      }
    }

    for (const m of metrics || []) {
      const metId = `met-${m.id}`;
      if (!seenIds.has(metId)) {
        const asset = (assets || []).find((a: any) => a.id === m.asset_id);
        const accName = asset ? asset.account_name || nameMap[asset.id] || getAssetAccountName(asset) : "Account";
        combined.push({
          id: metId,
          created_at: m.created_at || `${m.week_of}T12:00:00.000Z`,
          actor_id: m.asset_id,
          actor_name: accName,
          actor_role: "smm",
          action: "UPSERT",
          entity_type: "METRIC",
          entity_id: m.id,
          summary: `Weekly Metrics (${m.week_of}) for ${accName}: ${(m.impressions || 0).toLocaleString()} Views, ${(m.likes || 0).toLocaleString()} Likes, ${(m.posts_published || 0).toLocaleString()} Posts`,
          record_snapshot: m,
        });
        seenIds.add(metId);
      }
    }

    combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return NextResponse.json({ logs: combined, milestones: milestones || [], assetNames: nameMap });
  } catch (err: any) {
    return NextResponse.json({ logs: readLocalFileJson(ARCHIVE_FILE), milestones: [], error: err.message }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const { actorId, action, entity, payload } = await request.json();
    const adminSupabase = getAdminClient();

    const { data: actor } = await adminSupabase.from("profiles").select("*").eq("id", actorId).single();
    if (!actor) return NextResponse.json({ error: "Unauthorized user." }, { status: 403 });

    const logAudit = async (act: string, ent: string, entId: string, summary: string, snapshot: any) => {
      const entry = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: act,
        entity_type: ent,
        entity_id: entId,
        summary,
        record_snapshot: snapshot || {},
      };
      const prev = await readJsonSlot(adminSupabase, 999, ARCHIVE_FILE);
      await writeJsonSlot(adminSupabase, 999, ARCHIVE_FILE, [entry, ...prev].slice(0, 400));
      try {
        const { id, ...dbRow } = entry;
        await adminSupabase.from("audit_logs").insert([dbRow]);
      } catch {}
    };

    if (entity === "milestone") {
      const current = await readJsonSlot(adminSupabase, 998, MILESTONE_FILE);
      if (action === "create") {
        const item = {
          id: `ms-${Date.now()}`,
          title: payload.title,
          metric: payload.metric || "engagements",
          target: Number(payload.target || 5000),
          icon: payload.icon || "🏆",
          desc: payload.desc || `Target: ${Number(payload.target || 5000).toLocaleString()} ${payload.metric}`,
        };
        const next = [item, ...current];
        await writeJsonSlot(adminSupabase, 998, MILESTONE_FILE, next);
        await logAudit("CREATE", "MILESTONE", item.id, `Created Milestone: ${item.title}`, item);
        return NextResponse.json({ success: true, milestones: next });
      }
      if (action === "delete") {
        const next = current.filter((m: any) => m.id !== payload.id);
        await writeJsonSlot(adminSupabase, 998, MILESTONE_FILE, next);
        return NextResponse.json({ success: true, milestones: next });
      }
    }

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
            tl_campaign: topic,
            tl_task: direction,
            tl_comment: `Assigned by ${actor.full_name} (${new Date().toLocaleDateString()})`,
          })
          .in("id", matchingIds);
      }
      await logAudit("CAMPAIGN", "ASSET", "CAMPAIGN", `Assigned Campaign "${topic}" to ${matchingIds.length} Accounts`, payload);
      return NextResponse.json({ success: true, count: matchingIds.length });
    }

    if (entity === "audit" && action === "restore") {
      const { snapshot, entityType } = payload;
      if (!snapshot) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      const tbl = entityType === "ASSET" ? "social_assets" : entityType === "EMPLOYEE" ? "profiles" : "weekly_metrics";
      const { account_name, language, ...safeSnap } = snapshot;
      await adminSupabase.from(tbl).upsert([safeSnap]);
      await logAudit("RESTORE", entityType || "ASSET", snapshot.id, `Restored ${entityType} from Archives`, snapshot);
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
        const actType = is_locked !== undefined ? (is_locked ? "LOCKED" : "UNLOCKED") : "UPDATE";
        const desc = is_locked !== undefined ? `${is_locked ? "Locked" : "Unlocked"} SMM: ${before?.full_name}` : `Updated profile: ${full_name || before?.full_name}`;
        await logAudit(actType, "EMPLOYEE", targetId, desc, { before, after: upd });
        return NextResponse.json({ success: true });
      }

      if (action === "batch_lock") {
        const { smmIds, is_locked } = payload;
        let q = adminSupabase.from("profiles").update({ is_locked }).eq("role", "smm");
        if (Array.isArray(smmIds) && smmIds.length > 0) q = q.in("id", smmIds);
        await q;
        await logAudit(is_locked ? "LOCKED" : "UNLOCKED", "EMPLOYEE", "SQUAD", `${is_locked ? "Locked" : "Unlocked"} SMM metric inputs`, payload);
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
        const { language, account_name, ...dbPayload } = payload;
        // Store Account Name in project_name if not set so it persists natively in Supabase social_assets
        const finalProjectName = account_name ? account_name.trim() : dbPayload.project_name || dbPayload.account_id;
        const insertObj = { ...dbPayload, project_name: finalProjectName };

        let { data: created, error } = await adminSupabase
          .from("social_assets")
          .insert([{ ...insertObj, ...(language ? { language } : {}), ...(account_name ? { account_name } : {}) }])
          .select()
          .single();

        if (error) {
          const retry = await adminSupabase.from("social_assets").insert([insertObj]).select().single();
          created = retry.data;
          error = retry.error;
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        if (created?.id && account_name) saveAssetName(created.id, account_name);

        await logAudit("CREATE", "ASSET", created.id, `Registered Account: ${account_name || created.account_id} (${created.platform.toUpperCase()})`, { ...created, account_name });
        return NextResponse.json({ success: true, asset: { ...created, account_name: account_name || finalProjectName } });
      }

      if (action === "bulk_create") {
        const cleanItems = (payload.items || []).map(({ language, account_name, ...rest }: any) => ({
          ...rest,
          project_name: account_name || rest.project_name || rest.account_id,
        }));
        const { data: ins, error } = await adminSupabase.from("social_assets").insert(cleanItems).select();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("CREATE", "ASSET", "BULK", `Bulk registered ${ins?.length || 0} Accounts`, { count: ins?.length });
        return NextResponse.json({ success: true, count: ins?.length || 0 });
      }

      if (action === "update") {
        const { id, created_at, account_name, language, ...fields } = payload;
        if (account_name !== undefined) {
          fields.project_name = account_name;
          saveAssetName(id, account_name);
        }
        const { data: before } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        let { data: after, error } = await adminSupabase
          .from("social_assets")
          .update({ ...fields, ...(language ? { language } : {}), ...(account_name ? { account_name } : {}) })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          const retry = await adminSupabase.from("social_assets").update(fields).eq("id", id).select().single();
          after = retry.data;
          error = retry.error;
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        const isStatusChange = fields.status && fields.status !== before?.status;
        const actTag = isStatusChange ? (fields.status === "suspended" ? "SUSPENDED" : "ACTIVE") : "UPDATE";
        const accLabel = account_name || getAssetAccountName(after);
        const msg = isStatusChange
          ? `${fields.status === "suspended" ? "Suspended" : "Activated"} Account: ${accLabel} (${after.account_id}) by ${actor.full_name}`
          : `Updated Account: ${accLabel} (${after.account_id}) by ${actor.full_name}`;

        await logAudit(actTag, "ASSET", id, msg, { before, after: { ...after, account_name: accLabel } });
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { id } = payload;
        const { data: oldA } = await adminSupabase.from("social_assets").select("*").eq("id", id).single();
        await adminSupabase.from("social_assets").delete().eq("id", id);
        await logAudit("DELETE", "ASSET", id, `Deleted Account: ${getAssetAccountName(oldA)} (${oldA?.account_id})`, oldA);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "metric") {
      if (actor.role === "smm" && actor.is_locked) return NextResponse.json({ error: "Metric submission is locked by your Team Leader." }, { status: 403 });

      if (action === "upsert") {
        const { data: saved, error } = await adminSupabase.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPSERT", "METRIC", saved.id, `Saved weekly metrics (${payload.week_of})`, saved);
        return NextResponse.json({ success: true });
      }

      if (action === "batch_upsert") {
        const rows = (payload.rows || []).filter((r: any) => r.asset_id && r.week_of);
        if (rows.length === 0) return NextResponse.json({ error: "No metric rows provided." }, { status: 400 });
        const { data: saved, error } = await adminSupabase.from("weekly_metrics").upsert(rows, { onConflict: "asset_id,week_of" }).select();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await logAudit("UPSERT", "METRIC", "BATCH", `Submitted grouped weekly metrics for ${saved?.length || rows.length} accounts (${rows[0]?.week_of})`, { count: rows.length, week_of: rows[0]?.week_of });
        return NextResponse.json({ success: true, count: saved?.length || rows.length });
      }

      if (action === "delete") {
        const { id } = payload;
        const { data: oldM } = await adminSupabase.from("weekly_metrics").select("*").eq("id", id).single();
        await adminSupabase.from("weekly_metrics").delete().eq("id", id);
        await logAudit("DELETE", "METRIC", id, `Deleted weekly metric (${oldM?.week_of})`, oldM);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid operation." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
