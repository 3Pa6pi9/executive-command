"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);

  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [motd, setMotd] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) { fetchMyLogs(session.user.email.split("@")[0]); fetchSettings(); }
      setIsCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) { fetchMyLogs(session.user.email.split("@")[0]); fetchSettings(); }
    });

    const channel = supabase.channel('my-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => { if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => { fetchSettings(); })
      .subscribe();

    return () => { subscription.unsubscribe(); supabase.removeChannel(channel); };
  }, [session?.user?.email]);

  const fetchMyLogs = async (handlerId: string) => {
    const { data } = await supabase.from("campaign_links").select("*").eq("handler_name", handlerId).order("created_at", { ascending: false }).limit(50);
    if (data) setMyLogs(data);
  };
  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("daily_target, motd").eq("id", 1).single();
    if (data) { setDailyTarget(data.daily_target); setMotd(data.motd); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedEmail = `${username.toLowerCase().trim()}@executive-command.com`;
    if (isLoginMode) await supabase.auth.signInWithPassword({ email: formattedEmail, password });
    else await supabase.auth.signUp({ email: formattedEmail, password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setBatchResults([]);
    
    // Parse bulk text into an array of URLs
    const urls = textInput.split('\n').map(u => u.trim()).filter(u => u !== '');
    if (urls.length === 0) { setIsSubmitting(false); return; }

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ urls, handler_name: session.user.email.split("@")[0] }),
      });
      const data = await res.json();
      if (res.ok) {
        setBatchResults(data.results);
        setTextInput(""); // clear field on success
      } else {
        alert("Server Error: " + data.error);
      }
    } catch { alert("Network Error"); }
    
    setIsSubmitting(false);
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

  let todaysValidCount = 0;
  const todayStr = new Date().toDateString();
  myLogs.forEach(log => {
    if (new Date(log.created_at).toDateString() === todayStr && checkURL(log.url)) todaysValidCount++;
  });

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Initializing...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-md space-y-6 mt-10 mb-10">
        
        {session && motd && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <span className="text-blue-500 mt-0.5 font-bold">INFO</span>
            <p className="leading-relaxed">{motd}</p>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          {session && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>}
          {!session ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <h1 className="text-2xl font-bold text-center">Fleet Authentication</h1>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Handler ID" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passcode" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <button type="submit" className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200">Login</button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold">Submit KPIs</h1>
                <p className="text-sm text-zinc-400">ID: {session.user.email.split("@")[0]}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <textarea 
                  required 
                  value={textInput} 
                  onChange={(e) => setTextInput(e.target.value)} 
                  placeholder="Paste multiple Facebook URLs here...&#10;(One per line)" 
                  rows={4}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none resize-none font-mono text-xs" 
                />
                
                {batchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1 bg-black p-2 rounded-lg border border-zinc-800">
                    {batchResults.map((res, i) => (
                      <div key={i} className={`text-[10px] flex gap-2 ${res.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <span className="font-bold">[{res.status === 'success' ? 'OK' : 'ERR'}]</span>
                        <span className="truncate">{res.msg}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white p-3 rounded-lg font-bold hover:bg-emerald-600 transition-colors">
                  {isSubmitting ? "Processing..." : "Process Fleet Batch"}
                </button>
              </form>
              
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs text-zinc-400">Target Progress: <span className="font-bold text-emerald-400">{todaysValidCount} / {dailyTarget}</span></div>
                  <button onClick={() => supabase.auth.signOut()} className="text-xs text-zinc-500 hover:text-white transition-colors">Sign Out</button>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (todaysValidCount / dailyTarget) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
