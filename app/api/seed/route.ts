import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ACCOUNTS = [
  { email: "admin@executive.com", password: "Admin@2026!", role: "admin", full_name: "Master Admin", country: "Ethiopia, Kenya, Nigeria, UK" },
  { email: "jeff@executive.com", password: "Jeff@2026!", role: "team_leader", full_name: "Jeff", country: "UK, Malaysia" },
  { email: "ali@executive.com", password: "Ali@2026!", role: "team_leader", full_name: "Ali", country: "Romania, France, Afghan" },
  { email: "erica@executive.com", password: "Erica@2026!", role: "team_leader", full_name: "Erica", country: "South Africa" },
  { email: "mani@executive.com", password: "Mani@2026!", role: "team_leader", full_name: "Mani", country: "South Africa, Germany" },
  { email: "jennifer@executive.com", password: "Jennifer@2026!", role: "team_leader", full_name: "Jennifer", country: "Russia, Belurus" },
  { email: "beulah@executive.com", password: "Beulah@2026!", role: "team_leader", full_name: "Beulah", country: "Crotia, South Africa" },
  { email: "mamhmdur@executive.com", password: "Mamhmdur@2026!", role: "team_leader", full_name: "Mamhmdur", country: "Serbia, New Serbia" },
  { email: "mae@executive.com", password: "Mae@2026!", role: "team_leader", full_name: "Mae", country: "Kosavo, Greece" },
  { email: "josiah@executive.com", password: "Josiah@2026!", role: "team_leader", full_name: "Josiah", country: "Hungary, Ethiopia, Kenya, Nigeria, Ghana, South Africa" }
];

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingMap = new Map((existingUsers?.users || []).map(u => [u.email?.toLowerCase(), u.id]));

    for (const acc of DEFAULT_ACCOUNTS) {
      let userId = existingMap.get(acc.email.toLowerCase());
      if (!userId) {
        const { data: created, error } = await adminSupabase.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true
        });
        if (!error && created?.user) userId = created.user.id;
      }
      if (userId) {
        await adminSupabase.from("profiles").upsert([{
          id: userId,
          role: acc.role,
          full_name: acc.full_name,
          country: acc.country
        }], { onConflict: "id" });
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
