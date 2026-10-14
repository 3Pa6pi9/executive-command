import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, password, role, full_name, country, team_leader_id } = await request.json();
    
    // Create the secure Auth User
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // Create their Enterprise Profile
    const { error: profileError } = await adminSupabase.from('profiles').insert([{
      id: authData.user.id,
      role,
      full_name,
      country,
      team_leader_id: role === 'smm' ? team_leader_id : null
    }]);

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create profile." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Server error during registration." }, { status: 500 });
  }
}
