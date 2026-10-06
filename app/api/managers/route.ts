import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Bypass public restrictions using the Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// CREATE ACCOUNT
export async function POST(request: Request) {
  try {
    const { handler_name, password } = await request.json();
    if (!handler_name || password.length < 6) return NextResponse.json({ error: "Invalid data." }, { status: 400 });

    const email = `${handler_name.toLowerCase().trim()}@executive-command.com`;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    
    if (error) throw error;
    return NextResponse.json({ success: true, user: data.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// RESET PASSWORD
export async function PUT(request: Request) {
  try {
    const { handler_name, new_password } = await request.json();
    if (!handler_name || new_password.length < 6) return NextResponse.json({ error: "Invalid data." }, { status: 400 });

    const email = `${handler_name.toLowerCase().trim()}@executive-command.com`;
    
    // Find the user ID by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find(u => u.email === email);
    if (!user) return NextResponse.json({ error: "Handler not found in database." }, { status: 404 });

    // Update their password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: new_password });
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// TERMINATE ACCOUNT
export async function DELETE(request: Request) {
  try {
    const { handler_name } = await request.json();
    const email = `${handler_name.toLowerCase().trim()}@executive-command.com`;
    
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find(u => u.email === email);
    if (!user) return NextResponse.json({ error: "Handler not found." }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}