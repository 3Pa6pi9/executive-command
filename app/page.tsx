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
  
  // Settings State
  const [dailyTarget, setDailyTarget] = useState(20);
  const [motd, setMotd] = useState("");
  const [maxPostAge, setMaxPostAge] = useState(24);
  const [newTargetInput, setNewTargetInput] = useState("");
  const [newMotdInput, setNewMotdInput] = useState("");
  const [newMaxPostAgeInput, setNewMaxPostAgeInput] = useState("");
  
  // Filters & Management State
  const [selectedHandler, setSelectedHandler] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Week" | "Month">("All");
  const [platformFilter, setPlatformFilter] = useState<"All" | "facebook" | "twitter">("All");
  const [isAddingManager, setIsAddingManager] = useState(false);
  const [newManagerId, setNewManagerId] = useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  
  // Security State
  const [newMasterPasscode, setNewMasterPasscode] = useState("");
  const [resetTarget, setResetTarget] = useState("");
  const [newHandlerPasscode, setNewHandlerPasscode] = useState("");
  const [terminateTarget, setTerminateTarget] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setIsCheckingAuth(false);
      if (session?.user?.email === "admin@executive-command.com") { fetchLogs(); fetchSettings(); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email === "admin@executive-command.com") { fetchLogs(); fetchSettings(); }
    });
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => { if (session?.user?.email === "admin@executive-command.com") fetchLogs(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => { if (session?.user?.email === "admin@executive-command.com") fetchSettings(); })
      .subscribe();
    return () => { subscription.unsubscribe(); supabase.removeChannel(channel); };
  }, [session?.user?.email]);

  const fetchLogs = async () => {
    const { data } = await supabase.from("campaign_links").select("*").order("created_at", { ascending: false });
    if (data) setLogs(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("daily_target, motd, max_post_age_hours").eq("id", 1).single();
    if (data) { setDailyTarget(data.daily_target); setMotd(data.motd || ""); setMaxPostAge(data.max_post_age_hours || 24); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStatus("Authenticating...");
    const { error } = await supabase.auth.signInWithPassword({ email: "admin@executive-command.com", password: adminPasscode });
    if (error) setAuthStatus("Access Denied: Invalid Passcode."); else setAuthStatus("");
  };

  // --- SETTINGS & SECURITY FUNCTIONS ---
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = newTargetInput ? parseInt(newTargetInput) : dailyTarget;
    const message = newMotdInput !== "" ? newMotdInput : motd;
    const maxAge = newMaxPostAgeInput ? parseInt(newMaxPostAgeInput) : maxPostAge;
    if (isNaN(num) || num < 1 || isNaN(maxAge) || maxAge < 1) return alert("Invalid targets or age limits.");
    const { error } = await supabase.from("system_settings").update({ daily_target: num, motd: message, max_post_age_hours: maxAge }).eq("id", 1);
    if (error) alert(`Error: ${error.message}`);
    else { setDailyTarget(num); setMotd(message); setMaxPostAge(maxAge); setNewTargetInput(""); setNewMotdInput(""); setNewMaxPostAgeInput(""); alert("Platform Variables Synced."); }
  };

  const handleUpdateMasterPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMasterPasscode.length < 6) return alert("Must be 6+ characters.");
    const { error } = await supabase.auth.updateUser({ password: newMasterPasscode });
    if (error) alert(`Error: ${error.message}`);
    else { alert("Master Passcode Updated Successfully."); setNewMasterPasscode(""); }
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/managers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handler_name: newManagerId, password: newManagerPassword }) });
    if (res.ok) { alert(`Manager provisioned.`); setNewManagerId(""); setNewManagerPassword(""); setIsAddingManager(false); } 
    else alert(`Error`);
  };

  const handleResetHandlerPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || newHandlerPasscode.length < 6) return alert("Select a handler and enter a 6+ char passcode.");
    const res = await fetch("/api/managers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handler_name: resetTarget, new_password: newHandlerPasscode }) });
    if (res.ok) { alert(`${resetTarget}'s passcode reset.`); setResetTarget(""); setNewHandlerPasscode(""); } 
    else alert("Failed to reset passcode.");
  };

  const handleTerminateHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminateTarget) return;
    if (!confirm(`CRITICAL WARNING: This permanently deletes ${terminateTarget}'s account AND wipes all submitted KPIs. Proceed?`)) return;
    await fetch("/api/managers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handler_name: terminateTarget }) });
    await supabase.from("campaign_links").delete().eq("handler_name", terminateTarget);
    alert(`Handler ${terminateTarget} terminated and purged.`);
    setTerminateTarget("");
    if (selectedHandler === terminateTarget) setSelectedHandler("All");
  };

  // --- TABLE ACTIONS ---
  const handleSaveEdit = async (id: string) => {
    await supabase.from("campaign_links").update({ url: editUrl }).eq("id", id);
    setEditingId(null); setEditUrl("");
  };
  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this KPI?")) return;
    await supabase.from("campaign_links").delete().eq("id", id);
  };

  const checkURL = (rawUrl: string, platformType: string = 'facebook') => {
    try {
      const p = new URL(rawUrl.trim());
      if (platformType === 'twitter') return p.hostname.includes('twitter.com') || p.hostname.includes('x.com');
      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
      if (validHosts.includes(p.hostname)) {
        const path = p.pathname.toLowerCase();
        const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
        if ((p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg))) && !path.includes("/create")) return true;
      }
    } catch {}
    return false;
  };

  // --- ANOMALY DETECTION LOGIC ---
  const getAnomalyFlag = (log: any) => {
    const r = log.reach || 0; const v = log.views || 0;
    const l = log.likes || 0; const c = log.comments || 0; const s = log.shares || 0;
    const totalEng = l + c + s;
    if (l > v && v > 0) return "IMPOSSIBLE: Likes > Views";
    if (c > v && v > 0) return "IMPOSSIBLE: Comments > Views";
    if (totalEng > r && r > 0) return "SUSPICIOUS: Engagement > Reach";
    if (v > 0 && (totalEng / v) > 0.4) return "SUSPICIOUS: >40% Engagement Rate";
    return null; 
  };

  // --- MULTI-FILTER DATA PROCESSING ---
  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));
  
  let baseLogs = logs;
  if (platformFilter !== "All") baseLogs = baseLogs.filter(l => (l.platform || 'facebook') === platformFilter);
  if (selectedHandler !== "All") baseLogs = baseLogs.filter(l => l.handler_name === selectedHandler);
  
  let timeFilteredLogs = baseLogs;
  const now = new Date();
  if (dateFilter === "Today") timeFilteredLogs = baseLogs.filter(l => new Date(l.created_at).toDateString() === now.toDateString());
  else if (dateFilter === "Week") timeFilteredLogs = baseLogs.filter(l => new Date(l.created_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  else if (dateFilter === "Month") timeFilteredLogs = baseLogs.filter(l => new Date(l.created_at).getMonth() === now.getMonth() && new Date(l.created_at).getFullYear() === now.getFullYear());
  
  const filteredLogs = timeFilteredLogs;
  const validCount = filteredLogs.filter(l => checkURL(l.url, l.platform || 'facebook')).length;

  // Accuracy Matrix
  const todayStr = new Date().toDateString();
  const handlerStats = uniqueHandlers.map(handler => {
    const handlerTodayLogs = logs.filter(l => l.handler_name === handler && new Date(l.created_at).toDateString() === todayStr);
    const handlerValidCount = handlerTodayLogs.filter(l => checkURL(l.url, l.platform || 'facebook')).length;
    const progressPct = Math.min(100, Math.round((handlerValidCount / dailyTarget) * 100));
    const accuracy = handlerTodayLogs.length > 0 ? Math.round((handlerValidCount / handlerTodayLogs.length) * 100) : 0;
    return { handler, handlerValidCount, progressPct, accuracy };
  });

  // 7-Day Trend Graph Data
  const trendData = Array.from({length: 7}).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const count = logs.filter(l => new Date(l.created_at).toDateString() === d.toDateString() && checkURL(l.url, l.platform || 'facebook')).length;
    return { label: d.toLocaleDateString('en-US', {weekday: 'short'}), count };
  });
  const maxTrend = Math.max(...trendData.map(d => d.count), 1);

  // MEL GRAPHS CALCULATIONS
  const totalReach = filteredLogs.reduce((sum, log) => sum + (log.reach || 0), 0);
  const totalViews = filteredLogs.reduce((sum, log) => sum + (log.views || 0), 0);
  const totalFollowers = filteredLogs.reduce((sum, log) => sum + (log.followers || 0), 0);
  const totalEngagement = filteredLogs.reduce((sum, log) => sum + (log.likes || 0) + (log.comments || 0) + (log.shares || 0), 0);
  const maxMetric = Math.max(totalReach, totalViews, totalFollowers, totalEngagement, 1);

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Securing Connection...</div>;
  if (!session || session.user.email !== "admin@executive-command.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
          <div className="text-center space-y-2"><h1 className="text-2xl font-bold text-white">Command Center</h1><p className="text-sm text-zinc-400">Restricted Admin Access</p></div>
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <input type="password" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 outline-none text-center tracking-widest" />
            {authStatus && <div className="text-sm text-center text-red-400">{authStatus}</div>}
            <button type="submit" className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 transition-all">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              Executive Command
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
            </h1>
            <div className="flex gap-4">
              <button onClick={() => setActiveTab("dashboard")} className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === "dashboard" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>Dashboard</button>
              <button onClick={() => setActiveTab("settings")} className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === "settings" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>Platform Settings</button>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-zinc-500 hover:text-white">Sign Out</button>
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* MULTI-FILTER CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <select value={platformFilter} onChange={(e: any) => setPlatformFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Platforms</option><option value="facebook">Facebook</option><option value="twitter">Twitter / X</option>
                </select>
                <select value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Handlers</option>
                  {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={dateFilter} onChange={(e: any) => setDateFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Time</option><option value="Today">Today</option><option value="Week">Last 7 Days</option><option value="Month">This Month</option>
                </select>
              </div>
              <button onClick={() => setIsAddingManager(!isAddingManager)} className="text-xs font-bold bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200">+ Add Manager</button>
            </div>

            {/* TOP SUMMARY CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-3xl font-bold text-white">{filteredLogs.length}</span><span className="text-[10px] uppercase font-bold text-zinc-500 mt-1">Total URLs</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-3xl font-bold text-emerald-400">{validCount}</span><span className="text-[10px] uppercase font-bold text-emerald-500 mt-1">Valid Links</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-3xl font-bold text-blue-400">{totalReach.toLocaleString()}</span><span className="text-[10px] uppercase font-bold text-blue-500 mt-1">Total Reach</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-3xl font-bold text-purple-400">{totalFollowers.toLocaleString()}</span><span className="text-[10px] uppercase font-bold text-purple-500 mt-1">Followers Reached</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-3xl font-bold text-amber-400">{totalEngagement.toLocaleString()}</span><span className="text-[10px] uppercase font-bold text-amber-500 mt-1">Engagement</span>
              </div>
            </div>

            {/* MEL GRAPHS & ACCURACY MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-center">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6">MEL Performance Analytics</h2>
                <div className="space-y-5">
                  {[
                    { label: "Total Reach", val: totalReach, color: "bg-blue-500" },
                    { label: "Total Views", val: totalViews, color: "bg-emerald-500" },
                    { label: "Total Followers Engaged", val: totalFollowers, color: "bg-purple-500" },
                    { label: "Total Direct Engagement (L/C/S)", val: totalEngagement, color: "bg-amber-500" }
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

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col shadow-2xl">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Fleet Accuracy Matrix (Today)</h2>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {handlerStats.map(stat => (
                    <div key={stat.handler} className="flex flex-col gap-1 w-full">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-zinc-300 truncate font-medium">{stat.handler}</span>
                        <div className="flex gap-2 items-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stat.accuracy > 85 ? 'bg-emerald-500/20 text-emerald-400' : stat.accuracy > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{stat.accuracy}% ACC</span>
                          <span className={stat.handlerValidCount >= dailyTarget ? "text-emerald-400 font-bold" : "text-zinc-500"}>{stat.handlerValidCount}/{dailyTarget}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {handlerStats.length === 0 && <span className="text-xs text-zinc-600">No active data today.</span>}
                </div>
              </div>

            </div>

            {/* LOGS TABLE */}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex justify-between items-center">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Raw KPI Submissions & Audit Log</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">Time (EAT)</th>
                      <th className="px-6 py-4 font-medium">Handler</th>
                      <th className="px-6 py-4 font-medium">Status & Network</th>
                      <th className="px-6 py-4 font-medium">URL</th>
                      <th className="px-6 py-4 font-medium">Performance Data</th>
                      <th className="px-6 py-4 font-medium">Impact Snapshot</th>
                      <th className="px-6 py-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredLogs.map((log) => {
                      const logPlatform = log.platform || 'facebook';
                      const isValid = checkURL(editingId === log.id ? editUrl : log.url, logPlatform);
                      const anomalyMsg = getAnomalyFlag(log);
                      
                      const postReach = log.reach || 0;
                      const postViews = log.views || 0;
                      const postEng = (log.likes || 0) + (log.comments || 0) + (log.shares || 0);
                      const maxPostVal = Math.max(postReach, postViews, postEng, 1);
                      
                      return (
                        <tr key={log.id} className={`group ${anomalyMsg ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-zinc-900/80'}`}>
                          <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-100">{log.handler_name}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`px-2 py-1 text-[9px] font-bold rounded-full ${isValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{isValid ? 'Valid' : 'Invalid'}</span>
                              <span className={`px-2 py-1 text-[9px] font-bold rounded-full border ${logPlatform === 'twitter' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                                {logPlatform === 'twitter' ? '𝕏 TWITTER' : 'f FACEBOOK'}
                              </span>
                              {anomalyMsg && <span className="w-max px-2 py-1 text-[9px] font-bold rounded-full bg-red-500/20 text-red-400">🚩 {anomalyMsg}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[200px] truncate">{editingId === log.id ? <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-white outline-none" autoFocus /> : <a href={log.url} target="_blank" className="hover:underline text-blue-400">{log.url}</a>}</td>
                          <td className="px-6 py-4">
                            <div className="grid grid-cols-4 gap-3 min-w-[280px]">
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Followers</span><span className="text-purple-400 font-mono text-xs">{log.followers || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">{logPlatform === 'twitter' ? 'Impressions' : 'Reach'}</span><span className="text-blue-400 font-mono text-xs">{log.reach || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Views</span><span className="text-emerald-400 font-mono text-xs">{log.views || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Groups</span><span className="text-zinc-300 font-mono text-xs">{log.groups_joined || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Likes</span><span className="text-amber-400 font-mono text-xs">{log.likes || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">{logPlatform === 'twitter' ? 'Replies' : 'Comments'}</span><span className="text-amber-400 font-mono text-xs">{log.comments || 0}</span></div>
                              <div className="flex flex-col"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">{logPlatform === 'twitter' ? 'Retweets' : 'Shares'}</span><span className="text-amber-400 font-mono text-xs">{log.shares || 0}</span></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 w-32 align-middle">
                            <div className="flex flex-col gap-2 w-full justify-center">
                               <div className="flex items-center gap-2 group-hover:opacity-100 opacity-70 transition-opacity">
                                  <span className="text-[8px] text-blue-500 font-bold w-2">R</span>
                                  <div className="flex-1 bg-zinc-900 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(postReach/maxPostVal)*100}%`}}></div></div>
                               </div>
                               <div className="flex items-center gap-2 group-hover:opacity-100 opacity-70 transition-opacity">
                                  <span className="text-[8px] text-emerald-500 font-bold w-2">V</span>
                                  <div className="flex-1 bg-zinc-900 h-1.5 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${(postViews/maxPostVal)*100}%`}}></div></div>
                               </div>
                               <div className="flex items-center gap-2 group-hover:opacity-100 opacity-70 transition-opacity">
                                  <span className="text-[8px] text-amber-500 font-bold w-2">E</span>
                                  <div className="flex-1 bg-zinc-900 h-1.5 rounded-full overflow-hidden"><div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${(postEng/maxPostVal)*100}%`}}></div></div>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {editingId === log.id ? <button onClick={() => handleSaveEdit(log.id)} className="text-emerald-400 mr-3">Save</button> : <><button onClick={() => { setEditingId(log.id); setEditUrl(log.url); }} className="text-blue-400 opacity-0 group-hover:opacity-100 mr-3">Edit</button><button onClick={() => handleDeleteLink(log.id)} className="text-red-400 opacity-0 group-hover:opacity-100">Delete</button></>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-6 space-y-4 shadow-xl md:col-span-2">
              <h2 className="text-lg font-bold text-blue-400 border-b border-blue-500/20 pb-2">Global Platform Variables</h2>
              <form onSubmit={handleUpdateSettings} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-blue-400/80">Message of the Day (MoTD)</label>
                  <input type="text" value={newMotdInput || motd} onChange={e => setNewMotdInput(e.target.value)} placeholder="Broadcast message to all handlers..." className="w-full rounded-lg bg-black border border-blue-500/30 px-4 py-3 text-sm text-blue-100 outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-blue-400/80">Daily Quota Target</label>
                    <input type="number" min="1" value={newTargetInput || dailyTarget} onChange={e => setNewTargetInput(e.target.value)} className="w-full rounded-lg bg-black border border-blue-500/30 px-4 py-3 text-sm text-blue-100 outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-blue-400/80">Max Post Age Limit (Hours)</label>
                    <input type="number" min="1" value={newMaxPostAgeInput || maxPostAge} onChange={e => setNewMaxPostAgeInput(e.target.value)} className="w-full rounded-lg bg-black border border-blue-500/30 px-4 py-3 text-sm text-blue-100 outline-none" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors">Sync Platform Variables</button>
              </form>
            </div>

            <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Command Security</h2>
              <p className="text-sm text-zinc-400 mb-4">Update the master passcode for this dashboard.</p>
              <form onSubmit={handleUpdateMasterPasscode} className="space-y-3">
                <input type="password" required value={newMasterPasscode} onChange={e => setNewMasterPasscode(e.target.value)} placeholder="New Master Passcode" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm text-white outline-none focus:border-blue-500" />
                <button type="submit" className="w-full bg-white text-black py-2 rounded-lg text-sm font-bold hover:bg-zinc-200">Update Passcode</button>
              </form>
            </div>
            
            <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Reset Handler Passcode</h2>
              <p className="text-sm text-zinc-400 mb-4">Override and reset a forgotten manager passcode.</p>
              <form onSubmit={handleResetHandlerPasscode} className="space-y-3">
                <select value={resetTarget} onChange={e => setResetTarget(e.target.value)} required className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm text-white outline-none focus:border-blue-500">
                  <option value="">Select Handler...</option>
                  {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <input type="password" required value={newHandlerPasscode} onChange={e => setNewHandlerPasscode(e.target.value)} placeholder="New Handler Passcode" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm text-white outline-none focus:border-blue-500" />
                <button type="submit" className="w-full bg-zinc-800 text-white py-2 rounded-lg text-sm font-bold hover:bg-zinc-700">Reset Account Access</button>
              </form>
            </div>

            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-6 space-y-4 shadow-xl md:col-span-2 mt-4">
              <h2 className="text-lg font-bold text-red-400 border-b border-red-500/20 pb-2">Danger Zone: Terminate Handler</h2>
              <p className="text-sm text-red-400/80 mb-4">This permanently deletes the manager's login account and wipes all KPI data they ever submitted. This cannot be undone.</p>
              <form onSubmit={handleTerminateHandler} className="flex flex-col sm:flex-row gap-4">
                <select value={terminateTarget} onChange={e => setTerminateTarget(e.target.value)} required className="flex-1 rounded-lg bg-black border border-red-500/30 px-4 py-2 text-sm text-red-300 outline-none">
                  <option value="">Select Handler to Terminate...</option>
                  {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <button type="submit" className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-600">Terminate & Purge</button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
