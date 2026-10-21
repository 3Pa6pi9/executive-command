import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function normalizeLoginEmail(raw: string, fallbackTag: string): string {
  const c = (raw || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!c) return "";
  if (!c.includes("@")) return `${c}@${fallbackTag}.executive.com`;
  if (c.endsWith("@smm") || c.endsWith("@tl") || c.endsWith("@admin")) return `${c}.executive.com`;
  const [l, d = ""] = c.split("@");
  return d.includes(".") ? c : `${l}@${d}.executive.com`;
}

const createIsolatedClient = (storageKey: string, defaultTag: string) => {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const origSignIn = client.auth.signInWithPassword.bind(client.auth);
  client.auth.signInWithPassword = async (creds: any) => {
    if (creds?.email) {
      const norm = normalizeLoginEmail(creds.email, defaultTag);
      const res = await origSignIn({ ...creds, email: norm });
      if (!res.error) return res;
    }
    return origSignIn(creds);
  };
  return client;
};

export const supabase = createIsolatedClient("sb-exec-default", "smm");
export const adminSupabase = createIsolatedClient("sb-exec-admin-v2", "admin");
export const tlSupabase = createIsolatedClient("sb-exec-tl-v2", "tl");
export const managerSupabase = createIsolatedClient("sb-exec-smm-v2", "smm");

function getTokenSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const p = window.location.pathname;
    const k = p.startsWith("/admin") ? "sb-exec-admin-v2" : p.startsWith("/team-leader") ? "sb-exec-tl-v2" : "sb-exec-smm-v2";
    const raw = window.localStorage.getItem(k) || window.localStorage.getItem("sb-exec-default");
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j?.access_token || j?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined" && !(window as any).__execSafeFetch) {
  (window as any).__execSafeFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("/api/")) {
      const tok = getTokenSync();
      if (tok) {
        init = init || {};
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${tok}` };
      }
    }
    return orig(input, init);
  };
}
