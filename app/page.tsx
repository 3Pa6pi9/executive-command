import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Forces Vercel to fetch fresh database records on every single page load
export const dynamic = "force-dynamic";

export default async function ExecutiveDashboard() {
  // Fetch logs directly from Supabase, newest first
  const { data: logs, error } = await supabase
    .from("campaign_links")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching logs:", error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-4 md:p-8 text-white selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Executive Command</h1>
          <p className="text-zinc-400">Live monitoring of ground team campaign quotas.</p>
        </div>

        <Card className="bg-zinc-950 border-zinc-800 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">Fleet Operations Feed</CardTitle>
            <CardDescription className="text-zinc-400">
              Real-time campaign links submitted by mobile handlers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="border-b border-zinc-800 text-zinc-100">
                  <tr>
                    <th className="pb-3 font-medium px-4">Timestamp</th>
                    <th className="pb-3 font-medium px-4">Handler</th>
                    <th className="pb-3 font-medium px-4">Campaign URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {logs && logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                        <td className="py-4 px-4 text-white font-medium">
                          {log.handler_name}
                        </td>
                        <td className="py-4 px-4">
                          <a 
                            href={log.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                          >
                            {log.url}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500">
                        No campaign links logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}