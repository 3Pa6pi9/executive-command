import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ACCOUNTS = [
  { email: "admin@executive.com", legacyEmail: "admin@executive.com", password: "Admin@2026!", role: "admin", full_name: "Master Admin", country: "Kenya, Nigeria, South Africa, UK" },
  { email: "jeff@tl.executive.com", legacyEmail: "jeff@executive.com", password: "Jeff@2026!", role: "team_leader", full_name: "Jeff", country: "UK, Malaysia" },
  { email: "ali@tl.executive.com", legacyEmail: "ali@executive.com", password: "Ali@2026!", role: "team_leader", full_name: "Ali", country: "Romania, France, Afghan" },
  { email: "erica@tl.executive.com", legacyEmail: "erica@executive.com", password: "Erica@2026!", role: "team_leader", full_name: "Erica", country: "South Africa" },
  { email: "mani@tl.executive.com", legacyEmail: "mani@executive.com", password: "Mani@2026!", role: "team_leader", full_name: "Mani", country: "South Africa, Germany" },
  { email: "jennifer@tl.executive.com", legacyEmail: "jennifer@executive.com", password: "Jennifer@2026!", role: "team_leader", full_name: "Jennifer", country: "Russia, Belurus" },
  { email: "beulah@tl.executive.com", legacyEmail: "beulah@executive.com", password: "Beulah@2026!", role: "team_leader", full_name: "Beulah", country: "Crotia, South Africa" },
  { email: "mamhmdur@tl.executive.com", legacyEmail: "mamhmdur@executive.com", password: "Mamhmdur@2026!", role: "team_leader", full_name: "Mamhmdur", country: "Serbia, New Serbia" },
  { email: "mae@tl.executive.com", legacyEmail: "mae@executive.com", password: "Mae@2026!", role: "team_leader", full_name: "Mae", country: "Kosavo, Greece" },
  { email: "josiah@tl.executive.com", legacyEmail: "josiah@executive.com", password: "Josiah@2026!", role: "team_leader", full_name: "Josiah", country: "Hungary, Kenya, Nigeria, Ghana, South Africa" }
];

export async function POST() {
  try {
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { count } = await adminSupabase.from("profiles").select("*", { count: "exact", head: true });
    if ((count || 0) >= 10) return NextResponse.json({ success: true, status: "already_seeded" });
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
    const existingMap = new Map((existingUsers?.users || []).map(u => [u.email?.toLowerCase(), u.id]));

    for (const acc of DEFAULT_ACCOUNTS) {
      let userId = existingMap.get(acc.email.toLowerCase());
      const legacyId = existingMap.get(acc.legacyEmail.toLowerCase());
      if (!userId && legacyId && acc.email !== acc.legacyEmail) {
        await adminSupabase.auth.admin.updateUserById(legacyId, { email: acc.email, email_confirm: true });
        userId = legacyId;
      }
      if (!userId) {
        const { data: created, error } = await adminSupabase.auth.admin.createUser({ email: acc.email, password: acc.password, email_confirm: true });
        if (!error && created?.user) userId = created.user.id;
      }
      if (userId) {
        await adminSupabase.from("profiles").upsert([{ id: userId, role: acc.role, full_name: acc.full_name, country: acc.country, platforms: ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"] }], { onConflict: "id" });
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
