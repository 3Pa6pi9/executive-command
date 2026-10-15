"use client";

import { useState, useEffect, useCallback } from "react";
import { tlSupabase as supabase, broadcastRealtimeSync } from "@/lib/supabase";
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
  const [motd, setMotd] = useState("");
  const [lastSync, setLastSync] = useState("Live");
  const [statusMsg, setStatusMsg] = useState("");

  // Drawers
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Give Asset Form
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignProject, setAssignProject] = useState("General Campaign");

  // Commander Settings State
  const [editTlName, setEditTlName] = useState("");
  const [editTlCountries, setEditTlCountries] = useState<string[]>([]);
  const [editTlPassword, setEditTlPassword] = useState("");
  const [bulkCampaign, setBulkCampaign] = useState("");
  const [bulkTask, setBulkTask] = useState("");
  const [bulkComment, setBulkComment] = useState("");

  const loadSquadData = useCallback(async (tlId: string) => {
    const [smmRes, assetRes, metricRes, sysRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "smm"),
      supabase.from("social_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false }),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    const filteredSmms = (smmRes.data || []).filter(
      s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId))
    );
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);

    const smmIdSet = new Set(filteredSmms.map(s => s.id));
    const mySquadAssets = (assetRes.data || []).filter(
      a => a.team_leader_id === tlId || smmIdSet.has(a.smm_id)
    );
    setSquadAssets(mySquadAssets);
    setSquadMetrics(metricRes.data || []);
    if (sysRes.data?.motd) setMotd(sysRes.data.motd);
    setLastSync(new Date().toLocaleTimeString());
  }, [assignSmmId]);

  useEffect(() => {
    verifyTeamLeaderSession();
  }, []);

  // Live Realtime Sync Subscription
  useEffect(() => {
    if (!tlProfile?.id) return;

    const pgChannel = supabase
      .channel("tl-postgres-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadSquadData(tlProfile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => loadSquadData(tlProfile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => loadSquadData(tlProfile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => loadSquadData(tlProfile.id))
      .subscribe();

    const broadcastChannel = supabase
      .channel("executive-live-sync")
      .on("broadcast", { event: "db-sync" }, () => loadSquadData(tlProfile.id))
      .subscribe();

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [tlProfile?.id, loadSquadData]);

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsCheckingAuth(false);
      return;
    }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      setAuthMsg("Unauthorized: Only verified Team Leaders can access this portal.");
      setIsCheckingAuth(false);
      return;
    }

    setTlProfile(prof);
    setEditTlName(prof.full_name || "");
    setEditTlCountries((prof.country || "Africa").split(",").map((c: string) => c.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
  };

  const notifyAndReload = async (msg: string) => {
    setStatusMsg(msg);
    if (tlProfile?.id) await loadSquadData(tlProfile.id);
    await broadcastRealtimeSync("team_leader");
    setTimeout(() => setStatusMsg(""), 4000);
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
        return setAuthMsg("Security Block: Non-TL accounts are forbidden from the Team Leader portal.");
      }

      setTlProfile(prof);
      setEditTlName(prof.full_name || "");
      setEditTlCountries((prof.country || "Africa").split(",").map((c: string) => c.trim()).filter(Boolean));
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

  const handleToggleLock = async (smm: any) => {
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_profile", id: smm.id, is_locked: !smm.is_locked }),
    });
    await notifyAndReload(`${smm.full_name}'s weekly metric input is now ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
  };

  const handleBulkSquadLock = async (lockState: boolean) => {
    const ids = squadMembers.map(s => s.id);
    if (ids.length === 0) return;
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_lock_smms", is_locked: lockState, smm_ids: ids }),
    });
    await notifyAndReload(lockState ? "🔒 Locked all Squad SMMs!" : "🔓 Unlocked all Squad SMMs!");
  };

  const handleBulkSquadDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    const assetIds = squadAssets.map(a => a.id);
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_squad_directive",
        asset_ids: assetIds,
        tl_campaign: bulkCampaign,
        tl_task: bulkTask,
        tl_comment: bulkComment,
      }),
    });
    if (res.ok) {
      setBulkCampaign(""); setBulkTask(""); setBulkComment("");
      await notifyAndReload(`📢 Broadcasted directives across all ${assetIds.length} squad assets!`);
    }
  };

  const handleSaveCommanderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const countryStr = editTlCountries.join(", ");
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_profile", id: tlProfile.id, full_name: editTlName, country: countryStr }),
    });
    if (editTlPassword && editTlPassword.length >= 6) {
      await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_auth", id: tlProfile.id, password: editTlPassword }),
      });
      setEditTlPassword("");
    }
    setTlProfile((prev: any) => ({ ...prev, full_name: editTlName, country: countryStr }));
    await notifyAndReload("✅ Commander profile & security settings saved live!");
  };

  const handleUpdateAssetFull = async (assetId: string, updates: Record<string, any>) => {
    await supabase.from("social_assets").update(updates).eq("id", assetId);
    await notifyAndReload("✅ Asset updated and synced live!");
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this Asset from the manager?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    await notifyAndReload("🗑 Asset removed.");
  };

  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("social_assets").insert([{
      smm_id: assignSmmId,
      team_leader_id: tlProfile.id,
      platform: assignPlatform,
      account_id: assignAccountId,
      profile_link: assignLink,
      account_password: assignPass,
      project_name: assignProject,
      status: "active"
    }]);
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignLink(""); setAssignPass("");
    await notifyAndReload("✅ New Asset assigned to manager live!");
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Verifying Team Leader Clearance...</div>;

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
                  <input type="text" required value={tlName} onChange={(e) => setTlName(e.target.value)} placeholder="e.g. Josiah, Jeff, Ali" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
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
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="josiah@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
            </div>

            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm transition-all">
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
        
        {motd && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <span className="font-bold uppercase bg-emerald-500 text-black px-2 py-0.5 rounded text-[10px]">HQ Broadcast</span>
            <span>{motd}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
                Tier 2 — Team Leader Command
              </span>
              <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-blue-400 px-2.5 py-1 rounded-full">
                ⚡ LIVE SQUAD SYNC ({lastSync})
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {tlProfile.country} • Squad SMMs: {squadMembers.length} • Squad Assets: {squadAssets.length}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => { setShowSettingsModal(!showSettingsModal); setShowGiveModal(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                showSettingsModal ? "bg-blue-500 text-black border-blue-400" : "bg-zinc-900 text-blue-400 border-blue-500/40"
              }`}
            >
              ⚙ Commander Settings & Bulk Controls
            </button>
            <button onClick={() => { setShowGiveModal(!showGiveModal); setShowSettingsModal(false); }} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">
              + Give Asset to Manager
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* COMMANDER SETTINGS & BULK CONTROLS DRAWER */}
        {showSettingsModal && (
          <div className="bg-zinc-950 border border-blue-500/40 p-6 rounded-2xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-blue-400 uppercase">⚙ Commander Profile, Security & Squad-Wide Controls</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-xs text-zinc-400 hover:text-white">Close ✕</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commander Profile Form */}
              <form onSubmit={handleSaveCommanderSettings} className="bg-black border border-zinc-800 p-5 rounded-xl space-y-4">
                <h4 className="text-xs font-bold uppercase text-white">1. My Commander Profile & Password</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Commander Name</label>
                    <input type="text" required value={editTlName} onChange={(e) => setEditTlName(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">New Password (Optional)</label>
                    <input type="password" value={editTlPassword} onChange={(e) => setEditTlPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Regions / Countries</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setEditTlCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                        className={`py-1 px-2 rounded text-[10px] font-bold border truncate ${editTlCountries.includes(c) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-zinc-950 border-zinc-800 text-zinc-500"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs">
                  Save Commander Settings Live
                </button>
              </form>

              {/* Squad Bulk Operations */}
              <div className="bg-black border border-zinc-800 p-5 rounded-xl space-y-4">
                <h4 className="text-xs font-bold uppercase text-white">2. Squad-Wide Bulk Lock & Broadcast</h4>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleBulkSquadLock(true)} className="flex-1 py-2 bg-red-500/20 hover:bg-red-500 hover:text-black border border-red-500/40 text-red-400 font-bold rounded-lg text-xs transition-all">
                    🔒 Lock All {squadMembers.length} Squad SMMs
                  </button>
                  <button type="button" onClick={() => handleBulkSquadLock(false)} className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 font-bold rounded-lg text-xs transition-all">
                    🔓 Unlock All {squadMembers.length} Squad SMMs
                  </button>
                </div>

                <form onSubmit={handleBulkSquadDirective} className="space-y-2.5 pt-2 border-t border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Push a directive to all {squadAssets.length} assets in your squad simultaneously:</div>
                  <input type="text" value={bulkCampaign} onChange={(e) => setBulkCampaign(e.target.value)} placeholder="Squad-Wide Campaign Name" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                  <input type="text" value={bulkTask} onChange={(e) => setBulkTask(e.target.value)} placeholder="Squad-Wide Weekly Task" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                  <input type="text" value={bulkComment} onChange={(e) => setBulkComment(e.target.value)} placeholder="Squad-Wide Commander Note" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                  <button type="submit" className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs">
                    📢 Broadcast Directive to All Squad Assets
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Give Asset Modal Drawer */}
        {showGiveModal && (
          <form onSubmit={handleGiveAsset} autoComplete="off" className="bg-zinc-950 border border-emerald-500/40 p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-emerald-400 uppercase">Give / Assign Asset to Squad Manager</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white">
                {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="text" required value={assignProject} onChange={(e) => setAssignProject(e.target.value)} placeholder="Project / Campaign" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset ID / @Handle" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="url" required value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Asset Profile Link" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>
            <button type="submit" className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs">Confirm Assignment</button>
          </form>
        )}

        {/* 1. Squad Managers Grid */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
              1. Squad Managers Signed Under You (Click Manager Card to Unfold Their Assets)
            </h2>
            {selectedSmm && (
              <button onClick={() => setSelectedSmm(null)} className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                ✕ Collapse Asset Drawer
              </button>
            )}
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
                  onClick={() => setSelectedSmm(isSelected ? null : smm.id)}
                  className={`group cursor-pointer rounded-2xl p-5 border transition-all duration-300 ${
                    isSelected
                      ? "bg-gradient-to-b from-blue-950/40 to-zinc-950 border-blue-500 shadow-lg ring-1 ring-blue-400/50"
                      : "bg-zinc-950 border-zinc-800 hover:border-blue-500/50"
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
                          ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                      }`}
                    >
                      {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>
                </div>
              );
            })}
            {squadMembers.length === 0 && <div className="col-span-3 text-zinc-500 text-sm p-6 bg-zinc-950 border border-zinc-800 rounded-xl">No SMMs have registered under your Team Leader profile yet.</div>}
          </div>
        </div>

        {/* 2. Expandable Drawer for Selected Manager's Assets */}
        {activeSmmObj && (
          <div className="bg-zinc-950/95 border border-blue-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  Unfolded Manager Asset Vault
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">
                  {activeSmmObj.full_name}&apos;s Managed Assets ({filteredAssets.length})
                </h2>
              </div>
              <button onClick={() => setSelectedSmm(null)} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                Collapse Drawer ▲
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssets.map(asset => {
                const latest = squadMetrics.filter(m => m.asset_id === asset.id)[0];
                return (
                  <AssetDirectiveCard
                    key={asset.id}
                    asset={asset}
                    ownerName={activeSmmObj.full_name}
                    squadMembers={squadMembers}
                    latestMetric={latest}
                    onSave={handleUpdateAssetFull}
                    onRemove={handleRemoveAsset}
                  />
                );
              })}
              {filteredAssets.length === 0 && (
                <div className="col-span-2 text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                  {activeSmmObj.full_name} has not registered any Social Media Assets yet.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function AssetDirectiveCard({ asset, ownerName, squadMembers, latestMetric, onSave, onRemove }: any) {
  const [campaign, setCampaign] = useState(asset.tl_campaign || "");
  const [task, setTask] = useState(asset.tl_task || "");
  const [comment, setComment] = useState(asset.tl_comment || "");
  const [showVault, setShowVault] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [accountId, setAccountId] = useState(asset.account_id || "");
  const [profileLink, setProfileLink] = useState(asset.profile_link || "");
  const [accountPassword, setAccountPassword] = useState(asset.account_password || "");
  const [projectName, setProjectName] = useState(asset.project_name || "General Campaign");
  const [smmId, setSmmId] = useState(asset.smm_id || "");
  const [status, setStatus] = useState(asset.status || "active");

  useEffect(() => {
    setCampaign(asset.tl_campaign || "");
    setTask(asset.tl_task || "");
    setComment(asset.tl_comment || "");
    setStatus(asset.status || "active");
  }, [asset]);

  return (
    <div className="bg-black border border-zinc-800 hover:border-blue-500/40 rounded-xl p-5 space-y-4 transition-all">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">{asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-zinc-500 ml-2">({ownerName})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setEditMode(!editMode)} className="text-[10px] px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-blue-300">
            {editMode ? "Cancel" : "✎ Edit"}
          </button>
          <button onClick={() => setShowVault(!showVault)} className="text-[10px] px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
            {showVault ? "🙈 Hide" : "👁 Vault"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 hover:underline ml-1">✕</button>
        </div>
      </div>

      {showVault && (
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 space-y-1">
          <div><b>Asset Profile:</b> <a href={asset.profile_link} target="_blank" className="text-blue-400 underline">{asset.profile_link}</a></div>
          <div><b>Asset Pass:</b> <span className="text-emerald-400">{asset.account_password}</span></div>
          <div><b>Asset Email:</b> {asset.email} (<b>Pass:</b> {asset.email_password})</div>
          <div><b>Asset 2FA:</b> {asset.two_fa_code || "None"} • <b>Phone:</b> {asset.phone_number || "N/A"}</div>
        </div>
      )}

      {editMode && (
        <div className="p-3.5 bg-zinc-950 border border-blue-500/40 rounded-lg space-y-2.5 text-xs">
          <div className="font-bold text-blue-400 uppercase text-[10px]">Edit Asset Credentials & Assignment</div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Asset Handle" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project Name" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="url" value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="Profile URL" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Password" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <select value={smmId} onChange={(e) => setSmmId(e.target.value)} className="rounded bg-black border border-zinc-800 p-2 text-white">
              {squadMembers.map((m: any) => <option key={m.id} value={m.id}>Assign: {m.full_name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded bg-black border border-zinc-800 p-2 text-white">
              <option value="active">Status: ACTIVE</option>
              <option value="suspended">Status: SUSPENDED</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              onSave(asset.id, { account_id: accountId, project_name: projectName, profile_link: profileLink, account_password: accountPassword, smm_id: smmId, status });
              setEditMode(false);
            }}
            className="w-full py-2 bg-emerald-500 text-black font-bold rounded text-xs"
          >
            Save Asset Changes Live
          </button>
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
        <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Assign Campaign to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white outline-none" />
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Assign Weekly Task to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white outline-none" />
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave Comment on Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white outline-none" />
        <button onClick={() => onSave(asset.id, { tl_campaign: campaign, tl_task: task, tl_comment: comment })} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-all">
          Save Directives & Comments Live
        </button>
      </div>
    </div>
  );
}
