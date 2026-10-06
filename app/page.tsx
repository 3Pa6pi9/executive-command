"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function ExecutiveDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHandler, setSelectedHandler] = useState<string>("All");

  // Admin CRUD State
  const [isAdding, setIsAdding] = useState(false);
  const [newHandler, setNewHandler] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const [isDeletingManager, setIsDeletingManager] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState("");

  // Fetch data on load
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("campaign_links")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLogs(data);
    setIsLoading(false);
  };

  // --- CRUD ACTIONS ---

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await supabase.from("campaign_links").insert([{ url: newUrl, handler_name: newHandler }]);
    setNewUrl("");
    setNewHandler("");
    setIsAdding(false);
    fetchLogs();
  };

  const handleSaveEdit = async (id: string) => {
    setIsLoading(true);
    await supabase.from("campaign_links").update({ url: editUrl }).eq("id", id);
    setEditingId(null);
    setEditUrl("");
    fetchLogs();
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this KPI submission?")) return;
    setIsLoading(true);
    await supabase.from("campaign_links").delete().eq("id", id);
    fetchLogs();
  };

  const handleDeleteManagerLogs = async () => {
    if (!managerToDelete) return;
    if (!confirm(`WARNING: This will permanently delete ALL links submitted by ${managerToDelete}. Proceed?`)) return;
    
    setIsLoading(true);
    await supabase.from("campaign_links").delete().eq("handler_name", managerToDelete);
    setManagerToDelete("");
    setIsDeletingManager(false);
    if (selectedHandler === managerToDelete) setSelectedHandler("All");
    fetchLogs();
  };

  // --- DATA DERIVATION ---
  
  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));
  const filteredLogs = selectedHandler === "All" 
    ? logs 
    : logs.filter(l => l.handler_name === selectedHandler);

  const displayedLogsCount = filteredLogs.length;
  const totalActiveHandlers = uniqueHandlers.length;

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-white">Executive Command</h1>
              <p className="text-zinc-400">Live monitoring and data management.</p>
            </div>
            
            {/* Filter & Admin Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Filter:</label>
                <select 
                  value={selectedHandler}
                  onChange={(e) => setSelectedHandler(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  <option value="All">All Handlers</option>
                  {uniqueHandlers.map(handler => (
                    <option key={handler} value={handler}>{handler}</option>
                  ))}
                </select>
              </div>

              <div className="w-px h-6 bg-zinc-800 hidden sm:block"></div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setIsAdding(!isAdding); setIsDeletingManager(false); }}
                  className="text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  {isAdding ? "Cancel Add" : "+ Add KPI"}
                </button>
                <button 
                  onClick={() => { setIsDeletingManager(!isDeletingManager); setIsAdding(false); }}
                  className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  {isDeletingManager ? "Cancel Purge" : "Purge Manager"}
                </button>
                <button 
                  onClick={fetchLogs}
                  disabled={isLoading}
                  className="text-xs font-medium bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? "Syncing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-3xl font-bold text-white">{displayedLogsCount}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {selectedHandler === "All" ? "Total Posts" : "Manager Posts"}
              </span>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div className="flex flex-col items-end">
              <span className="text-3xl font-bold text-white">{totalActiveHandlers}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Fleet</span>
            </div>
          </div>
        </div>

        {/* Admin Inline Forms */}
        {isAdding && (
          <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-lg animate-in fade-in slide-in-from-top-4">
            <input placeholder="Handler ID (e.g. admin)" required value={newHandler} onChange={e => setNewHandler(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full sm:w-48" />
            <input placeholder="https://facebook.com/..." required type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 flex-1" />
            <button type="submit" className="bg-white text-black px-6 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors">Save Entry</button>
          </form>
        )}

        {isDeletingManager && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 shadow-lg animate-in fade-in slide-in-from-top-4">
            <select value={managerToDelete} onChange={e => setManagerToDelete(e.target.value)} className="bg-zinc-950 border border-red-500/20 rounded-lg px-4 py-2 text-sm text-red-400 focus:outline-none w-full sm:w-auto">
               <option value="">Select Handler to Purge...</option>
               {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <p className="text-xs text-red-400/80 flex-1 text-center sm:text-left">This will permanently delete all database entries tied to this ID.</p>
            <button onClick={handleDeleteManagerLogs} disabled={!managerToDelete} className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-red-600 transition-colors w-full sm:w-auto">Confirm Purge</button>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl relative">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Handler</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Post URL</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {isLoading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 animate-pulse">
                      Synchronizing with secure database...
                    </td>
                  </tr>
                ) : filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    let statusLabel = "Invalid URL";
                    let statusColor = "bg-red-500/10 text-red-400 ring-red-500/20";
                    let isValid = false;

                    try {
                      const parsed = new URL(editingId === log.id ? editUrl : log.url);
                      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
                      const isFbDomain = validHosts.includes(parsed.hostname);

                      if (!isFbDomain) {
                        statusLabel = "Invalid Domain";
                      } else {
                        const path = parsed.pathname.toLowerCase();
                        const isPost = path.includes("/posts/") || path.includes("/permalink.php") || path.includes("/videos/") || path.includes("/photo") || path.includes("/watch") || path.includes("/story.php") || parsed.hostname === "fb.watch";
                        const isCreation = path.includes("/create") || path === "/";

                        if (isPost && !isCreation) {
                          isValid = true;
                          statusLabel = "Valid";
                          statusColor = "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";
                        } else {
                          statusLabel = "Not a Post Link";
                          statusColor = "bg-amber-500/10 text-amber-400 ring-amber-500/20";
                        }
                      }
                    } catch (e) {
                      statusLabel = "Invalid Format";
                    }

                    return (
                      <tr key={log.id} className="hover:bg-zinc-900/80 transition-colors group">
                        <td className="whitespace-nowrap px-6 py-4 text-zinc-400">
                          {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-100">
                          {log.handler_name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 w-full max-w-sm">
                          {editingId === log.id ? (
                            <input 
                              type="url" 
                              value={editUrl} 
                              onChange={(e) => setEditUrl(e.target.value)}
                              className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          ) : (
                            <a 
                              href={log.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`transition-colors inline-block max-w-[200px] sm:max-w-md truncate align-bottom group-hover:underline ${isValid ? "text-blue-400 hover:text-blue-300" : "text-zinc-500 hover:text-zinc-400 line-through"}`}
                            >
                              {log.url}
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {editingId === log.id ? (
                            <div className="flex justify-end gap-3">
                              <button onClick={() => handleSaveEdit(log.id)} className="text-emerald-400 hover:text-emerald-300 font-medium">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-400 font-medium">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingId(log.id); setEditUrl(log.url); }} className="text-blue-400 hover:text-blue-300 font-medium">Edit</button>
                              <button onClick={() => handleDeleteLink(log.id)} className="text-red-400 hover:text-red-300 font-medium">Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      No KPIs found for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}