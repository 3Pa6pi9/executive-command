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
  const [isLoading, setIsLoading] = useState(true);
  
  // Dynamic Settings
  const [dailyTarget, setDailyTarget] = useState(20);
  const [newTargetInput, setNewTargetInput] = useState("");
  
  const [selectedHandler, setSelectedHandler] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Week" | "Month">("All");

  const [isAddingManager, setIsAddingManager] = useState(false);
  const [newManagerId, setNewManagerId] = useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const [newMasterPasscode, setNewMasterPasscode] = useState("");
  const [resetTarget, setResetTarget] = useState("");
  const [newHandlerPasscode, setNewHandlerPasscode] = useState("");
  const [terminateTarget, setTerminateTarget] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      if (session?.user?.email === "admin@executive-command.com") {
        fetchLogs();
        fetchSettings();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email === "admin@executive-command.com") {
        fetchLogs();
        fetchSettings();
      }
    });

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => {
        if (session?.user?.email === "admin@executive-command.com") fetchLogs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        if (session?.user?.email === "admin@executive-command.com") fetchSettings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [session?.user?.email]);

  const fetchLogs = async () => {
    const { data } = await supabase.from("campaign_links").select("*").order("created_at", { ascending: false });
    if (data) setLogs(data);
    setIsLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("daily_target").eq("id", 1).single();
    if (data) setDailyTarget(data.daily_target);
  };

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newTargetInput);
    if (isNaN(num) || num < 1) return alert("Please enter a valid number greater than 0.");
    
    const { error } = await supabase.from("system_settings").update({ daily_target: num }).eq("id", 1);
    if (error) alert(`Error: ${error.message}`);
    else {
      setDailyTarget(num);
      setNewTargetInput("");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStatus("Authenticating...");
    const { error } = await supabase.auth.signInWithPassword({ email: "admin@executive-command.com", password: adminPasscode });
    if (error) setAuthStatus("Access Denied: Invalid Passcode.");
    else setAuthStatus("");
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await fetch("/api/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handler_name: newManagerId, password: newManagerPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Manager ${newManagerId} successfully provisioned.`);
      setNewManagerId(""); setNewManagerPassword(""); setIsAddingManager(false);
    } else alert(`Error: ${data.error}`);
    setIsLoading(false);
  };

  const handleSaveEdit = async (id: string) => {
    await supabase.from("campaign_links").update({ url: editUrl }).eq("id", id);
    setEditingId(null); setEditUrl("");
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this KPI submission?")) return;
    await supabase.from("campaign_links").delete().eq("id", id);
  };

  const handleUpdateMasterPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMasterPasscode.length < 6) return alert("Must be 6+ characters.");
    const { error } = await supabase.auth.updateUser({ password: newMasterPasscode });
    if (error) alert(`Error: ${error.message}`);
    else { alert("Master Passcode Updated Successfully."); setNewMasterPasscode(""); }
  };

  const handleResetHandlerPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || newHandlerPasscode.length < 6) return alert("Select a handler and enter a 6+ char passcode.");
    const res = await fetch("/api/managers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handler_name: resetTarget, new_password: newHandlerPasscode }),
    });
    if (res.ok) { alert(`${resetTarget}'s passcode has been reset.`); setResetTarget(""); setNewHandlerPasscode(""); } 
    else alert("Failed to reset passcode.");
  };

  const handleTerminateHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminateTarget) return;
    if (!confirm(`CRITICAL WARNING: This will permanently delete ${terminateTarget}'s login account AND wipe all their submitted KPIs. Proceed?`)) return;
    
    await fetch("/api/managers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handler_name: terminateTarget }),
    });
    await supabase.from("campaign_links").delete().eq("handler_name", terminateTarget);
    
    alert(`Handler ${terminateTarget} has been terminated and purged.`);
    setTerminateTarget("");
    if (selectedHandler === terminateTarget) setSelectedHandler("All");
  };

  // --- FILTERING & VALIDATION LOGIC ---
  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));
  
  let timeFilteredLogs = logs;
  const now = new Date();
  if (dateFilter === "Today") {
    timeFilteredLogs = logs.filter(l => new Date(l.created_at).toDateString() === now.toDateString());
  } else if (dateFilter === "Week") {
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    timeFilteredLogs = logs.filter(l => new Date(l.created_at) >= lastWeek);
  } else if (dateFilter === "Month") {
    timeFilteredLogs = logs.filter(l => new Date(l.created_at).getMonth() === now.getMonth() && new Date(l.created_at).getFullYear() === now.getFullYear());
  }

  const filteredLogs = selectedHandler === "All" ? timeFilteredLogs : timeFilteredLogs.filter(l => l.handler_name === selectedHandler);

  let validCount = 0; let invalidCount = 0;
  filteredLogs.forEach(log => {
    try {
      const p = new URL(log.url.trim());
      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
      if (validHosts.includes(p.hostname)) {
        const path = p.pathname.toLowerCase();
        const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
        const isContent = p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg));
        if (isContent && !path.includes("/create")) validCount++;
        else invalidCount++;
      } else invalidCount++;
    } catch { invalidCount++; }
  });

  // --- ADMIN FLEET MATRIX ---
  const todayStr = new Date().toDateString();
  const handlerStats = uniqueHandlers.map(handler => {
    const handlerTodayLogs = logs.filter(l => l.handler_name === handler && new Date(l.created_at).toDateString() === todayStr);
    let handlerValidCount = 0;
    handlerTodayLogs.forEach(log => {
      try {
        const p = new URL(log.url.trim());
        const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
        if (validHosts.includes(p.hostname)) {
          const path = p.pathname.toLowerCase();
          const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
          if ((p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg))) && !path.includes("/create")) handlerValidCount++;
        }
      } catch {}
    });
    const progressPct = Math.min(100, Math.round((handlerValidCount / dailyTarget) * 100));
    return { handler, handlerValidCount, progressPct };
  });

  // --- CSV EXPORT LOGIC ---
  const handleExportCSV = () => {
    const headers = ["Time", "Handler", "URL", "Status"];
    const rows = filteredLogs.map(log => {
      let status = "Invalid";
      try {
        const p = new URL(log.url.trim());
        const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
        if (validHosts.includes(p.hostname)) {
          const path = p.pathname.toLowerCase();
          const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
          const isContent = p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg));
          if (isContent && !path.includes("/create")) status = "Valid";
          else status = "Bad Link";
        }
      } catch {}
      return `"${new Date(log.created_at).toLocaleString()}","${log.handler_name}","${log.url}","${status}"`;
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Executive_Command_${dateFilter}_KPIs.csv`;
    link.click();
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Securing Connection...</div>;

  if (!session || session.user.email !== "admin@executive-command.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Command Center</h1>
            <p className="text-sm text-zinc-400">Restricted Admin Access</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <input type="password" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 outline-none text-center tracking-widest" />
            </div>
            {authStatus && <div className={`text-sm text-center ${authStatus.includes("Access Denied") || authStatus.includes("must be") ? "text-red-400" : "text-emerald-400"}`}>{authStatus}</div>}
            <div className="space-y-3">
              <button type="submit" className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 transition-all">Authenticate</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              Executive Command
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
            </h1>
            <div className="flex gap-4">
              <button onClick={() => setActiveTab("dashboard")} className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === "dashboard" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>Dashboard</button>
              <button onClick={() => setActiveTab("settings")} className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === "settings" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>Settings & Fleet</button>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-zinc-500 hover:text-white">Sign Out</button>
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <select value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Handlers</option>
                  {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={dateFilter} onChange={(e: any) => setDateFilter(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Time</option>
                  <option value="Today">Today</option>
                  <option value="Week">Last 7 Days</option>
                  <option value="Month">This Month</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleExportCSV} className="text-xs font-bold text-zinc-400 border border-zinc-800 px-4 py-2 rounded-lg hover:text-white hover:border-zinc-500 transition-colors">Export CSV</button>
                <button onClick={() => setIsAddingManager(!isAddingManager)} className="text-xs font-bold bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors">{isAddingManager ? "Cancel Addition" : "+ Add New Manager"}</button>
              </div>
            </div>

            {isAddingManager && (
              <form onSubmit={handleAddManager} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <input placeholder="Handler ID" required value={newManagerId} onChange={e => setNewManagerId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white flex-1 outline-none" />
                <input placeholder="Secure Passcode" required minLength={6} type="password" value={newManagerPassword} onChange={e => setNewManagerPassword(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white flex-1 outline-none" />
                <button type="submit" disabled={isLoading} className="bg-white text-black px-6 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200">Create Account</button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{filteredLogs.length}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total KPIs</span>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-emerald-400">{validCount}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-500">Valid</span>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-red-400">{invalidCount}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-red-500">Invalid</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-center space-y-3 overflow-y-auto max-h-32">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Today's Fleet Velocity (Target: {dailyTarget})</span>
                {handlerStats.map(stat => (
                  <div key={stat.handler} className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 truncate w-16">{stat.handler}</span>
                      <span className={stat.handlerValidCount >= dailyTarget ? "text-emerald-400 font-bold" : "text-zinc-500"}>{stat.handlerValidCount}/{dailyTarget}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full ${stat.handlerValidCount >= dailyTarget ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${stat.progressPct}%` }}></div>
                    </div>
                  </div>
                ))}
                {handlerStats.length === 0 && <span className="text-xs text-zinc-600">No data today.</span>}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Time</th>
                    <th className="px-6 py-4 font-medium">Handler</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">URL</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredLogs.map((log) => {
                    let statusLabel = "Invalid"; let statusColor = "bg-red-500/10 text-red-400";
                    try {
                      const p = new URL((editingId === log.id ? editUrl : log.url).trim());
                      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
                      if (validHosts.includes(p.hostname)) {
                        const path = p.pathname.toLowerCase();
                        const validSegments = ["/posts/", "/permalink.php", "/videos/", "/photo", "/watch", "/story.php", "/reel/", "/reels/"];
                        const isContent = p.hostname === "fb.watch" || validSegments.some(seg => path.includes(seg));
                        if (isContent && !path.includes("/create")) {
                          statusLabel = "Valid"; statusColor = "bg-emerald-500/10 text-emerald-400";
                        } else {
                          statusLabel = "Bad Link"; statusColor = "bg-amber-500/10 text-amber-400";
                        }
                      }
                    } catch {}
                    return (
                      <tr key={log.id} className="hover:bg-zinc-900/80 group">
                        <td className="px-6 py-4 text-zinc-400">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="px-6 py-4 font-medium text-zinc-100">{log.handler_name}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>{statusLabel}</span></td>
                        <td className="px-6 py-4 max-w-[200px] truncate">
                          {editingId === log.id ? (
                            <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-white outline-none" autoFocus />
                          ) : <a href={log.url} target="_blank" className="hover:underline">{log.url}</a>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {editingId === log.id ? (
                            <button onClick={() => handleSaveEdit(log.id)} className="text-emerald-400 mr-3">Save</button>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(log.id); setEditUrl(log.url); }} className="text-blue-400 opacity-0 group-hover:opacity-100 mr-3 transition-opacity">Edit</button>
                              <button onClick={() => handleDeleteLink(log.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* NEW TARGET CONFIGURATOR */}
            <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-6 space-y-4 shadow-xl md:col-span-2">
              <h2 className="text-lg font-bold text-blue-400 border-b border-blue-500/20 pb-2">Global KPI Target</h2>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <p className="text-sm text-blue-400/80">Current requirement is <span className="font-bold text-white">{dailyTarget}</span> valid posts per day.</p>
                <form onSubmit={handleUpdateTarget} className="flex gap-3">
                  <input type="number" required min="1" value={newTargetInput} onChange={e => setNewTargetInput(e.target.value)} placeholder="New Target" className="w-32 rounded-lg bg-black border border-blue-500/30 px-4 py-2 text-sm text-blue-300 outline-none" />
                  <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-600">Update Fleet Target</button>
                </form>
              </div>
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
