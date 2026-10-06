"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  const [myLogs, setMyLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email && session.user.email !== "admin@executive-command.com") {
        fetchMyLogs(session.user.email.split("@")[0]);
      }
      setIsCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email && session.user.email !== "admin@executive-command.com") {
        fetchMyLogs(session.user.email.split("@")[0]);
      }
    });

    const channel = supabase
      .channel('my-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => {
        if (session?.user?.email && session.user.email !== "admin@executive-command.com") {
          fetchMyLogs(session.user.email.split("@")[0]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [session?.user?.email]);

  const fetchMyLogs = async (handlerId: string) => {
    const { data } = await supabase.from("campaign_links").select("*").eq("handler_name", handlerId).order("created_at", { ascending: false }).limit(50);
    if (data) setMyLogs(data);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Authenticating..." });
    const formattedEmail = `${username.toLowerCase().trim()}@executive-command.com`;

    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email: formattedEmail, password });
      setStatus(error ? { type: "error", msg: "Invalid ID or Passcode." } : { type: "idle", msg: "" });
    } else {
      const { error } = await supabase.auth.signUp({ email: formattedEmail, password });
      setStatus(error ? { type: "error", msg: error.message } : { type: "idle", msg: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Submitting..." });
    
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, handler_name: session.user.email.split("@")[0] }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "Logged." });
        setUrl("");
      } else {
        setStatus({ type: "error", msg: data.error || "Failed." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Initializing...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-md space-y-6">
        
        {/* Main Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
          {session?.user?.email === "admin@executive-command.com" ? (
            <div className="space-y-6 text-center">
              <h1 className="text-2xl font-bold text-white">Admin Session Active</h1>
              <div className="text-blue-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-sm">
                You are currently authenticated at the Command level.
              </div>
              <button onClick={() => window.location.href = '/'} className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors">
                Return to Command Center
              </button>
              <button onClick={() => supabase.auth.signOut()} className="w-full text-xs text-zinc-500 pt-4 border-t border-zinc-800 hover:text-white transition-colors">
                Sign Out & Disconnect
              </button>
            </div>
          ) : !session ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <h1 className="text-2xl font-bold text-center">{isLoginMode ? "Fleet Authentication" : "Register Handler"}</h1>
              <input type="text" placeholder="Handler ID" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <input type="password" placeholder="Passcode" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              
              {status.type === "error" && <div className="text-red-400 text-sm">{status.msg}</div>}
              
              <button type="submit" disabled={status.type === "loading"} className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200">
                {isLoginMode ? "Login" : "Register"}
              </button>
              <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="w-full text-xs text-blue-400 mt-4">
                {isLoginMode ? "Need an account?" : "Already have an ID?"}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold">Submit KPI</h1>
                <p className="text-sm text-zinc-400">ID: {session.user.email.split("@")[0]}</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="url" placeholder="https://facebook.com/..." required value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
                {status.type !== "idle" && <div className={`text-sm ${status.type === "error" ? "text-red-400" : "text-emerald-400"}`}>{status.msg}</div>}
                <button type="submit" disabled={status.type === "loading"} className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200">Submit</button>
              </form>
              
              <button onClick={() => supabase.auth.signOut()} className="w-full text-xs text-zinc-500 pt-4 border-t border-zinc-800">Sign Out</button>
            </div>
          )}
        </div>

        {/* Manager Personal History Table */}
        {session && session.user.email !== "admin@executive-command.com" && myLogs.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Your Recent Submissions</h2>
            <div className="space-y-3">
              {myLogs.map(log => {
                let isInvalid = false;
                try {
                  const p = new URL(log.url);
                  const path = p.pathname.toLowerCase();
                  if (!["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.com", "fb.watch"].includes(p.hostname) || path.includes("/create")) {
                    isInvalid = true;
                  }
                } catch { isInvalid = true; }

                return (
                  <div key={log.id} className="flex justify-between items-center text-xs p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <a href={log.url} target="_blank" rel="noopener noreferrer" className={`truncate max-w-[200px] sm:max-w-xs ${isInvalid ? 'text-zinc-500 line-through' : 'text-blue-400 hover:underline'}`}>
                      {log.url}
                    </a>
                    <span className="text-zinc-500">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}