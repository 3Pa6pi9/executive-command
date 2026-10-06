import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboard() {
  const { data: logs, error } = await supabase
    .from("campaign_links")
    .select("*")
    .order("created_at", { ascending: false });

  // Calculate quick stats
  const totalLogs = logs?.length || 0;
  const uniqueHandlers = new Set(logs?.map(l => l.handler_name)).size;

  return (
    <div className="flex min-h-screen flex-col bg-black p-6 md:p-12 text-zinc-100 font-sans selection:bg-blue-500/30">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-white">Executive Command</h1>
            <p className="text-zinc-400">Live monitoring of daily social media KPIs.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-3xl font-bold text-white">{totalLogs}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Posts</span>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div className="flex flex-col items-end">
              <span className="text-3xl font-bold text-white">{uniqueHandlers}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Handlers</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="overflow-x-auto">
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
                {logs && logs.length > 0 ? (
                  logs.map((log) => {
                    // Evaluate validity on the fly
                    let isValid = false;
                    try {
                      const parsed = new URL(log.url);
                      const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"];
                      isValid = validHosts.includes(parsed.hostname);
                    } catch (e) {
                      isValid = false;
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
                          {isValid ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
                              Invalid Domain
                            </span>
                          )}
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
                      No KPIs have been logged yet.
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