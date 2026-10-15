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
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Kenya"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [countryGroup, setCountryGroup] = useState<"african" | "eurasia">("african");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error"; msg: string }>({ type: "idle", msg: "" });

  useEffect(() => { initSMMPortal(); }, []);

  const initSMMPortal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role === "smm") { router.push("/smm"); return; }
    }
    setIsCheckingAuth(false);
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
      if (profile?.role !== "smm") { await supabase.auth.signOut(); return setStatus({ type: "error", msg: "Strictly for @smm handlers." }); }
      router.push("/smm");
    } else {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formattedInput, password, role: "smm", full_name: fullName, country: selectedCountries.join(", "), team_leader_id: selectedTlIds[0], team_leader_ids: selectedTlIds, platforms: selectedPlatforms })
      });
      const data = await res.json();
      if (res.ok) { await supabase.auth.signInWithPassword({ email: authEmail, password }); router.push("/smm"); }
      else setStatus({ type: "error", msg: data.error || "Failed to create @smm account." });
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse">Establishing Handshake...</div>;
  const displayedCountries = countryGroup === "african" ? AFRICAN_COUNTRIES : EURASIA_SQUAD_COUNTRIES;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-6 text-zinc-100 font-sans">
      <div className="w-full max-w-lg my-auto">
        <div className="text-center mb-5">
          <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">@smm Handler Access</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2.5">SMM Handler Portal</h1>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSMMAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="1. Handler Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(p => (
                    <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2 rounded-xl text-xs font-bold uppercase border ${selectedPlatforms.includes(p) ? "bg-purple-500/25 border-purple-500 text-purple-200" : "bg-black border-zinc-800 text-zinc-500"}`}>{p}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {teamLeaders.map(tl => (
                    <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`py-2 px-2 rounded-xl text-xs font-bold border truncate ${selectedTlIds.includes(tl.id) ? "bg-blue-500/25 border-blue-500 text-blue-200" : "bg-black border-zinc-800 text-zinc-500"}`}>✓ {tl.full_name}</button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] uppercase font-bold text-zinc-400">Countries ({selectedCountries.length})</span>
                    <div className="flex gap-1 bg-black p-1 rounded-xl border border-zinc-800">
                      <button type="button" onClick={() => setCountryGroup("african")} className={`px-2 py-0.5 rounded text-[10px] font-bold ${countryGroup === "african" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}>Africa (19)</button>
                      <button type="button" onClick={() => setCountryGroup("eurasia")} className={`px-2 py-0.5 rounded text-[10px] font-bold ${countryGroup === "eurasia" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}>Global (14)</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-1 bg-black rounded-xl border border-zinc-900">
                    {displayedCountries.map(c => (
                      <button type="button" key={c} onClick={() => toggleItem(c, selectedCountries, setSelectedCountries)} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border truncate ${selectedCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <input type="text" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="SMM Username (e.g. handler@smm)" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white font-mono" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
            {status.type === "error" && <div className="text-xs text-center p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">{status.msg}</div>}
            <button type="submit" className="w-full bg-purple-600 text-white p-3.5 rounded-xl font-bold text-sm">{isLoginMode ? "Sign In with @smm" : "Create @smm Account"}</button>
            <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="w-full text-xs text-zinc-400 underline">{isLoginMode ? "New SMM Handler? Register @smm" : "Already registered? Sign In"}</button>
          </form>
        </div>
        <div className="mt-5 text-center text-xs">
          <Link href="/team-leader" className="inline-block px-5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-blue-400">🛡 Switch to Team Leader Portal (@tl) →</Link>
        </div>
      </div>
    </div>
  );
}
