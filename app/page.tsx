"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function ExecutiveDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHandler, setSelectedHandler] = useState<string>("All");

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

  // Derive unique handlers for the dropdown
  const uniqueHandlers = Array.from(new Set(logs.map(l => l.handler_name)));

  // Filter logs based on selection
  const filteredLogs = selectedHandler === "All" 
    ? logs 
    : logs.filter(l => l.handler_name === selectedHandler);

  // Stats
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
              <p className="text-zinc-400">Live monitoring of daily social media KPIs.</p>
            </div>
            
            {/* Filter & Refresh Controls */}
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

              <button 
                onClick={fetchLogs}
                disabled={isLoading}
                className="text-xs font-medium bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {isLoading ? "Syncing..." : "Refresh Data"}
              </button>
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
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Fleet Size</span>
            </div>
          </div>
        </div>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 animate-pulse">
                      Synchronizing with secure database...
                    </td>
                  </tr>
                ) : filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    // Evaluate validity on the fly
                    let statusLabel = "Invalid URL";
                    let statusColor = "bg-red-500/10 text-red-400 ring-red-500/20";
                    let isValid = false;

                    try {
                      const parsed = new URL(log.url);
                      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
                      const isFbDomain = validHosts.includes(parsed.hostname);

                      if (!isFbDomain) {
                        statusLabel = "Invalid Domain";
                      } else {
                        const path = parsed.pathname.toLowerCase();
                        
                        const isPost = path.includes("/posts/") || 
                                       path.includes("/permalink.php") || 
                                       path.includes("/videos/") || 
                                       path.includes("/photo") || 
                                       path.includes("/watch") || 
                                       path.includes("/story.php") ||
                                       parsed.hostname === "fb.watch";

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
                          {new Date(log.created_at).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-100">
                          {log.handler_name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={log.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`transition-colors inline-block max-w-[200px] sm:max-w-md truncate align-bottom group-hover:underline ${
                              isValid ? "text-blue-400 hover:text-blue-300" : "text-zinc-500 hover:text-zinc-400 line-through"
                            }`}
                          >
                            {log.url}
                          </a>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
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