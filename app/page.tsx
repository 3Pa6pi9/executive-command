"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function MasterGatekeeper() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [role, setRole] = useState<"smm" | "team_leader">("smm");
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  useEffect(() => {
    checkSession();
    fetchTeamLeaders();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await routeUserToDashboard(session.user.id);
    } else {
      setIsCheckingAuth(false);
    }
  };

  const fetchTeamLeaders = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'team_leader');
    if (data) {
      setTeamLeaders(data);
      if (data.length > 0) setSelectedTlIds([data[0].id]);
    }
  };

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const toggleTl = (id: string) => {
    setSelectedTlIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const routeUserToDashboard = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile?.role === 'admin') router.push('/admin');
    else if (profile?.role === 'team_leader') router.push('/team-leader');
    else if (profile?.role === 'smm') router.push('/smm');
    else { setIsCheckingAuth(false); setStatus({ type: "error", msg: "Profile routing error. Contact Admin." }); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Authenticating..." });

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setStatus({ type: "error", msg: error.message });
      if (data.user) await routeUserToDashboard(data.user.id);
    } else {
      if (selectedCountries.length === 0) return setStatus({ type: "error", msg: "Select at least one Country." });
      if (role === 'smm' && selectedTlIds.length === 0) return setStatus({ type: "error", msg: "Select at least one Team Leader." });
      if (role === 'smm' && selectedPlatforms.length === 0) return setStatus({ type: "error", msg: "Select at least one Platform." });
      
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, password, role, full_name: fullName, 
          country: selectedCountries.join(", "), 
          team_leader_id: selectedTlIds[0],
          team_leader_ids: selectedTlIds,
          platforms: selectedPlatforms
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "Registration complete! You can now log in." });
        setIsLoginMode(true);
        fetchTeamLeaders();
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to create account." });
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-500 font-mono text-sm animate-pulse">Establishing Secure Connection...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
      <div className="w-full max-w-md my-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Executive Command</h1>
          <p className="text-sm text-zinc-500 mt-2">3-Tier Enterprise Asset & MEL Architecture</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500"></div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                  <button type="button" onClick={() => setRole('smm')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${role === 'smm' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}>1. SMM / Handler</button>
                  <button type="button" onClick={() => setRole('team_leader')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${role === 'team_leader' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}>2. Team Leader</button>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">{role === 'smm' ? "Handler Name" : "Team Leader Name (Jeff, Ali, Erica, Mani, Jennifer, Beulah, Mamhmdur, Mae, Josiah)"}</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter Name" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Choose Country (Can select multiple)</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => toggleCountry(c)} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all truncate ${selectedCountries.includes(c) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black border-zinc-800 text-zinc-500'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                
                {role === 'smm' && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Choose Platform(s) (Can select multiple)</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {PLATFORMS.map(p => (
                          <button type="button" key={p} onClick={() => togglePlatform(p)} className={`py-2 px-2 rounded-lg text-xs font-bold uppercase border transition-all ${selectedPlatforms.includes(p) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-black border-zinc-800 text-zinc-500'}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Choose Team Leader(s) (Can select multiple)</label>
                      {teamLeaders.length === 0 ? (
                        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded mt-1">No Team Leaders registered yet. Sign up a Team Leader first!</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 mt-1 max-h-36 overflow-y-auto p-1">
                          {teamLeaders.map(tl => (
                            <button type="button" key={tl.id} onClick={() => toggleTl(tl.id)} className={`py-2 px-3 rounded-lg text-xs font-bold border text-left truncate transition-all ${selectedTlIds.includes(tl.id) ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-black border-zinc-800 text-zinc-500'}`}>
                              ✓ {tl.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Login Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
            </div>
            
            {status.type !== "idle" && (
              <div className={`text-xs text-center p-2.5 rounded-lg border ${status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={status.type === "loading"} className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {status.type === "loading" ? "Processing..." : isLoginMode ? "Authenticate" : "Complete Account Creation"}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setStatus({ type: "idle", msg: "" }); }} className="text-xs text-zinc-400 hover:text-white transition-colors underline">
                {isLoginMode ? "Need an account? Sign Up (SMM / Team Leader)" : "Already registered? Return to Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
