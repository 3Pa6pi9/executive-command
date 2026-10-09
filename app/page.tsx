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
  const [dailyTarget, setDailyTarget] = useState(20);
  const [motd, setMotd] = useState("");
  
  const [selectedHandler, setSelectedHandler] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Week" | "Month">("All");
  const [platformFilter, setPlatformFilter] = useState<"All" | "facebook" | "twitter">("All");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setIsCheckingAuth(false);
      if (session?.user?.email === "admin@executive-command.com") { fetchLogs(); fetchSettings(); }
    });
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => fetchLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.email]);

  const fetchLogs = async () => {
    const { data } = await supabase.from("campaign_links").select("*").order("created_at", { ascending: false });
    if (data) setLogs(data);
  };
  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("daily_target, motd").eq("id", 1).single();
    if (data) { setDailyTarget(data.daily_target); setMotd(data.motd || ""); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: "admin@executive-command.com", password: adminPasscode });
    if (error) setAuthStatus("Access Denied: Invalid Passcode."); else setAuthStatus("");
  };

  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));
  let baseLogs = logs;
  if (platformFilter !== "All") baseLogs = baseLogs.filter(l => (l.platform || 'facebook') === platformFilter);
  if (selectedHandler !== "All") baseLogs = baseLogs.filter(l => l.handler_name === selectedHandler);

  // --- AUTOMATED WEEK-OVER-WEEK GROWTH ENGINE ---
  const growthStats = uniqueHandlers.map(handler => {
    const hLogs = logs.filter(l => l.handler_name === handler && (l.platform || 'facebook') === 'twitter')
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (hLogs.length === 0) return null;
    const latest = hLogs[0];
    const previous = hLogs.find(l => new Date(latest.created_at).getTime() - new Date(l.created_at).getTime() > 86400000) || hLogs[1]; 
    const fDiff = previous ? latest.followers - previous.followers : 0;
    const vDiff = previous ? latest.views - previous.views : 0;
    return { handler, latest, fDiff, vDiff, hasPrev: !!previous };
  }).filter(Boolean);

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Securing Connection...</div>;
  if (!session || session.user.email !== "admin@executive-command.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <form onSubmit={handleAdminLogin} className="w-full max-w-md space-y-6 bg-zinc-950 p-8 rounded-2xl border border-zinc-800">
          <h1 className="text-2xl font-bold text-center">Command Center</h1>
          <input type="password" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-center text-white outline-none" />
          <button type="submit" className="w-full rounded-lg bg-white py-3 font-bold text-black hover:bg-zinc-200">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        
        <div className="flex justify-between items-end border-b border-zinc-800 pb-6">
          <div><h1 className="text-4xl font-bold text-white flex items-center gap-3">Executive Command <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span></h1></div>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-zinc-500 hover:text-white">Sign Out</button>
        </div>

        <div className="flex gap-3">
          <select value={platformFilter} onChange={(e: any) => setPlatformFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none"><option value="All">All Platforms</option><option value="facebook">Facebook</option><option value="twitter">Twitter / X</option></select>
          <select value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none"><option value="All">All Handlers</option>{uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}</select>
        </div>

        {/* WEEK-OVER-WEEK GROWTH ENGINE UI */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-6 flex items-center gap-2">X Account Growth Tracker (Week-Over-Week)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {growthStats.map((stat: any) => (
              <div key={stat.handler} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2"><span className="font-bold text-white text-lg">{stat.handler}</span><span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400">Account Log</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-zinc-500">Followers</span><div className="flex items-baseline gap-2"><span className="text-purple-400 font-mono text-xl">{stat.latest.followers}</span>{stat.hasPrev && <span className={`text-[10px] font-bold ${stat.fDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stat.fDiff >= 0 ? '+' : ''}{stat.fDiff}</span>}</div></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-zinc-500">Total Views</span><div className="flex items-baseline gap-2"><span className="text-blue-400 font-mono text-xl">{stat.latest.views}</span>{stat.hasPrev && <span className={`text-[10px] font-bold ${stat.vDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stat.vDiff >= 0 ? '+' : ''}{stat.vDiff}</span>}</div></div>
                </div>
              </div>
            ))}
            {growthStats.length === 0 && <div className="text-zinc-500 text-sm">No Twitter/X accounts logged yet.</div>}
          </div>
        </div>

        {/* RAW LOGS */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex justify-between items-center"><h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Raw Submissions Log</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500 border-b border-zinc-800">
                <tr><th className="px-6 py-4">Time (EAT)</th><th className="px-6 py-4">Handler</th><th className="px-6 py-4">Network</th><th className="px-6 py-4">Link</th><th className="px-6 py-4">Performance Data</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {baseLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/80 group">
                    <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute:'2-digit' })}</td>
                    <td className="px-6 py-4 font-bold text-zinc-100">{log.handler_name}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-[9px] font-bold rounded-full border ${log.platform === 'twitter' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>{log.platform === 'twitter' ? '𝕏 TWITTER' : 'f FACEBOOK'}</span></td>
                    <td className="px-6 py-4 max-w-[150px] truncate"><a href={log.url} target="_blank" className="hover:underline text-blue-400">{log.url}</a></td>
                    <td className="px-6 py-4">
                      {log.platform === 'twitter' ? (
                        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                          <span className="text-purple-400">Followers: {log.followers}</span><span className="text-blue-400">Views: {log.views}</span><span className="text-emerald-400">Posts: {log.post_count || 0}</span>
                          <span className="text-amber-400">Eng: {log.total_engagement || 0}</span><span className="text-zinc-400">Likes: {log.likes}</span><span className="text-zinc-400">Replies: {log.comments}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                          <span className="text-blue-400">Reach: {log.reach}</span><span className="text-emerald-400">Views: {log.views}</span><span className="text-purple-400">Followers: {log.followers}</span>
                          <span className="text-amber-400">Likes: {log.likes}</span><span className="text-amber-400">Comments: {log.comments}</span><span className="text-amber-400">Shares: {log.shares}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
