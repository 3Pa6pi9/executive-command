"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function SMMGatekeeper() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  useEffect(() => {
    initSMMPortal();
  }, []);

  const initSMMPortal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role === "smm") {
        router.push("/smm");
        return;
      }
    }
    setIsCheckingAuth(false);
    await fetchSanitizedTeamLeaders();
  };

  const fetchSanitizedTeamLeaders = async () => {
    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    if (!json.teamLeaders || json.teamLeaders.length < 9) {
      await fetch("/api/seed", { method: "POST" });
      const retry = await fetch("/api/team-leaders");
      const retryJson = await retry.json();
      setTeamLeaders(retryJson.teamLeaders || []);
      if (retryJson.teamLeaders?.length > 0) setSelectedTlIds([retryJson.teamLeaders[0].id]);
    } else {
      setTeamLeaders(json.teamLeaders);
      setSelectedTlIds([json.teamLeaders[0].id]);
    }
  };

  const toggleItem = (item: string, list: string[], setList: any) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const handleSMMAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Verifying SMM Credentials..." });

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setStatus({ type: "error", msg: error.message });

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      if (profile?.role !== "smm") {
        await supabase.auth.signOut();
        return setStatus({ type: "error", msg: "Access Denied: This portal is strictly for SMM Handlers. Team Leaders & Admins must use their dedicated portals." });
      }
      router.push("/smm");
    } else {
      if (selectedCountries.length === 0) return setStatus({ type: "error", msg: "Select at least one Country." });
      if (selectedTlIds.length === 0) return setStatus({ type: "error", msg: "Select at least one Team Leader." });
      if (selectedPlatforms.length === 0) return setStatus({ type: "error", msg: "Select at least one Platform." });
      
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(),
          password,
          role: "smm",
          full_name: fullName, 
          country: selectedCountries.join(", "), 
          team_leader_id: selectedTlIds[0],
          team_leader_ids: selectedTlIds,
          platforms: selectedPlatforms
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
        router.push("/smm");
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to create SMM account." });
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse">Verifying SMM Clearance...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
      <div className="w-full max-w-md my-8">
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">Tier 3 — Handler Access</span>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-3">SMM Handler Portal</h1>
          <p className="text-xs text-zinc-500 mt-1">Isolated Social Media Asset & Weekly Metrics Terminal</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-600"></div>
          
          <form onSubmit={handleSMMAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">1. Handler Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter Full Name" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">2. Choose Platform(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {PLATFORMS.map(p => (
                      <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2 px-2 rounded-lg text-xs font-bold uppercase border transition-all ${selectedPlatforms.includes(p) ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">3. Choose Team Leader(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {teamLeaders.map(tl => (
                      <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-left truncate transition-all ${selectedTlIds.includes(tl.id) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        ✓ {tl.full_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">4. Choose Country</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => toggleItem(c, selectedCountries, setSelectedCountries)} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all truncate ${selectedCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">SMM Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="handler@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
            </div>
            
            {status.type !== "idle" && (
              <div className={`text-xs text-center p-2.5 rounded-lg border ${status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={status.type === "loading"} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-500 transition-colors disabled:opacity-50">
              {status.type === "loading" ? "Verifying..." : isLoginMode ? "Sign In to SMM Workspace" : "Complete SMM Registration"}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setStatus({ type: "idle", msg: "" }); }} className="text-xs text-zinc-400 hover:text-white transition-colors underline">
                {isLoginMode ? "New SMM Handler? Create Account" : "Already registered? Sign In"}
              </button>
            </div>
          </form>
        </div>

        {/* Separated Role Portal Links */}
        <div className="mt-6 flex justify-between items-center text-xs text-zinc-500 border-t border-zinc-900 pt-4 px-2">
          <Link href="/team-leader" className="hover:text-blue-400 transition-colors">🛡 Team Leader Portal →</Link>
          <Link href="/admin" className="hover:text-emerald-400 transition-colors">👑 Admin Command Vault →</Link>
        </div>
      </div>
    </div>
  );
}
