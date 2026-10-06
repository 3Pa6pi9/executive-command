"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Toggle between Login and Sign Up mode
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: isLoginMode ? "Authenticating..." : "Provisioning Account..." });

    // Swapped to the isolated domain structure
    const formattedEmail = `${username.toLowerCase().trim()}@executive-command.local`;

    if (isLoginMode) {
      // LOGIN LOGIC
      const { error } = await supabase.auth.signInWithPassword({ 
        email: formattedEmail, 
        password 
      });

      if (error) {
        setStatus({ type: "error", msg: "Invalid Handler ID or Passcode." });
      } else {
        setStatus({ type: "idle", msg: "" });
      }
    } else {
      // SIGN UP LOGIC
      if (password.length < 6) {
        setStatus({ type: "error", msg: "Passcode must be at least 6 characters." });
        return;
      }

      const { error } = await supabase.auth.signUp({ 
        email: formattedEmail, 
        password 
      });

      if (error) {
        setStatus({ type: "error", msg: error.message.includes("already registered") 
          ? "This Handler ID is already taken." 
          : error.message 
        });
      } else {
        setStatus({ type: "idle", msg: "" });
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUrl("");
    setUsername("");
    setPassword("");
    setStatus({ type: "idle", msg: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setStatus({ type: "loading", msg: "Submitting link..." });
    
    const handlerIdentity = session.user.email.split("@")[0]; 

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, handler_name: handlerIdentity }),
      });
      
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", msg: "KPI Successfully Logged." });
        setUrl("");
      } else {
        setStatus({ type: "error", msg: data.error || "Submission failed." });
      }
    } catch (err) {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    }
  };

  if (isCheckingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Initializing Secure Connection...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100 font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
        
        {!session ? (
          <>
            <div className="space-y-2 text-center relative z-10">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {isLoginMode ? "Fleet Authentication" : "Register Handler"}
              </h1>
              <p className="text-sm text-zinc-400">
                {isLoginMode ? "Authorized personnel only." : "Create your secure KPI account."}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Handler ID</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder={isLoginMode ? "e.g. manager1" : "Choose a unique ID"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Passcode</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {status.type === "error" && (
                <div className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-400 border border-red-500/20">
                  {status.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={status.type === "loading"}
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 focus:outline-none transition-all disabled:opacity-50"
              >
                {status.type === "loading" 
                  ? "Processing..." 
                  : isLoginMode ? "Secure Login" : "Create Account"}
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-800/50 mt-6 relative z-10 text-center">
              <button 
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setStatus({ type: "idle", msg: "" });
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isLoginMode ? "Don't have an ID? Register here." : "Already have an ID? Log in."}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center relative z-10">
              <h1 className="text-2xl font-bold tracking-tight text-white">KPI Submission</h1>
              <p className="text-sm text-zinc-400 flex items-center justify-center gap-1">
                Active Session: <span className="font-semibold text-blue-400">{session.user.email.split("@")[0]}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Post URL</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="https://facebook.com/..."
                />
              </div>

              {status.type !== "idle" && (
                <div className={`rounded-lg p-3 text-sm font-medium ${
                  status.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : 
                  status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                  "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  {status.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={status.type === "loading"}
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 focus:outline-none transition-all disabled:opacity-50"
              >
                {status.type === "loading" ? "Processing..." : "Submit KPI"}
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-800/50 mt-6 relative z-10">
              <button 
                onClick={handleLogout}
                className="w-full text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Sign Out & Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}