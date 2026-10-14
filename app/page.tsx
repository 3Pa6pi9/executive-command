"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function MasterGatekeeper() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Ethiopia");
  const [role, setRole] = useState<"smm" | "team_leader">("smm");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  
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
      if (data.length > 0) setTeamLeaderId(data[0].id);
    }
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
      if (role === 'smm' && !teamLeaderId) return setStatus({ type: "error", msg: "You must select a Team Leader." });
      
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, full_name: fullName, country, team_leader_id: teamLeaderId })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "Account created successfully! You can now log in." });
        setIsLoginMode(true);
        fetchTeamLeaders();
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to create account." });
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-500 font-mono text-sm animate-pulse">Establishing Secure Connection...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Executive Command</h1>
          <p className="text-sm text-zinc-500 mt-2">Enterprise Asset Management Portal</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500"></div>
          
          <form onSubmit={handleAuth} className="space-y-5">
            {!isLoginMode && (
              <>
                <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                  <button type="button" onClick={() => setRole('smm')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${role === 'smm' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>SMM / Handler</button>
                  <button type="button" onClick={() => setRole('team_leader')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${role === 'team_leader' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>Team Leader</button>
                </div>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={role === 'smm' ? "Handler Name" : "Team Leader Name"} className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
                <input type="text" required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
                
                {role === 'smm' && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Assign Team Leader</label>
                    <select value={teamLeaderId} onChange={(e) => setTeamLeaderId(e.target.value)} className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-zinc-300">
                      {teamLeaders.length === 0 ? <option value="">No Team Leaders Available</option> : teamLeaders.map(tl => (
                        <option key={tl.id} value={tl.id}>{tl.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="System Email" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Secure Password" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-emerald-500 outline-none text-white" />
            
            {status.type !== "idle" && (
              <div className={`text-xs text-center p-2 rounded border ${status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={status.type === "loading"} className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {status.type === "loading" ? "Processing..." : isLoginMode ? "Authenticate" : "Register Credentials"}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setStatus({ type: "idle", msg: "" }); }} className="text-xs text-zinc-500 hover:text-white transition-colors">
                {isLoginMode ? "Initialize new personnel profile" : "Return to authentication portal"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
