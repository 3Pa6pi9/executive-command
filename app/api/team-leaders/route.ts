import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data } = await adminSupabase
      .from("profiles")
      .select("id, full_name, country")
      .eq("role", "team_leader")
      .order("full_name");

    return NextResponse.json({ teamLeaders: data || [] });
  } catch (err: any) {
    return NextResponse.json({ teamLeaders: [] }, { status: 500 });
  }
}
