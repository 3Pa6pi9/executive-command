import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password, role, full_name, country, team_leader_id, team_leader_ids, platforms } = await request.json();
    
    if (!email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: "Please enter a valid email address (e.g., name@executive.com)" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const tlArray = team_leader_ids && team_leader_ids.length > 0 ? team_leader_ids : (team_leader_id ? [team_leader_id] : []);
    const primaryTl = tlArray.length > 0 ? tlArray[0] : null;

    const { error: profileError } = await adminSupabase.from('profiles').insert([{
      id: authData.user.id,
      role: role || 'smm',
      full_name,
      country,
      team_leader_id: role === 'smm' ? primaryTl : null,
      team_leader_ids: role === 'smm' ? tlArray : [],
      platforms: platforms || []
    }]);

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create profile: " + profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    return NextResponse.json({ error: "Server error during registration." }, { status: 500 });
  }
}
