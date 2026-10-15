import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: "command-center-admin-auth" },
});

export const tlSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: "command-center-tl-auth" },
});

export const smmSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: "fleet-manager-auth" },
});

// Keep backwards compatibility for / and /log
export const managerSupabase = smmSupabase;

// Instant cross-dashboard broadcast helper (works even before DB replication is toggled)
export async function broadcastRealtimeSync(source: string = "system") {
  try {
    const channel = smmSupabase.channel("executive-live-sync");
    await channel.send({
      type: "broadcast",
      event: "db-sync",
      payload: { source, timestamp: Date.now() },
    });
  } catch {
    // Ignore broadcast errors on unmounted channels
  }
}
