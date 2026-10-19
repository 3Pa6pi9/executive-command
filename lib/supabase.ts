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

if (typeof window !== "undefined" && !(window as any).__execClientPatched) {
  (window as any).__execClientPatched = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("/api/")) {
      const path = window.location.pathname;
      const client = path.startsWith("/admin")
        ? adminSupabase
        : path.startsWith("/team-leader")
        ? tlSupabase
        : managerSupabase;
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        init = init || {};
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
      }
    }
    return origFetch(input, init);
  };

  setTimeout(() => {
    fetch("/api/crud", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.passwords) (window as any).__pwMap = j.passwords;
        if (j?.emails) (window as any).__emailMap = j.emails;
      })
      .catch(() => {});
  }, 250);

  document.addEventListener(
    "submit",
    (e: any) => {
      const btn = e.target?.querySelector?.('button[type="submit"]');
      if (btn && !btn.dataset.loading) {
        const orig = btn.innerHTML;
        btn.dataset.loading = "1";
        btn.innerHTML = "⏳ Processing...";
        btn.style.opacity = "0.7";
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.style.opacity = "1";
          delete btn.dataset.loading;
        }, 1600);
      }
    },
    true
  );
}
