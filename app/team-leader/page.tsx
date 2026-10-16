"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  TimeHorizon,
  normalizeAuthUsername,
  fetchAllRows,
  exportHorizonCSV,
  computeAchievements,
} from "@/lib/constants";
import {
  usePortalTheme,
  ThemePickerDropdown,
  useRealtimePresence,
  LiveOnlineRosterPill,
  AssetGrowthModal,
  UniversalAssetEditModal,
  SMMSpotlightModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  CampaignDispatchWizard,
  ExecutiveAnalyticsGraphs,
} from "@/components/EnterpriseUI";

export default function TeamLeaderPortal() {
  const { themeId, changeTheme, currentTheme } = usePortalTheme();
  const [tlProfile, setTlProfile] = useState<any>(null);
  const { onlineUsers, onlineIds } = useRealtimePresence(supabase, tlProfile);
  const [allTeamLeaders, setAllTeamLeaders] = useState<any[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"squad" | "campaign" | "assets" | "graphs" | "achievements">("squad");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  // Blurred Spotlight view-Up Windows for SMMs and Assets
  const [spotlightSmm, setSpotlightSmm] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [setPlatforms, setSetPlatforms] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");

  const [showCreateSmmModal, setShowCreateSmmModal] = useState(false);
  const [newSmmName, setNewSmmName] = useState("");
  const [newSmmEmail, setNewSmmEmail] = useState("");
  const [newSmmPass, setNewSmmPass] = useState("");
  const [newSmmCountries, setNewSmmCountries] = useState<string[]>(["Kenya"]);
  const [newSmmPlatforms, setNewSmmPlatforms] = useState<string[]>(["twitter"]);

  const [editingSmm, setEditingSmm] = useState<any>(null);
  const [editSmmCountries, setEditSmmCountries] = useState<string[]>([]);
  const [editSmmPlatforms, setEditSmmPlatforms] = useState<string[]>([]);
  const [editSmmAssetIds, setEditSmmAssetIds] = useState<string[]>([]);
  const [editSmmNewPass, setEditSmmNewPass] = useState("");

  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignCountry, setAssignCountry] = useState("Kenya");
  const [assignLang, setAssignLang] = useState("English");
  const [assignProject, setAssignProject] = useState("General Campaign");

  useEffect(() => {
    let channel: any;
    verifyTeamLeaderSession().then((tlId) => {
      if (!tlId) return;
      channel = supabase
        .channel("tl-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadSquadData(tlId); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return null; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") { await supabase.auth.signOut(); setIsCheckingAuth(false); return null; }
    setTlProfile(prof);
    setSetFullName(prof.full_name || "");
    setSetCountries((prof.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setSetPlatforms(prof.platforms?.length > 0 ? prof.platforms : PLATFORMS);
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
    return prof.id;
  };

  const handleTLLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/seed", { method: "POST" });
    const authEmail = normalizeAuthUsername(email.trim(), "tl");
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) return setAuthMsg("Invalid @tl username or password.");
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "team_leader") { await supabase.auth.signOut(); return setAuthMsg("Team Leader clearance required."); }
    setTlProfile(prof);
    await loadSquadData(prof.id);
  };

  const loadSquadData = async (tlId: string) => {
    const [allProfs, assets, metrics] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
    ]);
    setAllTeamLeaders(allProfs.filter((p) => p.role === "team_leader"));
    const filteredSmms = allProfs.filter((p) => p.role === "smm" && (p.team_leader_id === tlId || (p.team_leader_ids && p.team_leader_ids.includes(tlId))));
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);
    const smmIds = new Set(filteredSmms.map((s) => s.id));
    setSquadAssets(assets.filter((a: any) => a.team_leader_id === tlId || smmIds.has(a.smm_id)));
    setSquadMetrics(metrics);
  };

  const handleToggleLock = async (smm: any) => {
    setSquadMembers((prev: any[]) => prev.map(m => m.id === smm.id ? { ...m, is_locked: !smm.is_locked } : m));
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "update", payload: { targetId: smm.id, is_locked: !smm.is_locked } }),
    });
    setStatusMsg(`${smm.full_name} is now ${!smm.is_locked ? "LOCKED 🔒" : "OPEN 🔓"}`);
    await loadSquadData(tlProfile.id);
  };

  const handleBatchSquadLock = async (lockState: boolean) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "batch_lock", payload: { smmIds: squadMembers.map((s) => s.id), is_locked: lockState } }),
    });
    setStatusMsg(lockState ? "🔒 All Squad SMMs Locked!" : "🔓 All Squad SMMs Unlocked!");
    await loadSquadData(tlProfile.id);
  };

  const handleSaveTLSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "update", payload: { targetId: tlProfile.id, full_name: setFullName, country: setCountries.join(", "), platforms: setPlatforms, newPassword } }),
    });
    setNewPassword(""); setShowSettings(false);
    setStatusMsg("✓ Team Leader Settings Synced Live!");
    await loadSquadData(tlProfile.id);
  };

  const openEditSmmModal = (smm: any) => {
    setEditingSmm({ ...smm });
    setEditSmmCountries((smm.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setEditSmmPlatforms(smm.platforms?.length > 0 ? smm.platforms : ["twitter"]);
    setEditSmmAssetIds(squadAssets.filter((a: any) => a.smm_id === smm.id).map((a: any) => a.id));
    setEditSmmNewPass("");
  };

  const handleSaveEditedSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSmm) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "update",
        payload: { targetId: editingSmm.id, full_name: editingSmm.full_name, country: editSmmCountries.join(", "), platforms: editSmmPlatforms, assignedAssetIds: editSmmAssetIds, newPassword: editSmmNewPass },
      }),
    });
    setEditingSmm(null);
    setStatusMsg("✓ SMM Updated Live!");
    await loadSquadData(tlProfile.id);
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    setSquadAssets((prev: any[]) => prev.map(a => a.id === asset.id ? { ...a, status: newStatus } : a));
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: { id: asset.id, status: newStatus } }),
    });
    setStatusMsg(`Asset marked ${newStatus.toUpperCase()}`);
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "delete", payload: { id: assetId } }),
    });
    setEditingAsset(null);
    setStatusMsg("🗑 Asset removed.");
    await loadSquadData(tlProfile.id);
  };

  const handleSaveEditedAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: updatedAsset }),
    });
    setEditingAsset(null);
    setStatusMsg("✓ All 15 Asset Fields Updated Live!");
    await loadSquadData(tlProfile.id);
  };

  const handleCreateSquadSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "create", payload: { email: newSmmEmail, password: newSmmPass, full_name: newSmmName, country: newSmmCountries.join(", "), platforms: newSmmPlatforms } }),
    });
    if (res.ok) {
      setShowCreateSmmModal(false); setNewSmmName(""); setNewSmmEmail(""); setNewSmmPass("");
      setStatusMsg(`✓ Onboarded SMM ${newSmmName}!`);
      await loadSquadData(tlProfile.id);
    }
  };

  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "asset",
        action: "create",
        payload: { smm_id: assignSmmId, team_leader_id: tlProfile.id, platform: assignPlatform, account_id: assignAccountId, account_password: assignPass, profile_link: assignLink, country_language: assignCountry, language: assignLang, project_name: assignProject, status: "active" },
      }),
    });
    setShowGiveModal(false); setAssignAccountId(""); setAssignPass(""); setAssignLink("");
    setStatusMsg("✓ Asset created & handed over!");
    await loadSquadData(tlProfile.id);
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Connecting TL Stream...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-6 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold">@tl Team Management</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
          </div>
          <form onSubmit={handleTLLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
            <input type="text" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. josiah@tl" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white font-mono" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
            {authMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full min-h-[48px] bg-blue-600 text-white font-bold py-3.5 rounded-xl text-sm">Authenticate @tl</button>
          </form>
          <div className="mt-6 text-center"><Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Portal</Link></div>
        </div>
      </div>
    );
  }

  const q = searchQuery.toLowerCase().trim();
  const squadAchievements = computeAchievements(squadAssets, squadMetrics);
  const activeSpotlightSmm = spotlightSmm ? squadMembers.find((s) => s.id === spotlightSmm.id) || spotlightSmm : null;

  return (
    <div className={`min-h-screen ${currentTheme.shellBg} p-3 sm:p-6 md:p-8 pb-28 md:pb-10 font-sans`}>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">@tl Team Management</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${liveSyncPulse ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>LIVE</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">{tlProfile.full_name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveOnlineRosterPill onlineUsers={onlineUsers} profiles={squadMembers} onSelectSmm={(smm: any) => setSpotlightSmm(smm)} />
            <ThemePickerDropdown themeId={themeId} onChange={changeTheme} />
            <button onClick={() => setActiveTab("campaign")} className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl text-xs shadow-lg">🎯 Give Campaign</button>
            <button onClick={() => setShowCreateSmmModal(true)} className="px-3.5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs">+ SMM</button>
            <button onClick={() => setShowGiveModal(true)} className="px-3.5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">+ Asset</button>
            <button onClick={() => setShowSettings(true)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded-xl text-xs">⚙ Settings</button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 rounded-xl text-xs">Sign Out</button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs text-center font-bold">{statusMsg}</div>}

        <div className="hidden md:flex flex-wrap justify-between items-center gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("squad")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "squad" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>👤 Squad SMMs ({squadMembers.length})</button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>🗂 Squad Assets ({squadAssets.length})</button>
            <button onClick={() => setActiveTab("campaign")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "campaign" ? "bg-purple-600 text-white" : "bg-zinc-900 text-purple-400"}`}>🎯 Give Campaign</button>
            <button onClick={() => setActiveTab("graphs")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300"}`}>📈 Summary Graphs</button>
            <button onClick={() => setActiveTab("achievements")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300"}`}>🏆 Achievements</button>
          </div>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search SMMs or Assets..." className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none" />
        </div>

        {/* TAB 1: SQUAD SMM CARDS (CLICK ANY SMM CARD TO BLUR BACKGROUND & open SMM SPOTLIGHT WINDOW!) */}
        {activeTab === "squad" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {squadMembers
              .filter((s) => !q || (s.full_name || "").toLowerCase().includes(q))
              .map((smm: any) => {
                const smmAssets = squadAssets.filter((a: any) => a.smm_id === smm.id);
                const smmLogs = squadMetrics.filter((m) => smmAssets.some((a: any) => a.id === m.asset_id));
                const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
                const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

                return (
                  <div
                    key={smm.id}
                    onClick={() => setSpotlightSmm(smm)}
                    className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-black border border-zinc-800 hover:border-blue-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.45)] space-y-4 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">{smm.full_name}</h3>
                        <p className="text-xs text-zinc-400">🌍 {smm.country}</p>
                        <p className="text-[11px] text-purple-300 mt-0.5">SM: {(smm.platforms || ["twitter"]).join(", ").toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEditSmmModal(smm)} className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-blue-300 text-xs font-bold">✎ Edit</button>
                        <button onClick={() => handleToggleLock(smm)} className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}>{smm.is_locked ? "🔒" : "🔓"}</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-black/80 border border-zinc-900 font-mono text-xs">
                      <div><span className="text-[9px] text-zinc-500 block">ASSETS</span><span className="text-white font-bold text-base">{smmAssets.length}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">ENG</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-400 group-hover:text-blue-300">
                      <span>✨ Tap to open SMM Records</span>
                      <span className="font-bold">↗</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {activeTab === "campaign" && (
          <CampaignDispatchWizard actorId={tlProfile.id} teamLeaders={allTeamLeaders.length > 0 ? allTeamLeaders : [tlProfile]} smms={squadMembers} assets={squadAssets} defaultTlId={tlProfile.id} onSuccess={(msg: any) => { setStatusMsg(msg); loadSquadData(tlProfile.id); setActiveTab("assets"); }} />
        )}

        {activeTab === "assets" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {squadAssets.filter((a: any) => !q || (a.account_id || "").toLowerCase().includes(q)).map((asset) => {
              const isSuspended = asset.status === "suspended";
              const owner = squadMembers.find((s) => s.id === asset.smm_id);
              return (
                <div key={asset.id} onClick={() => setInspectingAsset(asset)} className={`group cursor-pointer bg-zinc-950 border rounded-3xl p-5 space-y-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 ${isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800 hover:border-blue-400"}`}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSetAssetStatus(asset, isSuspended ? "active" : "suspended"); }} className={`absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"}`}>
                    {isSuspended ? "⚠ SUSP" : "● ACTV"} ⇄
                  </button>
                  <span className="px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-20">{asset.account_id}</h3>
                  <p className="text-xs text-zinc-400">🌍 {asset.country_language} • 🗣 {asset.language || "English"} • 👤 {owner?.full_name || "Unassigned"}</p>
                  <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-blue-600/20 text-blue-300 font-bold rounded-xl text-xs">🔍 open Asset</button>
                    <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 text-emerald-400 font-bold rounded-xl text-xs">✎ Edit All 15</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "graphs" && (
          <ExecutiveAnalyticsGraphs assets={squadAssets} metrics={squadMetrics} profiles={[tlProfile, ...squadMembers]} onSelectAsset={(a: any) => setInspectingAsset(a)} titlePrefix={`Team Leader ${tlProfile.full_name} Squad`} />
        )}

        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadAchievements.map((ach) => (
              <div key={ach.id} className={`rounded-2xl p-5 border ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60" : "bg-zinc-950 border-zinc-800 opacity-75"}`}>
                <div className="flex justify-between items-center"><span className="text-3xl">{ach.icon}</span><span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-500"}`}>{ach.unlocked ? "✓ UNLOCKED" : `${ach.progress}%`}</span></div>
                <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BLURRED view-UP SPOTLIGHT WINDOW FOR SMM HANDLER */}
      {activeSpotlightSmm && (
        <SMMSpotlightModal
          smm={activeSpotlightSmm}
          tlName={tlProfile.full_name}
          assets={squadAssets}
          metrics={squadMetrics}
          onClose={() => setSpotlightSmm(null)}
          onSelectAsset={(a: any) => setInspectingAsset(a)}
          onEditAsset={(a: any) => setEditingAsset(a)}
          onToggleAssetStatus={handleSetAssetStatus}
          onEditSmm={(smm: any) => openEditSmmModal(smm)}
          onToggleSmmLock={handleToggleLock}
        />
      )}

      {inspectingAsset && (
        <AssetGrowthModal asset={inspectingAsset} metrics={squadMetrics} profiles={[tlProfile, ...squadMembers]} onClose={() => setInspectingAsset(null)} onEdit={(a: any) => setEditingAsset(a)} onToggleStatus={handleSetAssetStatus} />
      )}

      {editingAsset && (
        <UniversalAssetEditModal asset={editingAsset} teamLeaders={allTeamLeaders.length > 0 ? allTeamLeaders : [tlProfile]} smms={squadMembers} canReassignSmm={true} onClose={() => setEditingAsset(null)} onSave={handleSaveEditedAsset} onDelete={handleRemoveAsset} />
      )}

      {editingSmm && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-3 sm:p-4" onClick={() => setEditingSmm(null)}>
          <form onSubmit={handleSaveEditedSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-zinc-950 border border-blue-500/50 rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">✎ Edit Squad SMM: {editingSmm.full_name}</h3>
              <button type="button" onClick={() => setEditingSmm(null)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" required value={editingSmm.full_name || ""} onChange={(e) => setEditingSmm({ ...editingSmm, full_name: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="password" value={editSmmNewPass} onChange={(e) => setEditSmmNewPass(e.target.value)} placeholder="New password (optional)" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={editSmmPlatforms} onChange={setEditSmmPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={editSmmCountries} onChange={setEditSmmCountries} />
            <FancyEntityMultiSelect label="Assigned Assets" items={squadAssets.map((a: any) => ({ id: a.id, label: `[${(a.platform || "").toUpperCase()}] ${a.account_id}`, sub: a.country_language }))} selectedIds={editSmmAssetIds} onChange={setEditSmmAssetIds} />
            <button type="submit" className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-xs">Save SMM Changes Live</button>
          </form>
        </div>
      )}

      {showCreateSmmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4" onClick={() => setShowCreateSmmModal(false)}>
          <form onSubmit={handleCreateSquadSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-blue-500/40 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">+ Onboard New Squad SMM</h3>
            <input type="text" required value={newSmmName} onChange={(e) => setNewSmmName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={newSmmEmail} onChange={(e) => setNewSmmEmail(e.target.value)} placeholder="Username (e.g. alex@smm)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="password" required value={newSmmPass} onChange={(e) => setNewSmmPass(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={newSmmPlatforms} onChange={setNewSmmPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={newSmmCountries} onChange={setNewSmmCountries} />
            <button type="submit" className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-xs">Create SMM Account Live</button>
          </form>
        </div>
      )}

      {showGiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4" onClick={() => setShowGiveModal(false)}>
          <form onSubmit={handleGiveAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">+ Give / Assign New Social Media Asset</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {squadMembers.map((m) => <option key={m.id} value={m.id}>Assign SMM: {m.full_name}</option>)}
              </select>
              <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={assignCountry} onChange={(e) => setAssignCountry(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ALL_COUNTRIES.map((c) => <option key={c} value={c}>Country: {c}</option>)}
              </select>
              <select value={assignLang} onChange={(e) => setAssignLang(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>Language: {l}</option>)}
              </select>
              <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset Handle (@...)" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Confirm & Hand Over Asset</button>
          </form>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveTLSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-6 space-y-5">
            <h2 className="text-xl font-bold text-white">⚙ Team Leader Settings</h2>
            <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={setPlatforms} onChange={setSetPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={setCountries} onChange={setSetCountries} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs">Save Team Leader Settings Live</button>
            <div className="pt-4 border-t border-zinc-800 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handleBatchSquadLock(true)} className="py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs">🔒 Lock All Squad SMMs</button>
              <button type="button" onClick={() => handleBatchSquadLock(false)} className="py-3 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl text-xs">🔓 Unlock All Squad SMMs</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
