"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function TeamLeaderPortal() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tlName, setTlName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string | null>(null);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  // Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [broadcastCampaign, setBroadcastCampaign] = useState("");
  const [broadcastTask, setBroadcastTask] = useState("");

  // Flexible Give Asset State
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [handoverType, setHandoverType] = useState<"credentials_only" | "account_only" | "full">("account_only");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignEmailPass, setAssignEmailPass] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignProject, setAssignProject] = useState("General Campaign");

  useEffect(() => {
    let channel: any;
    verifyTeamLeaderSession().then((tlId) => {
      if (!tlId) return;
      channel = supabase
        .channel("tl-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          triggerPulse();
          loadSquadData(tlId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => {
          triggerPulse();
          loadSquadData(tlId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => {
          triggerPulse();
          loadSquadData(tlId);
        })
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const triggerPulse = () => {
    setLiveSyncPulse(true);
    setTimeout(() => setLiveSyncPulse(false), 1200);
  };

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return null; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      setAuthMsg("Unauthorized: Only verified Team Leaders can access this portal.");
      setIsCheckingAuth(false);
      return null;
    }

    setTlProfile(prof);
    setSetFullName(prof.full_name || "");
    setSetCountries((prof.country || "Africa").split(",").map((s: string) => s.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
    return prof.id;
  };

  const handleTLAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating Team Leader...");

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setAuthMsg(error.message);

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      if (!prof || prof.role !== "team_leader") {
        await supabase.auth.signOut();
        return setAuthMsg("Security Block: SMMs and non-TL accounts are strictly forbidden from the Team Leader portal.");
      }

      setTlProfile(prof);
      setSetFullName(prof.full_name || "");
      setSetCountries((prof.country || "Africa").split(",").map((s: string) => s.trim()).filter(Boolean));
      await loadSquadData(prof.id);
    } else {
      if (selectedCountries.length === 0) return setAuthMsg("Select at least one Country.");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: "team_leader",
          full_name: tlName,
          country: selectedCountries.join(", ")
        })
      });
      const data = await res.json();
      if (res.ok) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
        await verifyTeamLeaderSession();
      } else {
        setAuthMsg(data.error || "Failed to register Team Leader.");
      }
    }
  };

  const loadSquadData = async (tlId: string) => {
    const { data: mySmms } = await supabase.from("profiles").select("*").eq("role", "smm");
    const filteredSmms = (mySmms || []).filter(s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId)));
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);

    const { data: assets } = await supabase.from("social_assets").select("*").order("created_at", { ascending: false });
    setSquadAssets(assets || []);

    const { data: metrics } = await supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false });
    setSquadMetrics(metrics || []);
  };

  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name}'s weekly Asset metric input is now ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
  };

  const handleBatchSquadLock = async (lockState: boolean) => {
    const smmIds = squadMembers.map(s => s.id);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch_lock", payload: { smmIds, is_locked: lockState } })
    });
    setStatusMsg(`All ${smmIds.length} Squad Managers are now ${lockState ? "LOCKED 🔒" : "UNLOCKED 🔓"} live!`);
  };

  const handleBroadcastDirective = async () => {
    const assetIds = squadAssets.map(a => a.id);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "broadcast_directive",
        payload: { assetIds, tl_campaign: broadcastCampaign, tl_task: broadcastTask }
      })
    });
    setBroadcastCampaign(""); setBroadcastTask("");
    setStatusMsg(`Directive broadcasted live across ${assetIds.length} Squad Assets!`);
  };

  const handleSaveTLSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_profile",
        userId: tlProfile.id,
        payload: { full_name: setFullName, country: setCountries.join(", ") }
      })
    });

    if (newPassword.trim()) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_password",
          userId: tlProfile.id,
          payload: { newPassword: newPassword.trim() }
        })
      });
      setNewPassword("");
    }

    const { data: updated } = await supabase.from("profiles").select("*").eq("id", tlProfile.id).single();
    if (updated) setTlProfile(updated);
    setStatusMsg("Team Leader settings saved & synced live!");
    setShowSettings(false);
  };

  const handleUpdateAssetDirectives = async (assetId: string, tl_campaign: string, tl_task: string, tl_comment: string) => {
    await supabase.from("social_assets").update({ tl_campaign, tl_task, tl_comment }).eq("id", assetId);
    setStatusMsg("Directives & comments synced live to Asset!");
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this Asset from the manager?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    setStatusMsg("Asset removed.");
  };

  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("social_assets").insert([{
      smm_id: assignSmmId,
      team_leader_id: tlProfile.id,
      platform: assignPlatform,
      account_id: handoverType === "credentials_only" ? "Pending Setup (Email Handover)" : (assignAccountId || "Pending"),
      account_password: handoverType === "credentials_only" ? null : assignPass,
      email: handoverType === "account_only" ? null : assignEmail,
      email_password: handoverType === "account_only" ? null : assignEmailPass,
      profile_link: assignLink || null,
      project_name: assignProject,
      status: "active"
    }]);
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignPass(""); setAssignEmail(""); setAssignEmailPass(""); setAssignLink("");
    setStatusMsg("New Asset handed over to manager live!");
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Connecting Team Leader Realtime Stream...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold">Tier 2 — Squad Command</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
            <p className="text-xs text-zinc-500 mt-1">Restricted strictly to verified Agency Team Leaders</p>
          </div>

          <form onSubmit={handleTLAuth} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500"></div>
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Name</label>
                  <input type="text" required value={tlName} onChange={(e) => setTlName(e.target.value)} placeholder="e.g. Josiah, Jeff, Ali" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border truncate ${selectedCountries.includes(c) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="josiah@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
            </div>

            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm">
              {isLoginMode ? "Authenticate Team Leader" : "Complete Team Leader Creation"}
            </button>

            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthMsg(""); }} className="text-xs text-zinc-400 hover:text-white underline">
                {isLoginMode ? "Create New Team Leader Account" : "Return to Team Leader Login"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSmmObj = squadMembers.find(m => m.id === selectedSmm);
  const filteredAssets = selectedSmm ? squadAssets.filter(a => a.smm_id === selectedSmm) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header with Live Sync Badge */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold">
                Tier 2 — Team Leader Command
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {tlProfile.country} • Squad SMMs: {squadMembers.length} • Total Squad Assets: {squadAssets.length}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setShowGiveModal(!showGiveModal)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">
              + Give Asset to Manager
            </button>
            <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-blue-500 rounded-lg text-xs font-bold text-zinc-200">
              ⚙ Squad & Profile Settings
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* Flexible Give Asset Modal */}
        {showGiveModal && (
          <form onSubmit={handleGiveAsset} autoComplete="off" className="bg-zinc-950 border border-emerald-500/40 p-6 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-emerald-400 uppercase">Give / Hand Over Asset to Squad Manager</h3>
              <button type="button" onClick={() => setShowGiveModal(false)} className="text-xs text-zinc-500 hover:text-white">✕ Close</button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 bg-black rounded-lg border border-zinc-800">
              <button type="button" onClick={() => setHandoverType("account_only")} className={`py-2 text-xs font-bold rounded ${handoverType === "account_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>
                1. Existing Account (Username & Pass)
              </button>
              <button type="button" onClick={() => setHandoverType("credentials_only")} className={`py-2 text-xs font-bold rounded ${handoverType === "credentials_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>
                2. Setup Task (Email & Pass Only)
              </button>
              <button type="button" onClick={() => setHandoverType("full")} className={`py-2 text-xs font-bold rounded ${handoverType === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>
                3. Full Vault Handover
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Select Manager</label>
                <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white">
                  {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Platform</label>
                <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white uppercase">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Project / Campaign</label>
                <input type="text" required value={assignProject} onChange={(e) => setAssignProject(e.target.value)} placeholder="General Campaign" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(handoverType === "account_only" || handoverType === "full") && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Username / @Handle</label>
                    <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="e.g. @SaharaVoiceX" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Password</label>
                    <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Social Media Password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  </div>
                </>
              )}

              {(handoverType === "credentials_only" || handoverType === "full") && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Handover Email (For account creation)</label>
                    <input type="email" required value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="asset_email@domain.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Email Password</label>
                    <input type="text" required value={assignEmailPass} onChange={(e) => setAssignEmailPass(e.target.value)} placeholder="Password for that email" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Profile Link (Optional)</label>
              <input type="url" value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="https://x.com/account" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
            </div>

            <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">
              Confirm Asset Handover
            </button>
          </form>
        )}

        {/* Squad Managers Grid */}
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Click any Squad Manager to slide open their Assets & Directives panel on the right
            </h2>
            <div className="flex gap-2">
              <button onClick={() => handleBatchSquadLock(true)} className="px-3 py-1 bg-red-500/15 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-black transition-all">
                🔒 Lock All Squad Inputs
              </button>
              <button onClick={() => handleBatchSquadLock(false)} className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-black transition-all">
                🔓 Unlock All Squad Inputs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadMembers.map(smm => {
              const isSelected = selectedSmm === smm.id;
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmAssetIds = smmAssets.map(a => a.id);
              const smmLogs = squadMetrics.filter(m => smmAssetIds.includes(m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => setSelectedSmm(smm.id)}
                  className={`group cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                    isSelected
                      ? "bg-zinc-900 border-blue-500 ring-1 ring-blue-400"
                      : "bg-zinc-950 border-zinc-800 hover:border-blue-500/60 hover:-translate-y-1 hover:shadow-xl"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Assets</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        smm.is_locked
                          ? "bg-red-500/20 border-red-500/40 text-red-400"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      }`}
                    >
                      {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-xs text-blue-400 font-bold">
                    <span>Slide Open {smmAssets.length} Assets</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              );
            })}
            {squadMembers.length === 0 && <div className="col-span-3 text-zinc-500 text-sm p-6 bg-zinc-950 border border-zinc-800 rounded-xl">No SMMs have registered under your Team Leader profile yet.</div>}
          </div>
        </div>

      </div>

      {/* SLIDE-OVER RIGHT PANEL FOR SELECTED SMM MANAGER'S ASSETS */}
      {activeSmmObj && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setSelectedSmm(null)}>
          <div
            className="w-full max-w-2xl bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">
                  Manager Asset Inspector
                </span>
                <h2 className="text-2xl font-bold text-white mt-2">
                  {activeSmmObj.full_name}&apos;s Assets ({filteredAssets.length})
                </h2>
                <p className="text-xs text-zinc-400">Assign campaigns, weekly tasks, and comments in real time</p>
              </div>
              <button onClick={() => setSelectedSmm(null)} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white">
                ✕ Close Panel
              </button>
            </div>

            <div className="space-y-4">
              {filteredAssets.map(asset => {
                const latest = squadMetrics.filter(m => m.asset_id === asset.id)[0];
                return (
                  <AssetDirectiveCard
                    key={asset.id}
                    asset={asset}
                    ownerName={activeSmmObj.full_name}
                    latestMetric={latest}
                    onSave={handleUpdateAssetDirectives}
                    onRemove={handleRemoveAsset}
                  />
                );
              })}
              {filteredAssets.length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                  {activeSmmObj.full_name} has not been assigned any Assets yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER SQUAD & COMMANDER SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400">Tier 2 Configuration</span>
                <h2 className="text-xl font-bold text-white">Squad & Commander Settings</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-zinc-900 text-xs text-zinc-400">✕ Close</button>
            </div>

            {/* Squad-Wide Directive Broadcast */}
            <div className="p-4 bg-black border border-blue-500/30 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-blue-400">📢 Broadcast Directive to All Squad Assets ({squadAssets.length})</h3>
              <input type="text" value={broadcastCampaign} onChange={(e) => setBroadcastCampaign(e.target.value)} placeholder="Global Squad Campaign Name" className="w-full rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" value={broadcastTask} onChange={(e) => setBroadcastTask(e.target.value)} placeholder="Global Weekly Squad Task" className="w-full rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              <button type="button" onClick={handleBroadcastDirective} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs">
                Push Directive to All Squad Assets Live
              </button>
            </div>

            {/* Commander Profile Form */}
            <form onSubmit={handleSaveTLSettings} className="space-y-4 border-t border-zinc-800 pt-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Commander Display Name</label>
                <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {HIERARCHY_COUNTRIES.map(c => (
                    <button type="button" key={c} onClick={() => setSetCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1.5 px-2 rounded text-[11px] font-bold border truncate ${setCountries.includes(c) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Update Commander Password (Optional)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              </div>

              <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-sm">
                Save Commander Settings
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function AssetDirectiveCard({ asset, ownerName, latestMetric, onSave, onRemove }: any) {
  const [campaign, setCampaign] = useState(asset.tl_campaign || "");
  const [task, setTask] = useState(asset.tl_task || "");
  const [comment, setComment] = useState(asset.tl_comment || "");
  const [showVault, setShowVault] = useState(false);

  useEffect(() => {
    setCampaign(asset.tl_campaign || "");
    setTask(asset.tl_task || "");
    setComment(asset.tl_comment || "");
  }, [asset.tl_campaign, asset.tl_task, asset.tl_comment]);

  return (
    <div className="bg-black border border-zinc-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">ASSET: {asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVault(!showVault)} className="text-[10px] px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
            {showVault ? "🙈 Hide Vault" : "👁 View Vault"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 hover:underline ml-1">Remove</button>
        </div>
      </div>

      {showVault && (
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 space-y-1">
          <div><b>Asset Profile:</b> {asset.profile_link ? <a href={asset.profile_link} target="_blank" className="text-blue-400 underline">{asset.profile_link}</a> : "Pending Setup"}</div>
          <div><b>Asset ID / Handle:</b> <span className="text-purple-400">{asset.account_id}</span></div>
          <div><b>Asset Pass:</b> <span className="text-emerald-400">{asset.account_password || "Not Provided"}</span></div>
          <div><b>Asset Email:</b> {asset.email || "Not Provided"} {asset.email_password ? `(Pass: ${asset.email_password})` : ""}</div>
          <div><b>Asset 2FA:</b> {asset.two_fa_code || "None"} • <b>Phone:</b> {asset.phone_number || "N/A"}</div>
        </div>
      )}

      {latestMetric ? (
        <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 p-3 rounded-lg text-xs font-mono">
          <div><span className="text-[10px] text-zinc-500 block">WEEK</span>{latestMetric.week_of}</div>
          <div><span className="text-[10px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold">{latestMetric.impressions.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">ENG</span><span className="text-purple-400 font-bold">{latestMetric.engagements.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">FOLLOWERS</span><span className="text-emerald-400 font-bold">{latestMetric.total_followers.toLocaleString()}</span></div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">No weekly metrics logged for this Asset yet.</div>
      )}

      <div className="space-y-2 pt-1">
        <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Assign Campaign to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Assign Weekly Task to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave Comment on Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        <button onClick={() => onSave(asset.id, campaign, task, comment)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs">
          Save Directives & Comments
        </button>
      </div>
    </div>
  );
}
