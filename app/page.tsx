"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLATFORMS, AFRICAN_COUNTRIES, EURASIA_SQUAD_COUNTRIES, normalizeAuthUsername } from "@/lib/constants";

export default function SMMGatekeeper() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Ethiopia"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [countryGroup, setCountryGroup] = useState<"african" | "eurasia">("african");
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
    await fetch("/api/seed", { method: "POST" });
    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    setTeamLeaders(json.teamLeaders || []);
    if (json.teamLeaders?.length > 0) setSelectedTlIds([json.teamLeaders[0].id]);
  };

  const toggleItem = (item: string, list: string[], setList: any) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const handleSMMAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Verifying @smm Credentials..." });

    const formattedInput = username.trim().toLowerCase().includes("@") ? username.trim() : `${username.trim()}@smm`;
    const authEmail = normalizeAuthUsername(formattedInput, "smm");

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
      if (error) return setStatus({ type: "error", msg: "Invalid @smm username or password." });

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      if (profile?.role !== "smm") {
        await supabase.auth.signOut();
        return setStatus({ type: "error", msg: "Access Denied: Strictly for @smm handlers. Team Leaders use @tl in the Team Leader Portal." });
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
          email: formattedInput,
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
        await supabase.auth.signInWithPassword({ email: authEmail, password });
        router.push("/smm");
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to create @smm account." });
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse px-4 text-center">Establishing Encrypted Handshake...</div>;

  const displayedCountries = countryGroup === "african" ? AFRICAN_COUNTRIES : EURASIA_SQUAD_COUNTRIES;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-6 sm:p-6 text-zinc-100 font-sans">
      <div className="w-full max-w-lg my-auto">
        <div className="text-center mb-5 sm:mb-6">
          <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
            Tier 3 — @smm Handler Access
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2.5">SMM Handler Portal</h1>
          <p className="text-xs text-zinc-500 mt-1">Sign in with your <b className="text-purple-400">username@smm</b> credentials</p>
        </div>

        <div className="rounded-3xl sm:rounded-2xl border border-zinc-800/90 bg-zinc-950 p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-400"></div>
          
          <form onSubmit={handleSMMAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[11px] uppercase font-bold text-zinc-400 ml-1">1. Handler Full Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter Full Name" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3.5 text-sm focus:border-purple-500 outline-none text-white" />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-zinc-400 ml-1">2. Tap Platform(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {PLATFORMS.map(p => (
                      <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`min-h-[42px] py-2 px-2 rounded-xl text-xs font-bold uppercase border active:scale-95 transition-all ${selectedPlatforms.includes(p) ? "bg-purple-500/25 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-zinc-400 ml-1">3. Tap Team Leader(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {teamLeaders.map(tl => (
                      <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`min-h-[42px] py-2 px-2.5 rounded-xl text-xs font-bold border text-left truncate active:scale-95 transition-all ${selectedTlIds.includes(tl.id) ? "bg-blue-500/25 border-blue-500 text-blue-200" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        ✓ {tl.full_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                    <label className="text-[11px] uppercase font-bold text-zinc-400 ml-1">4. Operational Countries ({selectedCountries.length})</label>
                    <div className="flex gap-1 bg-black p-1 rounded-xl border border-zinc-800">
                      <button type="button" onClick={() => setCountryGroup("african")} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${countryGroup === "african" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}>Africa (20)</button>
                      <button type="button" onClick={() => setCountryGroup("eurasia")} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${countryGroup === "eurasia" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}>Global (14)</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-black/60 rounded-xl border border-zinc-900">
                    {displayedCountries.map(c => (
                      <button type="button" key={c} onClick={() => toggleItem(c, selectedCountries, setSelectedCountries)} className={`min-h-[38px] py-1.5 px-2 rounded-lg text-[11px] font-bold border active:scale-95 transition-all truncate ${selectedCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] uppercase font-bold text-purple-400 ml-1">SMM Username (@smm)</label>
              <input type="text" autoCapitalize="none" autoCorrect="off" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. abebe@smm" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3.5 text-sm focus:border-purple-500 outline-none text-white font-mono" />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-zinc-400 ml-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3.5 text-sm focus:border-purple-500 outline-none text-white" />
            </div>
            
            {status.type !== "idle" && (
              <div className={`text-xs text-center p-3 rounded-xl border ${status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={status.type === "loading"} className="w-full min-h-[48px] bg-purple-600 text-white p-3.5 rounded-xl font-bold hover:bg-purple-500 active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(147,51,234,0.35)]">
              {status.type === "loading" ? "Verifying..." : isLoginMode ? "Sign In with @smm" : "Create @smm Account"}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setStatus({ type: "idle", msg: "" }); }} className="text-xs text-zinc-400 hover:text-white py-2 transition-colors underline">
                {isLoginMode ? "New SMM Handler? Register @smm Username" : "Already registered? Sign In"}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center text-xs text-zinc-400">
          <Link href="/team-leader" className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-blue-500/40 hover:text-blue-400 active:scale-95 transition-all">
            🛡 Team Leader (@tl) →
          </Link>
          <Link href="/admin" className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-emerald-500/40 hover:text-emerald-400 active:scale-95 transition-all">
            👑 Admin Vault →
          </Link>
        </div>
      </div>
    </div>
  );
}
