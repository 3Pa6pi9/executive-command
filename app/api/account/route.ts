import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const supabaseAdmin = getAdminClient();

    if (action === "update_profile") {
      const { id, full_name, country, platforms, team_leader_id, team_leader_ids, role, is_locked } = body;
      const updatePayload: Record<string, any> = {};
      if (full_name !== undefined) updatePayload.full_name = full_name;
      if (country !== undefined) updatePayload.country = country;
      if (platforms !== undefined) updatePayload.platforms = platforms;
      if (team_leader_id !== undefined) updatePayload.team_leader_id = team_leader_id;
      if (team_leader_ids !== undefined) updatePayload.team_leader_ids = team_leader_ids;
      if (role !== undefined) updatePayload.role = role;
      if (is_locked !== undefined) updatePayload.is_locked = is_locked;

      const { error } = await supabaseAdmin.from("profiles").update(updatePayload).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "update_auth") {
      const { id, email, password } = body;
      const authPayload: Record<string, any> = {};
      if (email && email.trim()) authPayload.email = email.trim().toLowerCase();
      if (password && password.length >= 6) authPayload.password = password;

      if (Object.keys(authPayload).length === 0) {
        return NextResponse.json({ error: "Provide a valid email or password (min 6 chars)." }, { status: 400 });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, authPayload);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_user") {
      const { id } = body;
      await supabaseAdmin.from("social_assets").delete().eq("smm_id", id);
      await supabaseAdmin.from("profiles").delete().eq("id", id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "bulk_lock_smms") {
      const { is_locked, smm_ids } = body;
      let query = supabaseAdmin.from("profiles").update({ is_locked }).eq("role", "smm");
      if (Array.isArray(smm_ids) && smm_ids.length > 0) {
        query = query.in("id", smm_ids);
      }
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "bulk_squad_directive") {
      const { asset_ids, tl_campaign, tl_task, tl_comment } = body;
      if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
        return NextResponse.json({ error: "No assets found to update." }, { status: 400 });
      }
      const payload: Record<string, any> = {};
      if (tl_campaign !== undefined && tl_campaign !== "") payload.tl_campaign = tl_campaign;
      if (tl_task !== undefined && tl_task !== "") payload.tl_task = tl_task;
      if (tl_comment !== undefined && tl_comment !== "") payload.tl_comment = tl_comment;

      const { error } = await supabaseAdmin.from("social_assets").update(payload).in("id", asset_ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "update_system_settings") {
      const { motd, daily_target } = body;
      const { error } = await supabaseAdmin
        .from("system_settings")
        .upsert([{ id: 1, motd: motd ?? "", daily_target: Number(daily_target) || 20 }], { onConflict: "id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
