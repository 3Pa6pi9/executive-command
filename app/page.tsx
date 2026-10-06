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

  let timeFilteredLogs = logs;
  const now = new Date();
  if (dateFilter === "Today") timeFilteredLogs = logs.filter(l => new Date(l.created_at).toDateString() === now.toDateString());
  else if (dateFilter === "Week") timeFilteredLogs = logs.filter(l => new Date(l.created_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  else if (dateFilter === "Month") timeFilteredLogs = logs.filter(l => new Date(l.created_at).getMonth() === now.getMonth() && new Date(l.created_at).getFullYear() === now.getFullYear());
  
  const filteredLogs = selectedHandler === "All" ? timeFilteredLogs : timeFilteredLogs.filter(l => l.handler_name === selectedHandler);

  // MEL GRAPHS CALCULATIONS
  const totalReach = filteredLogs.reduce((sum, log) => sum + (log.reach || 0), 0);
  const totalViews = filteredLogs.reduce((sum, log) => sum + (log.views || 0), 0);
  const totalFollowers = filteredLogs.reduce((sum, log) => sum + (log.followers || 0), 0);
  const totalEngagement = filteredLogs.reduce((sum, log) => sum + (log.likes || 0) + (log.comments || 0) + (log.shares || 0), 0);
  
  const maxMetric = Math.max(totalReach, totalViews, totalFollowers, totalEngagement, 1);

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Securing Connection...</div>;
  if (!session || session.user.email !== "admin@executive-command.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100">
        <form onSubmit={handleAdminLogin} className="space-y-6 w-full max-w-md p-8 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center">Command Center</h1>
          <input type="password" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-white border border-zinc-800 text-center tracking-widest outline-none" />
          <button type="submit" className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-zinc-200 transition-all">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              Executive Command
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>
            </h1>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-zinc-500 hover:text-white">Sign Out</button>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-blue-500 outline-none">
              <option value="All">All Handlers</option>
              {Array.from(new Set(logs.map(l => l.handler_name))).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select value={dateFilter} onChange={(e: any) => setDateFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-blue-500 outline-none">
              <option value="All">All Time</option><option value="Today">Today</option><option value="Week">Last 7 Days</option><option value="Month">This Month</option>
            </select>
          </div>
        </div>

        {/* MEL GRAPHIC DASHBOARD */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* BAR CHARTS */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-center">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6">MEL Performance Metrics</h2>
            <div className="space-y-5">
              {[
                { label: "Total Reach", val: totalReach, color: "bg-blue-500" },
                { label: "Total Views", val: totalViews, color: "bg-emerald-500" },
                { label: "Total Followers Engaged", val: totalFollowers, color: "bg-purple-500" },
                { label: "Total Direct Engagement (Likes/Comments/Shares)", val: totalEngagement, color: "bg-amber-500" }
              ].map(stat => (
                <div key={stat.label} className="space-y-2 group">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-300 group-hover:text-white transition-colors">{stat.label}</span>
                    <span className="text-white">{stat.val.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${stat.color} transition-all duration-1000 ease-out`} style={{ width: `${(stat.val / maxMetric) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-4xl font-bold text-white">{filteredLogs.length}</span>
              <span className="text-xs uppercase font-bold text-zinc-500 mt-2">Total URLs Logged</span>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-4xl font-bold text-blue-400">{totalReach.toLocaleString()}</span>
              <span className="text-xs uppercase font-bold text-blue-500 mt-2">Aggregate Reach</span>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-4xl font-bold text-purple-400">{totalFollowers.toLocaleString()}</span>
              <span className="text-xs uppercase font-bold text-purple-500 mt-2">Follower Impact</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-4xl font-bold text-emerald-400">{totalViews.toLocaleString()}</span>
              <span className="text-xs uppercase font-bold text-emerald-500 mt-2">Verified Views</span>
            </div>
          </div>
        </div>

        {/* LOGS TABLE */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Time (EAT)</th>
                  <th className="px-6 py-4 font-medium">Handler</th>
                  <th className="px-6 py-4 font-medium">URL</th>
                  <th className="px-6 py-4 font-medium text-right">Metrics (F/R/V/L/C/S)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/80">
                    <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-100">{log.handler_name}</td>
                    <td className="px-6 py-4 max-w-[200px] truncate"><a href={log.url} target="_blank" className="hover:underline text-blue-400">{log.url}</a></td>
                    <td className="px-6 py-4 text-right text-xs font-mono text-zinc-400 whitespace-nowrap">
                      <span className="text-purple-400">F:{log.followers || 0}</span> / <span className="text-blue-400">R:{log.reach || 0}</span> / V:{log.views || 0} / L:{log.likes || 0} / C:{log.comments || 0} / S:{log.shares || 0}
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
