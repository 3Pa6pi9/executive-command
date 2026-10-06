"use client";

import { adminSupabase as supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function ExecutiveDashboard() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [logs, setLogs] = useState<any[]>([]);
  
  const [selectedHandler, setSelectedHandler] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Week" | "Month">("All");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setIsCheckingAuth(false);
      if (session?.user?.email === "admin@executive-command.com") fetchLogs();
    });
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => { if (session?.user?.email === "admin@executive-command.com") fetchLogs(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.email]);

  const fetchLogs = async () => {
    const { data } = await supabase.from("campaign_links").select("*").order("created_at", { ascending: false });
    if (data) setLogs(data);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: "admin@executive-command.com", password: adminPasscode });
    if (error) setAuthStatus("Access Denied: Invalid Passcode."); else setAuthStatus("");
  };

  const checkURL = (rawUrl: string) => {
    try {
      const p = new URL(rawUrl.trim());
      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
      if (validHosts.includes(p.hostname)) {
        const path = p.pathname.toLowerCase();
        const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
        if ((p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg))) && !path.includes("/create")) return true;
      }
    } catch {}
    return false;
  };

  let timeFilteredLogs = logs;
  const now = new Date();
  if (dateFilter === "Today") timeFilteredLogs = logs.filter(l => new Date(l.created_at).toDateString() === now.toDateString());
  else if (dateFilter === "Week") timeFilteredLogs = logs.filter(l => new Date(l.created_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  
  const filteredLogs = selectedHandler === "All" ? timeFilteredLogs : timeFilteredLogs.filter(l => l.handler_name === selectedHandler);

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Securing Connection...</div>;
  if (!session || session.user.email !== "admin@executive-command.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100">
        <form onSubmit={handleAdminLogin} className="space-y-6 w-full max-w-md p-8 bg-zinc-950 border border-zinc-800 rounded-2xl">
          <h1 className="text-2xl font-bold text-center">Command Center</h1>
          <input type="password" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-white border border-zinc-800" />
          <button type="submit" className="w-full bg-white text-black py-3 rounded-lg font-bold">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <h1 className="text-4xl font-bold text-white mb-8">Executive Command</h1>
        
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-4">Time</th><th className="px-4 py-4">Handler</th><th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">URL</th><th className="px-4 py-4 text-right">Metrics (R/V/L/C/S/G)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredLogs.map((log) => {
                const isValid = checkURL(log.url);
                return (
                  <tr key={log.id} className="hover:bg-zinc-900/80">
                    <td className="px-4 py-4 text-zinc-400">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="px-4 py-4 font-medium text-zinc-100">{log.handler_name}</td>
                    <td className="px-4 py-4"><span className={`px-2 py-1 text-xs rounded-full ${isValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{isValid ? 'Valid' : 'Invalid'}</span></td>
                    <td className="px-4 py-4 max-w-[200px] truncate"><a href={log.url} target="_blank" className="hover:underline">{log.url}</a></td>
                    <td className="px-4 py-4 text-right text-xs text-zinc-400">
                      R:{log.reach || 0} / V:{log.views || 0} / L:{log.likes || 0} / C:{log.comments || 0} / S:{log.shares || 0} / G:{log.groups_joined || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
