"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  normalizeAuthUsername,
  fetchAllRows,
  parseBulkRows,
  aggregateMetricsByHorizon,
  exportHorizonCSV,
  computeAchievements
} from "@/lib/constants";

export default function TeamLeaderPortal() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string | null>(null);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"squad" | "graphs" | "achievements" | "assets" | "bulk">("squad");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [broadcastCampaign, setBroadcastCampaign] = useState("");
  const [broadcastTask, setBroadcastTask] = useState("");

  const [showCreateSmmModal, setShowCreateSmmModal] = useState(false);
  const [newSmmName, setNewSmmName] = useState("");
  const [newSmmEmail, setNewSmmEmail] = useState("");
  const [newSmmPass, setNewSmmPass] = useState("");
  const [newSmmCountry, setNewSmmCountry] = useState("Ethiopia");
  const [editingSmm, setEditingSmm] = useState<any>(null);

  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [handoverType, setHandoverType] = useState<"credentials_only" | "account_only" | "full">("account_only");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignEmailPass, setAssignEmailPass] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignCountry, setAssignCountry] = useState("Ethiopia");
  const [assignProject, setAssignProject] = useState("General Campaign");

  const [bulkType, setBulkType] = useState<"assets" | "smms">("assets");
  const [bulkRawText, setBulkRawText] = useState("");

  useEffect(() => {
    let channel: any;
    verifyTeamLeaderSession().then((tlId) => {
      if (!tlId) return;
      channel = supabase
        .channel("tl-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { triggerPulse(); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { triggerPulse(); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { triggerPulse(); loadSquadData(tlId); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
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
      setAuthMsg("Unauthorized: Verified Team Leaders only.");
      setIsCheckingAuth(false);
      return null;
    }
    setTlProfile(prof);
    setSetFullName(prof.full_name || "");
    setSetCountries((prof.country || "Ethiopia").split(",").map((c: string) => c.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
    return prof.id;
  };

  const handleTLLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating @tl...");
    await fetch("/api/seed", { method: "POST" });
    const authEmail = normalizeAuthUsername(email.trim(), "tl");
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) return setAuthMsg("Invalid @tl username or password.");

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      return setAuthMsg("Security Block: Team Leader clearance required.");
    }
    setTlProfile(prof);
    setSetFullName(prof.full_name || "");
    setSetCountries((prof.country || "Ethiopia").split(",").map((c: string) => c.trim()).filter(Boolean));
    await loadSquadData(prof.id);
  };

  const loadSquadData = async (tlId: string) => {
    const allSmms = await fetchAllRows(supabase, "profiles", "created_at", "role", "smm");
    const filteredSmms = allSmms.filter(s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId)));
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);

    const assets = await fetchAllRows(supabase, "social_assets", "created_at");
    setSquadAssets(assets);

    const metrics = await fetchAllRows(supabase, "weekly_metrics", "week_of");
    setSquadMetrics(metrics);
  };

  const handleSaveTLSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "update",
        payload: {
          targetId: tlProfile.id,
          full_name: setFullName,
          country: setCountries.join(", "),
          newPassword
        }
      })
    });
    setNewPassword("");
    setShowSettings(false);
    setStatusMsg("✓ Commander Settings Synced Live!");
    await verifyTeamLeaderSession();
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
    setStatusMsg(`📢 Broadcasted directive across ${assetIds.length} Squad Assets!`);
  };

  const handleCreateSquadSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "create",
        payload: { email: newSmmEmail, password: newSmmPass, full_name: newSmmName, country: newSmmCountry }
      })
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`✓ Onboarded SMM ${newSmmName} into your squad!`);
      setNewSmmName(""); setNewSmmEmail(""); setNewSmmPass("");
      setShowCreateSmmModal(false);
      await loadSquadData(tlProfile.id);
    } else setStatusMsg("Error: " + data.error);
  };

  const handleUpdateSquadSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSmm) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "update",
        payload: { targetId: editingSmm.id, full_name: editingSmm.full_name, country: editingSmm.country, is_locked: editingSmm.is_locked }
      })
    });
    setStatusMsg("✓ Squad SMM updated!");
    setEditingSmm(null);
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveSmmFromSquad = async (smmId: string, smmName: string) => {
    if (!confirm(`Remove ${smmName} from your squad?`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "remove_from_squad", payload: { targetId: smmId, tlId: tlProfile.id } })
    });
    if (selectedSmm === smmId) setSelectedSmm(null);
    setStatusMsg(`Removed ${smmName} from squad.`);
    await loadSquadData(tlProfile.id);
  };

  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name} input ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
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
        payload: {
          smm_id: assignSmmId,
          team_leader_id: tlProfile.id,
          platform: assignPlatform,
          account_id: handoverType === "credentials_only" ? "Pending Setup (Email Handover)" : (assignAccountId || "Pending"),
          account_password: handoverType === "credentials_only" ? null : assignPass,
          email: handoverType === "account_only" ? null : assignEmail,
          email_password: handoverType === "account_only" ? null : assignEmailPass,
          profile_link: assignLink || null,
          country_language: assignCountry,
          project_name: assignProject,
          status: "active"
        }
      })
    });
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignPass(""); setAssignEmail(""); setAssignEmailPass(""); setAssignLink("");
    setStatusMsg("✓ Asset created & handed over live!");
    await loadSquadData(tlProfile.id);
  };

  const handleFullUpdateSquadAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: updatedAsset })
    });
    setStatusMsg("✓ Asset updated & synced live!");
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "delete", payload: { id: assetId } })
    });
    setStatusMsg("🗑 Asset deleted.");
    await loadSquadData(tlProfile.id);
  };

  const handleTlBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkRawText);
    if (rows.length === 0) return;

    if (bulkType === "assets") {
      const items = rows.map(r => ({
        smm_id: assignSmmId || (squadMembers[0]?.id ?? null),
        team_leader_id: tlProfile.id,
        account_id: r[0] || "Pending_Handle",
        account_password: r[1] || "",
        email: r[2] || "",
        email_password: r[3] || "",
        profile_link: r[4] || "",
        country_language: r[5] || assignCountry,
        platform: (r[6] || assignPlatform).toLowerCase(),
        project_name: r[7] || assignProject,
        status: "active"
      }));
      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "bulk_create", payload: { items } })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`⚡ Bulk assigned ${data.count} Assets to squad!`);
        setBulkRawText("");
        setActiveTab("assets");
        await loadSquadData(tlProfile.id);
      }
    } else {
      const empRows = rows.map(r => ({
        full_name: r[0] || "Squad SMM",
        email: r[1] || "",
        password: r[2] || "Welcome@2026!",
        country: r[3] || assignCountry
      })).filter(x => Boolean(x.email));
      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "bulk_create", payload: { rows: empRows } })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`⚡ Bulk onboarded ${data.createdCount} Squad SMMs!`);
        setBulkRawText("");
        setActiveTab("squad");
        await loadSquadData(tlProfile.id);
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse px-4 text-center">Connecting Team Leader Realtime Stream...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-6 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold">Tier 2 — @tl Squad Command</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
            <p className="text-xs text-zinc-500 mt-1">Sign in with your <b className="text-blue-400">name@tl</b> credentials</p>
          </div>
          <form onSubmit={handleTLLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl sm:rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500"></div>
            <input type="text" autoCapitalize="none" autoCorrect="off" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. josiah@tl or jeff@tl" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white font-mono" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
            {authMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3.5 rounded-xl text-sm">Authenticate @tl</button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400 py-2 inline-block">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSmmObj = squadMembers.find(m => m.id === selectedSmm);
  const filteredAssets = selectedSmm ? squadAssets.filter(a => a.smm_id === selectedSmm) : squadAssets;
  const q = searchQuery.toLowerCase().trim();
  const horizonRows = aggregateMetricsByHorizon(squadMetrics, csvHorizon);
  const squadAchievements = computeAchievements(squadAssets, squadMetrics);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Mobile-Optimized Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-4 gap-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  @tl Squad Command
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  LIVE
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">Commander {tlProfile.full_name}</h1>
              <p className="text-[11px] text-zinc-400">SMMs: <b className="text-blue-400">{squadMembers.length}</b> • Assets: <b className="text-purple-400">{squadAssets.length}</b> • {tlProfile.country}</p>
            </div>
            <div className="flex sm:hidden gap-1.5">
              <button onClick={() => setShowSettings(true)} className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-blue-300 text-xs font-bold active:scale-95">⚙</button>
              <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs active:scale-95">🚪</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 sm:flex-initial items-center bg-zinc-950 border border-blue-500/40 rounded-xl p-1 gap-1">
              <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="flex-1 sm:flex-initial bg-black text-blue-300 text-xs font-bold px-2.5 py-2 rounded-lg outline-none uppercase">
                <option value="weekly">📅 Weekly CSV</option>
                <option value="monthly">📆 Monthly CSV</option>
                <option value="quarterly">📊 Quarterly CSV</option>
                <option value="yearly">📈 Yearly CSV</option>
              </select>
              <button
                onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics: squadMetrics, assets: squadAssets, profiles: [tlProfile, ...squadMembers], scopeLabel: `Squad_${tlProfile.full_name}` })}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs whitespace-nowrap"
              >
                ⬇ CSV
              </button>
            </div>
            <button onClick={() => setShowCreateSmmModal(true)} className="px-3 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs active:scale-95">+ SMM</button>
            <button onClick={() => setShowGiveModal(true)} className="px-3 py-2.5 bg-emerald-500 text-black font-bold rounded-xl text-xs active:scale-95">+ Asset</button>
            <button onClick={() => setShowSettings(true)} className="hidden sm:inline-flex px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 text-blue-300 font-bold rounded-xl text-xs">⚙ Settings</button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="hidden sm:inline-flex px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400">Sign Out</button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* Search + Desktop Tabs */}
        <div className="flex flex-wrap justify-between items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="hidden md:flex flex-wrap gap-1.5">
            <button onClick={() => setActiveTab("squad")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "squad" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>👥 Squad SMMs ({squadMembers.length})</button>
            <button onClick={() => setActiveTab("graphs")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300 border border-cyan-500/30"}`}>📈 Summary Graphs</button>
            <button onClick={() => setActiveTab("achievements")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300 border border-yellow-500/30"}`}>🏆 Squad Achievements</button>
            <button onClick={() => setActiveTab("assets")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>🗂 Squad Assets ({squadAssets.length})</button>
            <button onClick={() => setActiveTab("bulk")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400 border border-amber-500/30"}`}>⚡ Bulk Entry</button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search squad SMMs or @Handles..."
            className="w-full md:w-64 rounded-xl bg-black border border-zinc-800 px-3.5 py-2.5 text-xs text-white outline-none"
          />
        </div>

        {/* TAB 1: SQUAD SMM CARDS */}
        {activeTab === "squad" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {squadMembers.filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.country || "").toLowerCase().includes(q)).map(smm => {
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmLogs = squadMetrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => setSelectedSmm(smm.id)}
                  className="group cursor-pointer rounded-2xl p-5 bg-zinc-950 border border-zinc-800 hover:border-blue-500 active:scale-[0.99] transition-all"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Assets</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border active:scale-95 ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                    >
                      {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-xs">
                    <div className="space-x-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditingSmm({ ...smm })} className="text-emerald-400 font-bold py-1">✎ Edit</button>
                      <button onClick={() => handleRemoveSmmFromSquad(smm.id, smm.full_name)} className="text-red-400 font-bold py-1">✕ Remove</button>
                    </div>
                    <span className="text-blue-400 font-bold">Open Assets →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: SQUAD SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase text-cyan-400">SMM Handler Comparative Output</h3>
              {squadMembers.map(smm => {
                const sAssets = squadAssets.filter(a => a.smm_id === smm.id);
                const sImpr = squadMetrics.filter(m => sAssets.some(a => a.id === m.asset_id)).reduce((s, x) => s + Number(x.impressions || 0), 0);
                const maxS = Math.max(1000, ...squadMembers.map(m => squadMetrics.filter(log => squadAssets.filter(a => a.smm_id === m.id).some(a => a.id === log.asset_id)).reduce((s, x) => s + Number(x.impressions || 0), 0)));
                const w = Math.min(100, Math.max(5, Math.round((sImpr / maxS) * 100)));
                return (
                  <div key={smm.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-white font-bold truncate">{smm.full_name} ({sAssets.length} Assets)</span>
                      <span className="text-cyan-300 shrink-0">{sImpr.toLocaleString()} Impr</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${w}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SQUAD ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadAchievements.map(ach => (
              <div key={ach.id} className={`rounded-2xl p-5 border ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60" : "bg-zinc-950 border-zinc-800 opacity-75"}`}>
                <div className="flex justify-between items-center">
                  <span className="text-3xl">{ach.icon}</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-500"}`}>
                    {ach.unlocked ? "✓ UNLOCKED" : `${ach.progress}%`}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">{ach.desc}</p>
                <div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ALL SQUAD ASSETS CRUD */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {squadAssets.filter(a => !q || (a.account_id || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)).map(asset => (
              <AssetDirectiveCard
                key={asset.id}
                asset={asset}
                squadMembers={squadMembers}
                onFullSave={handleFullUpdateSquadAsset}
                onRemove={handleRemoveAsset}
              />
            ))}
          </div>
        )}

        {/* TAB 5: BULK DATA ENTRY */}
        {activeTab === "bulk" && (
          <form onSubmit={handleTlBulkImport} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">⚡ Squad Bulk Data Importer</h3>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setBulkType("assets")} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${bulkType === "assets" ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>Bulk Assets</button>
                <button type="button" onClick={() => setBulkType("smms")} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${bulkType === "smms" ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>Bulk SMMs</button>
              </div>
            </div>
            <textarea rows={7} required value={bulkRawText} onChange={(e) => setBulkRawText(e.target.value)} placeholder="Paste rows from Excel/Google Sheets or CSV..." className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-xs font-mono text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3.5 bg-amber-500 text-black font-bold rounded-xl text-xs">
              ⚡ Execute Squad Bulk Import ({parseBulkRows(bulkRawText).length} Rows)
            </button>
          </form>
        )}

      </div>

      {/* MOBILE STICKY BOTTOM DOCK FOR TEAM LEADERS */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-2 py-1.5 flex justify-around items-center">
        {[
          { id: "squad", icon: "👥", label: `Squad (${squadMembers.length})` },
          { id: "assets", icon: "🗂", label: `Assets (${squadAssets.length})` },
          { id: "graphs", icon: "📈", label: "Graphs" },
          { id: "achievements", icon: "🏆", label: "Badges" },
          { id: "bulk", icon: "⚡", label: "Bulk" }
        ].map((t: any) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === t.id ? "text-blue-400 font-bold" : "text-zinc-500"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="text-[10px] mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* SLIDE-OVER SQUAD & COMMANDER SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-5 sm:p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Squad & Commander Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300">✕ Close</button>
            </div>
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-2">
              <div className="text-xs font-bold uppercase text-blue-400">Batch Squad Metric Lock</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleBatchSquadLock(true)} className="min-h-[42px] py-2 bg-red-500/20 border border-red-500/40 text-red-400 font-bold rounded-xl text-xs">🔒 Lock All</button>
                <button type="button" onClick={() => handleBatchSquadLock(false)} className="min-h-[42px] py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold rounded-xl text-xs">🔓 Unlock All</button>
              </div>
            </div>
            <div className="p-4 bg-black border border-blue-500/30 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-blue-400">📢 Broadcast Directive to Squad ({squadAssets.length})</h3>
              <input type="text" value={broadcastCampaign} onChange={(e) => setBroadcastCampaign(e.target.value)} placeholder="Global Squad Campaign Name" className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" value={broadcastTask} onChange={(e) => setBroadcastTask(e.target.value)} placeholder="Global Weekly Squad Task" className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white" />
              <button type="button" onClick={handleBroadcastDirective} className="w-full min-h-[44px] py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs">Push Directive Live</button>
            </div>
            <form onSubmit={handleSaveTLSettings} className="space-y-4 border-t border-zinc-800 pt-4">
              <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} placeholder="Commander Display Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Update Password (Optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Commander Settings</button>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: ONBOARD NEW SQUAD SMM */}
      {showCreateSmmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowCreateSmmModal(false)}>
          <form onSubmit={handleCreateSquadSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border-t sm:border border-blue-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3 shadow-2xl">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Onboard New Squad SMM (@smm)</h3>
            <input type="text" required value={newSmmName} onChange={(e) => setNewSmmName(e.target.value)} placeholder="Handler Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" autoCapitalize="none" required value={newSmmEmail} onChange={(e) => setNewSmmEmail(e.target.value)} placeholder="username@smm (e.g. abebe@smm)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="text" required value={newSmmPass} onChange={(e) => setNewSmmPass(e.target.value)} placeholder="Initial Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <select value={newSmmCountry} onChange={(e) => setNewSmmCountry(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
              {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="w-full min-h-[48px] py-3 bg-blue-600 text-white font-bold rounded-xl text-xs">Create & Assign SMM</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: EDIT SQUAD SMM */}
      {editingSmm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setEditingSmm(null)}>
          <form onSubmit={handleUpdateSquadSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Edit Squad SMM</h3>
            <input type="text" required value={editingSmm.full_name || ""} onChange={(e) => setEditingSmm({ ...editingSmm, full_name: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={editingSmm.country || ""} onChange={(e) => setEditingSmm({ ...editingSmm, country: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Changes</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: CREATE / HAND OVER ASSET */}
      {showGiveModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowGiveModal(false)}>
          <form onSubmit={handleGiveAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-emerald-400">Create / Hand Over Asset to Squad Manager</h3>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black rounded-xl border border-zinc-800">
              <button type="button" onClick={() => setHandoverType("account_only")} className={`py-2 text-[11px] font-bold rounded-lg ${handoverType === "account_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>1. User & Pass</button>
              <button type="button" onClick={() => setHandoverType("credentials_only")} className={`py-2 text-[11px] font-bold rounded-lg ${handoverType === "credentials_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>2. Email Only</button>
              <button type="button" onClick={() => setHandoverType("full")} className={`py-2 text-[11px] font-bold rounded-lg ${handoverType === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>3. Full Vault</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={assignCountry} onChange={(e) => setAssignCountry(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {(handoverType === "account_only" || handoverType === "full") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset ID / @Handle" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
            )}
            {(handoverType === "credentials_only" || handoverType === "full") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="email" required value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="Handover Email" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                <input type="text" required value={assignEmailPass} onChange={(e) => setAssignEmailPass(e.target.value)} placeholder="Email Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
            )}
            <input type="url" value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Asset Profile Link (Optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Confirm Asset Handover</button>
          </form>
        </div>
      )}

      {/* FULL-SCREEN MOBILE / SLIDE-OVER DESKTOP PANEL FOR SELECTED SMM */}
      {activeSmmObj && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setSelectedSmm(null)}>
          <div className="w-full max-w-3xl bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-4 sm:p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md flex justify-between items-center border-b border-zinc-800 pb-3 pt-1">
              <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{activeSmmObj.full_name}&apos;s Assets ({filteredAssets.length})</h2>
              <button onClick={() => setSelectedSmm(null)} className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 shrink-0">✕ Close</button>
            </div>
            <div className="space-y-4 pb-10">
              {filteredAssets.map(asset => (
                <AssetDirectiveCard
                  key={asset.id}
                  asset={asset}
                  squadMembers={squadMembers}
                  onFullSave={handleFullUpdateSquadAsset}
                  onRemove={handleRemoveAsset}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function AssetDirectiveCard({ asset, squadMembers, onFullSave, onRemove }: any) {
  const [formState, setFormState] = useState({ ...asset });
  const [showVaultEdit, setShowVaultEdit] = useState(false);

  useEffect(() => { setFormState({ ...asset }); }, [asset]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-emerald-400">({asset.country_language || "Ethiopia"})</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowVaultEdit(!showVaultEdit)} className="text-[11px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">
            {showVaultEdit ? "Hide Vault" : "✎ Vault / Reassign"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="px-2.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-red-400 font-bold">🗑</button>
        </div>
      </div>

      {showVaultEdit && (
        <div className="p-3 bg-black border border-emerald-500/30 rounded-xl space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={formState.smm_id || ""} onChange={(e) => setFormState({ ...formState, smm_id: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white">
              {squadMembers.map((m: any) => <option key={m.id} value={m.id}>SMM: {m.full_name}</option>)}
            </select>
            <select value={formState.country_language || "Ethiopia"} onChange={(e) => setFormState({ ...formState, country_language: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white">
              {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white uppercase">
              <option value="active">ACTIVE</option>
              <option value="suspended">SUSPENDED</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Asset ID" value={formState.account_id || ""} onChange={(e) => setFormState({ ...formState, account_id: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white" />
            <input type="text" placeholder="Asset Password" value={formState.account_password || ""} onChange={(e) => setFormState({ ...formState, account_password: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white" />
            <input type="email" placeholder="Asset Email" value={formState.email || ""} onChange={(e) => setFormState({ ...formState, email: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white" />
            <input type="text" placeholder="Email Password" value={formState.email_password || ""} onChange={(e) => setFormState({ ...formState, email_password: e.target.value })} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-white" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="text" value={formState.tl_campaign || ""} onChange={(e) => setFormState({ ...formState, tl_campaign: e.target.value })} placeholder="Campaign" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
        <input type="text" value={formState.tl_task || ""} onChange={(e) => setFormState({ ...formState, tl_task: e.target.value })} placeholder="Weekly Task" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
        <input type="text" value={formState.tl_comment || ""} onChange={(e) => setFormState({ ...formState, tl_comment: e.target.value })} placeholder="TL Comment" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
      </div>
      <button onClick={() => onFullSave(formState)} className="w-full min-h-[42px] py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs">
        Save Asset & Directives Live
      </button>
    </div>
  );
}
