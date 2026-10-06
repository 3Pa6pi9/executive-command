"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function ExecutiveDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHandler, setSelectedHandler] = useState<string>("All");

  // Admin CRUD State
  const [isAddingManager, setIsAddingManager] = useState(false);
  const [newManagerId, setNewManagerId] = useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const [isDeletingManager, setIsDeletingManager] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState("");

  useEffect(() => {
    fetchLogs();

    // LIVE SYNC: Listen for any changes to the campaign_links table
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, (payload) => {
        fetchLogs(); // Instantly refresh data when someone submits a link
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase.from("campaign_links").select("*").order("created_at", { ascending: false });
    if (data) setLogs(data);
    setIsLoading(false);
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
      setNewManagerId("");
      setNewManagerPassword("");
      setIsAddingManager(false);
    } else {
      alert(`Error: ${data.error}`);
    }
    setIsLoading(false);
  };

  const handleSaveEdit = async (id: string) => {
    await supabase.from("campaign_links").update({ url: editUrl }).eq("id", id);
    setEditingId(null);
    setEditUrl("");
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Delete this KPI submission?")) return;
    await supabase.from("campaign_links").delete().eq("id", id);
  };

  const handleDeleteManagerLogs = async () => {
    if (!managerToDelete) return;
    if (!confirm(`WARNING: This permanently deletes ALL links submitted by ${managerToDelete}. Proceed?`)) return;
    await supabase.from("campaign_links").delete().eq("handler_name", managerToDelete);
    setManagerToDelete("");
    setIsDeletingManager(false);
    if (selectedHandler === managerToDelete) setSelectedHandler("All");
  };

  // Data Derivation
  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));
  const filteredLogs = selectedHandler === "All" ? logs : logs.filter(l => l.handler_name === selectedHandler);

  // Evaluate handler stats
  let validCount = 0;
  let invalidCount = 0;

  filteredLogs.forEach(log => {
    try {
      const parsed = new URL(log.url);
      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
      if (validHosts.includes(parsed.hostname)) {
        const path = parsed.pathname.toLowerCase();
        const isPost = path.includes("/posts/") || path.includes("/permalink.php") || path.includes("/videos/") || path.includes("/photo") || path.includes("/watch") || path.includes("/story.php") || parsed.hostname === "fb.watch";
        const isCreation = path.includes("/create") || path === "/";
        (isPost && !isCreation) ? validCount++ : invalidCount++;
      } else {
        invalidCount++;
      }
    } catch {
      invalidCount++;
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                Executive Command
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </h1>
              <p className="text-zinc-400">Live monitoring and data management.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <select value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                  <option value="All">All Handlers</option>
                  {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="w-px h-6 bg-zinc-800 hidden sm:block"></div>
              <div className="flex gap-2">
                <button onClick={() => { setIsAddingManager(!isAddingManager); setIsDeletingManager(false); }} className="text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200">
                  {isAddingManager ? "Cancel" : "+ Add Manager"}
                </button>
                <button onClick={() => { setIsDeletingManager(!isDeletingManager); setIsAddingManager(false); }} className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20">
                  {isDeletingManager ? "Cancel" : "Purge Data"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Manager Summary Panel */}
        {selectedHandler !== "All" && (
          <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{filteredLogs.length}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total KPIs</span>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-emerald-400">{validCount}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-emerald-500">Valid Links</span>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-red-400">{invalidCount}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-red-500">Invalid Links</span>
            </div>
          </div>
        )}

        {/* Admin Forms */}
        {isAddingManager && (
          <form onSubmit={handleAddManager} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <input placeholder="Handler ID" required value={newManagerId} onChange={e => setNewManagerId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white flex-1 outline-none focus:border-blue-500" />
            <input placeholder="Secure Passcode" required minLength={6} type="password" value={newManagerPassword} onChange={e => setNewManagerPassword(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white flex-1 outline-none focus:border-blue-500" />
            <button type="submit" disabled={isLoading} className="bg-white text-black px-6 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 disabled:opacity-50">Create Account</button>
          </form>
        )}

        {isDeletingManager && (
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <select value={managerToDelete} onChange={e => setManagerToDelete(e.target.value)} className="bg-zinc-950 border border-red-500/20 rounded-lg px-4 py-2 text-sm text-red-400 outline-none flex-1">
               <option value="">Select Handler to Purge...</option>
               {uniqueHandlers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <button onClick={handleDeleteManagerLogs} disabled={!managerToDelete} className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-600 disabled:opacity-50">Confirm Purge</button>
          </div>
        )}

        {/* Data Table */}
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
                let statusLabel = "Invalid";
                let statusColor = "bg-red-500/10 text-red-400";
                try {
                  const p = new URL(editingId === log.id ? editUrl : log.url);
                  if (["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"].includes(p.hostname)) {
                    const path = p.pathname.toLowerCase();
                    if ((path.includes("/posts/") || path.includes("/permalink.php") || path.includes("/videos/") || p.hostname === "fb.watch") && !path.includes("/create")) {
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
                      ) : (
                        <a href={log.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{log.url}</a>
                      )}
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
    </div>
  );
}