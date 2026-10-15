import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, payload } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Update User Profile Details (Name, Countries, Platforms, Team Leaders)
    if (action === "update_profile") {
      const { full_name, country, platforms, team_leader_ids } = payload;
      const updateData: any = { full_name, country };
      if (platforms) updateData.platforms = platforms;
      if (team_leader_ids && team_leader_ids.length > 0) {
        updateData.team_leader_ids = team_leader_ids;
        updateData.team_leader_id = team_leader_ids[0];
      }
      const { error } = await adminSupabase.from("profiles").update(updateData).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // Update Account Password
    if (action === "update_password") {
      const { newPassword } = payload;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }
      const { error } = await adminSupabase.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // Batch Lock / Unlock SMM Inputs (For Team Leader Squad or Global Admin)
    if (action === "batch_lock") {
      const { smmIds, is_locked } = payload;
      if (!smmIds || smmIds.length === 0) return NextResponse.json({ success: true });
      const { error } = await adminSupabase.from("profiles").update({ is_locked }).in("id", smmIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // Broadcast Campaign & Task to Multiple Assets
    if (action === "broadcast_directive") {
      const { assetIds, tl_campaign, tl_task } = payload;
      if (!assetIds || assetIds.length === 0) return NextResponse.json({ success: true });
      const updateObj: any = {};
      if (tl_campaign !== undefined && tl_campaign !== "") updateObj.tl_campaign = tl_campaign;
      if (tl_task !== undefined && tl_task !== "") updateObj.tl_task = tl_task;
      const { error } = await adminSupabase.from("social_assets").update(updateObj).in("id", assetIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // Admin: Change User Role or Delete User
    if (action === "admin_manage_user") {
      const { targetUserId, newRole, deleteUser } = payload;
      if (deleteUser) {
        await adminSupabase.auth.admin.deleteUser(targetUserId);
        return NextResponse.json({ success: true });
      }
      const { error } = await adminSupabase.from("profiles").update({ role: newRole }).eq("id", targetUserId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
