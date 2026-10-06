"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [motd, setMotd] = useState("");

  const [url, setUrl] = useState("");
  const [reach, setReach] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [groupsJoined, setGroupsJoined] = useState("");
  const [followers, setFollowers] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) { fetchMyLogs(session.user.email.split("@")[0]); fetchSettings(); }
      setIsCheckingAuth(false);
    });
    const channel = supabase.channel('my-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => { if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => fetchSettings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    await supabase.auth.signInWithPassword({ email: `${username.toLowerCase().trim()}@executive-command.com`, password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Submitting to MEL..." });
    if (!url.trim()) return setStatus({ type: "error", msg: "Please enter a valid URL." });

    try {
      const res = await fetch("/api/log", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          url, handler_name: session.user.email.split("@")[0],
          reach, views, likes, comments, shares, groups_joined: groupsJoined, followers 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "MEL Data Logged Successfully!" });
        setUrl(""); setReach(""); setViews(""); setLikes(""); setComments(""); setShares(""); setGroupsJoined(""); setFollowers("");
      } else setStatus({ type: "error", msg: data.error || "Failed to submit." });
    } catch { setStatus({ type: "error", msg: "Network Error" }); }
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
  myLogs.forEach(log => { if (new Date(log.created_at).toDateString() === todayStr && checkURL(log.url)) todaysValidCount++; });

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Initializing...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-md space-y-6 mt-10 mb-10">
        {session && motd && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 flex items-start gap-3">
            <span className="text-blue-500 mt-0.5 font-bold">INFO</span><p className="leading-relaxed">{motd}</p>
          </div>
        )}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          {session && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>}
          {!session ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <h1 className="text-2xl font-bold text-center">Fleet Authentication</h1>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Handler ID" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passcode" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <button type="submit" className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors">Login</button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center"><h1 className="text-xl font-bold">MEL Submission</h1><p className="text-sm text-zinc-400">ID: {session.user.email.split("@")[0]}</p></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Facebook Post URL" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="0" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Followers" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <input type="number" min="0" value={groupsJoined} onChange={(e) => setGroupsJoined(e.target.value)} placeholder="Groups Joined" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <input type="number" min="0" value={reach} onChange={(e) => setReach(e.target.value)} placeholder="Reach" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <input type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <input type="number" min="0" value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="Likes" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <input type="number" min="0" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                  <div className="col-span-2"><input type="number" min="0" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" /></div>
                </div>
                {status.type !== "idle" && <div className={`text-sm text-center ${status.type === "error" ? "text-red-400" : "text-emerald-400"}`}>{status.msg}</div>}
                <button type="submit" disabled={status.type === "loading"} className="w-full bg-emerald-500 text-white p-3 rounded-lg font-bold hover:bg-emerald-600 transition-colors">
                  {status.type === "loading" ? "Processing..." : "Submit MEL Data"}
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
