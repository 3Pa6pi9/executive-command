import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { actorId, action, entity, payload } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Verify Actor Identity & Hierarchy Role
    const { data: actor } = await adminSupabase.from("profiles").select("*").eq("id", actorId).single();
    if (!actor) return NextResponse.json({ error: "Unauthorized actor." }, { status: 403 });

    // =========================================================================
    // ENTITY: PROFILES (PERSONNEL CRUD)
    // =========================================================================
    if (entity === "profile") {
      // CREATE USER (Admin can create any role; TL can onboard SMMs into their own squad)
      if (action === "create") {
        if (actor.role === "smm") return NextResponse.json({ error: "SMMs cannot create personnel." }, { status: 403 });
        const targetRole = actor.role === "team_leader" ? "smm" : (payload.role || "smm");

        const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: payload.email.toLowerCase().trim(),
          password: payload.password,
          email_confirm: true
        });
        if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

        const tlId = actor.role === "team_leader" ? actor.id : (payload.team_leader_id || null);
        const tlIds = actor.role === "team_leader" ? [actor.id] : (payload.team_leader_ids || (tlId ? [tlId] : []));

        const { error: profErr } = await adminSupabase.from("profiles").insert([{
          id: authData.user.id,
          role: targetRole,
          full_name: payload.full_name,
          country: payload.country || "Africa",
          team_leader_id: targetRole === "smm" ? tlId : null,
          team_leader_ids: targetRole === "smm" ? tlIds : [],
          platforms: payload.platforms || ["twitter"]
        }]);

        if (profErr) {
          await adminSupabase.auth.admin.deleteUser(authData.user.id);
          return NextResponse.json({ error: profErr.message }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      // UPDATE USER PROFILE
      if (action === "update") {
        const { targetId, full_name, country, role, team_leader_id, platforms, is_locked } = payload;
        if (actor.role === "smm" && actor.id !== targetId) {
          return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }
        const updateObj: any = {};
        if (full_name !== undefined) updateObj.full_name = full_name;
        if (country !== undefined) updateObj.country = country;
        if (platforms !== undefined) updateObj.platforms = platforms;
        if (is_locked !== undefined && actor.role !== "smm") updateObj.is_locked = is_locked;
        if (actor.role === "admin") {
          if (role !== undefined) updateObj.role = role;
          if (team_leader_id !== undefined) {
            updateObj.team_leader_id = team_leader_id;
            updateObj.team_leader_ids = team_leader_id ? [team_leader_id] : [];
          }
        }
        const { error } = await adminSupabase.from("profiles").update(updateObj).eq("id", targetId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      // DETACH SMM FROM TEAM LEADER SQUAD (TL Action)
      if (action === "remove_from_squad") {
        if (actor.role !== "team_leader" && actor.role !== "admin") {
          return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }
        const { targetId, tlId } = payload;
        const { data: smm } = await adminSupabase.from("profiles").select("*").eq("id", targetId).single();
        if (!smm) return NextResponse.json({ error: "SMM not found." }, { status: 404 });

        const updatedIds = (smm.team_leader_ids || []).filter((id: string) => id !== tlId);
        const nextPrimary = updatedIds.length > 0 ? updatedIds[0] : null;
        await adminSupabase.from("profiles").update({
          team_leader_id: smm.team_leader_id === tlId ? nextPrimary : smm.team_leader_id,
          team_leader_ids: updatedIds
        }).eq("id", targetId);
        return NextResponse.json({ success: true });
      }

      // DELETE USER PERMANENTLY (Admin Only)
      if (action === "delete") {
        if (actor.role !== "admin") return NextResponse.json({ error: "Only Admins can permanently delete users." }, { status: 403 });
        const { targetId } = payload;
        const { error } = await adminSupabase.auth.admin.deleteUser(targetId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }
    }

    // =========================================================================
    // ENTITY: SOCIAL ASSETS CRUD
    // =========================================================================
    if (entity === "asset") {
      if (action === "create") {
        const { error } = await adminSupabase.from("social_assets").insert([payload]);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      if (action === "update") {
        const { id, ...updateFields } = payload;
        const { error } = await adminSupabase.from("social_assets").update(updateFields).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { id } = payload;
        const { error } = await adminSupabase.from("social_assets").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }
    }

    // =========================================================================
    // ENTITY: WEEKLY METRICS CRUD
    // =========================================================================
    if (entity === "metric") {
      if (actor.role === "smm" && actor.is_locked) {
        return NextResponse.json({ error: "Your weekly metric input is locked by your Team Leader." }, { status: 403 });
      }

      if (action === "upsert") {
        const { error } = await adminSupabase.from("weekly_metrics").upsert([payload], { onConflict: "asset_id,week_of" });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      if (action === "update") {
        const { id, ...fields } = payload;
        const { error } = await adminSupabase.from("weekly_metrics").update(fields).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        const { id } = payload;
        const { error } = await adminSupabase.from("weekly_metrics").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid CRUD operation." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
