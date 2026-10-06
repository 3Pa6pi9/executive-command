import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { handler_name, password } = await request.json();

    if (!handler_name || password.length < 6) {
      return NextResponse.json({ error: "Invalid Handler ID or Passcode (min 6 chars)." }, { status: 400 });
    }

    // Bypass public restrictions using the Service Role Key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const email = `${handler_name.toLowerCase().trim()}@executive-command.com`;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm to bypass email limits
    });

    if (error) throw error;

    return NextResponse.json({ success: true, user: data.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}