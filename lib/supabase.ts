import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const createIsolatedClient = (storageKey: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

export const supabase = createIsolatedClient("sb-exec-default");
export const adminSupabase = createIsolatedClient("sb-exec-admin-v2");
export const tlSupabase = createIsolatedClient("sb-exec-tl-v2");
export const managerSupabase = createIsolatedClient("sb-exec-smm-v2");

function getStoredTokenSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const path = window.location.pathname;
    const key = path.startsWith("/admin")
      ? "sb-exec-admin-v2"
      : path.startsWith("/team-leader")
      ? "sb-exec-tl-v2"
      : "sb-exec-smm-v2";
    const raw = window.localStorage.getItem(key) || window.localStorage.getItem("sb-exec-default");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch (_e) {
    return null;
  }
}

if (typeof window !== "undefined" && !(window as any).__execFetchSafePatched) {
  (window as any).__execFetchSafePatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("/api/")) {
      const token = getStoredTokenSync();
      if (token) {
        init = init || {};
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
      }
    }
    return origFetch(input, init);
  };
}
