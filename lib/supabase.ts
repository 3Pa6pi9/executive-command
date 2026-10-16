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
// Automatically attach signed Supabase JWT to all internal /api/* calls
if (typeof window !== "undefined" && !(window as any).__jwtFetchPatched) {
  (window as any).__jwtFetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("/api/")) {
      const { data } = await managerSupabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        init = init || {};
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
      }
    }
    return origFetch(input, init);
  };
}

// Global form submit loading indicator for every button in the app
if (typeof window !== "undefined" && !(window as any).__btnLoaderAttached) {
  (window as any).__btnLoaderAttached = true;
  document.addEventListener("submit", (e: any) => {
    const btn = e.target?.querySelector?.('button[type="submit"]');
    if (btn && !btn.dataset.loading) {
      const orig = btn.innerHTML;
      btn.dataset.loading = "1";
      btn.innerHTML = "⏳ Processing...";
      btn.style.opacity = "0.65";
      setTimeout(() => { btn.innerHTML = orig; btn.style.opacity = "1"; delete btn.dataset.loading; }, 1800);
    }
  }, true);
}
