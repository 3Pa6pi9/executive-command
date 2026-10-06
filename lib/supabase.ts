import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ADMIN CLIENT: Uses a dedicated storage key so it never mixes with managers
export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "command-center-admin-auth",
  }
});

// MANAGER CLIENT: Uses a separate storage key
export const managerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "fleet-manager-auth",
  }
});