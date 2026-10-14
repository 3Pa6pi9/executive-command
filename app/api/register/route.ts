import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password, role, full_name, country, team_leader_id } = await request.json();
    
    if (!email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: "Please enter a valid email address (e.g., name@domain.com)" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // 1. Create the secure Auth User
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // 2. Create their Enterprise Profile
    const { error: profileError } = await adminSupabase.from('profiles').insert([{
      id: authData.user.id,
      role,
      full_name,
      country,
      team_leader_id: role === 'smm' ? team_leader_id : null
    }]);

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create profile: " + profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Server error during registration." }, { status: 500 });
  }
}
