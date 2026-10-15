"use client";

import { useState, useEffect, useCallback } from "react";
import { adminSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  normalizeAuthUsername,
  fetchAllRows,
  exportHorizonCSV,
  computeAchievements,
} from "@/lib/constants";
import {
  AssetGrowthModal,
  UniversalAssetEditModal,
  TeamLeaderSpotlightModal,
  SMMSpotlightModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  CampaignDispatchWizard,
  ExecutiveAnalyticsGraphs,
  ForensicArchiveVault,
} from "@/components/EnterpriseUI";

export default function AdminCommandCenter() {
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  // Separate "tls" (Team Leaders) and "smms" (SMMs) tabs + "archives"
  const [activeTab, setActiveTab] = useState<
    "tls" | "smms" | "campaign" | "assets" | "graphs" | "archives" | "achievements"
  >("tls");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  // 3-Stage Blurred Spotlight Pop-Up Windows!
  const [spotlightTl, setSpotlightTl] = useState<any>(null);
  const [spotlightSmm, setSpotlightSmm] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  // Employee Editor Modal
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [empCountries, setEmpCountries] = useState<string[]>([]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>([]);
  const [empTlIds, setEmpTlIds] = useState<string[]>([]);
  const [empAssignedSmmIds, setEmpAssignedSmmIds] = useState<string[]>([]);
  const [empAssignedAssetIds, setEmpAssignedAssetIds] = useState<string[]>([]);
  const [empNewPass, setEmpNewPass] = useState("");

  // Admin Settings & Provision Modals
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [adminCountries, setAdminCountries] = useState<string[]>([]);
  const [adminNewPass, setAdminNewPass] = useState("");

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "team_leader" | "smm">("smm");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newCountries, setNewCountries] = useState<string[]>(["Kenya"]);
  const [newPlatforms, setNewPlatforms] = useState<string[]>(["twitter"]);
  const [newTlIds, setNewTlIds] = useState<string[]>([]);

  const loadAllEnterpriseData = useCallback(async () => {
    const [pList, aList, mList, auditRes] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
      fetch("/api/crud", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ logs: [] })),
    ]);
    setProfiles(pList);
    setAssets(aList);
    setMetrics(mList);
    setAuditLogs(auditRes.logs || []);
  }, []);

  useEffect(() => {
    let channel: any;
    verifyAdminSession().then((ok) => {
      if (!ok) return;
      channel = supabase
        .channel("admin-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          loadAllEnterpriseData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          loadAllEnterpriseData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          loadAllEnterpriseData();
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [loadAllEnterpriseData]);

  const verifyAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return false; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      setIsCheckingAuth(false);
      return false;
    }
    setAdminProfile(prof);
    setAdminDisplayName(prof.full_name || "Master Admin");
    setAdminCountries((prof.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadAllEnterpriseData();
    return true;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Verifying Master Clearance...");
    await fetch("/api/seed", { method: "POST" });
    const raw = email.trim();
    const norm = raw.includes("@") ? raw : normalizeAuthUsername(raw, "admin");
    const { data, error } = await supabase.auth.signInWithPassword({ email: norm, password });
    if (error) return setAuthMsg(error.message);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      return setAuthMsg("Access Denied: Admin clearance required.");
    }
    setAdminProfile(prof);
    await loadAllEnterpriseData();
  };

  const handleToggleSmmLock = async (smm: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "update", payload: { targetId: smm.id, is_locked: !smm.is_locked } }),
    });
    setStatusMsg(`${smm.full_name} is now ${!smm.is_locked ? "LOCKED 🔒" : "OPEN 🔓"}`);
    await loadAllEnterpriseData();
  };

  const handleGlobalBatchLock = async (lockState: boolean) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "batch_lock", payload: { is_locked: lockState } }),
    });
    setStatusMsg(lockState ? "🔒 All SMMs Globally Locked!" : "🔓 All SMMs Globally Unlocked!");
    await loadAllEnterpriseData();
  };

  const handleSaveAdminOwnSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "update",
        payload: { targetId: adminProfile.id, full_name: adminDisplayName, country: adminCountries.join(", "), newPassword: adminNewPass },
      }),
    });
    setAdminNewPass("");
    setShowAdminSettings(false);
    setStatusMsg("✓ Master Admin Settings Updated Live!");
    await loadAllEnterpriseData();
  };

  const openEditEmployee = (emp: any) => {
    setEditingEmployee({ ...emp });
    setEmpCountries((emp.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setEmpPlatforms(emp.platforms?.length > 0 ? emp.platforms : ["twitter"]);
    setEmpTlIds(emp.team_leader_ids?.length > 0 ? emp.team_leader_ids : emp.team_leader_id ? [emp.team_leader_id] : []);
    const smmsUnderTl = profiles
      .filter((p) => p.role === "smm" && (p.team_leader_id === emp.id || (p.team_leader_ids && p.team_leader_ids.includes(emp.id))))
      .map((s) => s.id);
    setEmpAssignedSmmIds(smmsUnderTl);
    const assetsUnderSmm = assets.filter((a) => a.smm_id === emp.id).map((a) => a.id);
    setEmpAssignedAssetIds(assetsUnderSmm);
    setEmpNewPass("");
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "update",
        payload: {
          targetId: editingEmployee.id,
          full_name: editingEmployee.full_name,
          role: editingEmployee.role,
          country: empCountries.join(", "),
          platforms: empPlatforms,
          team_leader_ids: editingEmployee.role === "smm" ? empTlIds : [],
          assignedSmmIds: editingEmployee.role === "team_leader" ? empAssignedSmmIds : undefined,
          assignedAssetIds: editingEmployee.role === "smm" ? empAssignedAssetIds : undefined,
          is_locked: editingEmployee.is_locked,
          newPassword: empNewPass,
        },
      }),
    });
    setEditingEmployee(null);
    setStatusMsg("✓ Personnel Profile & Assignments Updated Live!");
    await loadAllEnterpriseData();
  };

  const handleDeleteEmployee = async (emp: any) => {
    if (!confirm(`Delete ${emp.full_name} permanently?`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "delete", payload: { targetId: emp.id } }),
    });
    setEditingEmployee(null);
    setStatusMsg(`🗑 Deleted ${emp.full_name}.`);
    await loadAllEnterpriseData();
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "create",
        payload: { role: newRole, full_name: newName, email: newEmail, password: newPass, country: newCountries.join(", "), platforms: newPlatforms, team_leader_ids: newRole === "smm" ? newTlIds : [] },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowProvisionModal(false);
      setNewName(""); setNewEmail(""); setNewPass("");
      setStatusMsg(`✓ Provisioned ${newRole.toUpperCase()} ${newName}!`);
      await loadAllEnterpriseData();
    } else alert(data.error);
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "update", payload: { id: asset.id, status: newStatus } }),
    });
    setStatusMsg(`Asset [${asset.account_id}] marked ${newStatus.toUpperCase()} & logged in Archives!`);
    await loadAllEnterpriseData();
  };

  const handleSaveAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "update", payload: updatedAsset }),
    });
    setEditingAsset(null);
    setStatusMsg("✓ All 15 Asset Fields Updated Live!");
    await loadAllEnterpriseData();
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset permanently?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "delete", payload: { id: assetId } }),
    });
    setEditingAsset(null);
    setStatusMsg("🗑 Asset deleted.");
    await loadAllEnterpriseData();
  };

  const handleRestoreArchive = async (log: any) => {
    const snap = log.record_snapshot?.before || log.record_snapshot;
    if (!snap) return alert("No snapshot payload available.");
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "audit", action: "restore", payload: { snapshot: snap, entityType: log.entity_type } }),
    });
    setStatusMsg("♻ Restored record from Archives!");
    await loadAllEnterpriseData();
  };

  if (isCheckingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse">Verifying Executive Vault Clearance...</div>;
  }

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">Tier 1 — Executive Vault</span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Command Center</h1>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-2xl">
            <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@executive.com" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Master Passcode" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none" />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm">Unlock Executive Vault</button>
          </form>
          <div className="mt-6 text-center"><Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Handler Portal</Link></div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter((p) => p.role === "team_leader");
  const allSmms = profiles.filter((p) => p.role === "smm");
  const uniqueProjects = Array.from(new Set(assets.map((a) => a.project_name || "General Campaign")));
  const filteredAssets = projectFilter === "All" ? assets : assets.filter((a) => (a.project_name || "General Campaign") === projectFilter);
  const q = searchQuery.toLowerCase().trim();
  const globalAchievements = computeAchievements(filteredAssets, metrics);

  // Keep spotlight objects fresh when data updates live
  const activeSpotlightTl = spotlightTl ? profiles.find((p) => p.id === spotlightTl.id) || spotlightTl : null;
  const activeSpotlightSmm = spotlightSmm ? profiles.find((p) => p.id === spotlightSmm.id) || spotlightSmm : null;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Executive Bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">Tier 1 — Executive God Mode</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${liveSyncPulse ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>LIVE</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">Global Admin Command Center</h1>
            <p className="text-xs text-zinc-400">
              Admin: <b className="text-white">{adminProfile.full_name}</b> • Team Leaders: {teamLeaders.length} • SMMs: {allSmms.length} • Assets: {filteredAssets.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveTab("campaign")} className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all">
              🎯 Give Campaign
            </button>
            <button onClick={() => setShowProvisionModal(true)} className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all">
              + Provision User
            </button>
            <button onClick={() => setShowAdminSettings(true)} className="px-3.5 py-2.5 bg-zinc-900 border border-emerald-500/40 text-emerald-300 hover:bg-zinc-800 font-bold rounded-xl text-xs transition-all">
              ⚙ Admin Settings
            </button>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white">
              <option value="All">All Campaigns</option>
              {uniqueProjects.map((proj) => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-bold px-2.5 py-2 rounded-xl uppercase">
              <option value="weekly">Weekly CSV</option><option value="monthly">Monthly CSV</option><option value="quarterly">Quarterly CSV</option><option value="yearly">Yearly CSV</option>
            </select>
            <button onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics, assets: filteredAssets, profiles, projectFilter, scopeLabel: "Master_Enterprise" })} className="px-3.5 py-2 bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs">
              ⬇ CSV
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* Desktop Navigation Tabs — Separated Team Leaders & SMMs + Renamed Archives */}
        <div className="hidden md:flex flex-wrap justify-between items-center gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("tls")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "tls" ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🛡 Team Leaders ({teamLeaders.length})
            </button>
            <button onClick={() => setActiveTab("smms")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "smms" ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              👤 SMMs ({allSmms.length})
            </button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🗂 Assets ({filteredAssets.length})
            </button>
            <button onClick={() => setActiveTab("campaign")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "campaign" ? "bg-purple-600 text-white" : "bg-zinc-900 text-purple-300 border border-purple-500/30"}`}>
              🎯 Give Campaign
            </button>
            <button onClick={() => setActiveTab("graphs")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300"}`}>
              📈 Summary Graphs
            </button>
            <button onClick={() => setActiveTab("archives")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "archives" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-300"}`}>
              🗄 Archives ({auditLogs.length})
            </button>
            <button onClick={() => setActiveTab("achievements")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300"}`}>
              🏆 Achievements
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search TLs, SMMs, Assets..."
            className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
          />
        </div>

        {/* TAB 1: TEAM LEADERS (CLICK ANY CARD TO BLUR BACKGROUND & POP OUT TL SPOTLIGHT WINDOW!) */}
        {activeTab === "tls" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <p className="text-xs text-zinc-400">
                Click any <b className="text-emerald-400">Team Leader</b> card to blur the dashboard and launch their full-screen Spotlight Command Window.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {teamLeaders
                .filter((tl) => !q || (tl.full_name || "").toLowerCase().includes(q) || (tl.country || "").toLowerCase().includes(q))
                .map((tl) => {
                  const tlSmms = allSmms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
                  const tlAssets = filteredAssets.filter((a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id));
                  const tlLogs = metrics.filter((m) => tlAssets.some((a) => a.id === m.asset_id));
                  const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);
                  const eng = tlLogs.reduce((sum, x) => sum + (x.engagements || 0), 0);

                  return (
                    <div
                      key={tl.id}
                      onClick={() => setSpotlightTl(tl)}
                      className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-black border border-zinc-800 hover:border-emerald-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.45)] space-y-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                            🛡 Team Leader
                          </span>
                          <h3 className="font-bold text-xl text-white mt-2 group-hover:text-emerald-300 transition-colors">
                            Commander {tl.full_name}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">🌍 {tl.country}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditEmployee(tl);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-zinc-700 text-xs font-bold transition-all"
                        >
                          ✎ Edit
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-black/80 border border-zinc-900 group-hover:border-emerald-500/30 font-mono text-xs transition-all">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">SMM SQUAD</span>
                          <span className="text-emerald-400 font-bold text-base">{tlSmms.length}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">ASSETS</span>
                          <span className="text-purple-400 font-bold text-base">{tlAssets.length}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">IMPR</span>
                          <span className="text-blue-400 font-bold text-base">{impr.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400 group-hover:text-emerald-300 pt-1">
                        <span>✨ Tap to Pop Out Squad Window</span>
                        <span className="font-bold transform group-hover:translate-x-1 transition-transform">↗</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: SEPARATE SMMs TAB (CLICK ANY SMM CARD TO BLUR BACKGROUND & POP OUT SMM SPOTLIGHT WINDOW!) */}
        {activeTab === "smms" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <p className="text-xs text-zinc-400">
                Click any <b className="text-blue-400">SMM Handler</b> card to blur the background and pop open their Spotlight Asset Vault Window.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleGlobalBatchLock(true)} className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500 hover:text-black border border-red-500/30 text-red-400 text-xs font-bold transition-all">
                  🔒 Lock All SMMs
                </button>
                <button type="button" onClick={() => handleGlobalBatchLock(false)} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all">
                  🔓 Unlock All SMMs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {allSmms
                .filter((s) => !q || (s.full_name || "").toLowerCase().includes(q) || (s.country || "").toLowerCase().includes(q))
                .map((smm) => {
                  const smmAssets = filteredAssets.filter((a) => a.smm_id === smm.id);
                  const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
                  const totalImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
                  const totalEng = smmLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
                  const tl = teamLeaders.find((t) => t.id === smm.team_leader_id);

                  return (
                    <div
                      key={smm.id}
                      onClick={() => setSpotlightSmm(smm)}
                      className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-black border border-zinc-800 hover:border-blue-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.45)] space-y-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold">
                              👤 SMM Handler
                            </span>
                            {tl && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-emerald-300 font-bold">
                                TL: {tl.full_name}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mt-2 group-hover:text-blue-300 transition-colors">
                            {smm.full_name}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">🌍 {smm.country}</p>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleSmmLock(smm)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                            }`}
                          >
                            {smm.is_locked ? "🔒" : "🔓"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditEmployee(smm)}
                            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-blue-500 text-blue-300 hover:text-black border border-zinc-700 text-xs font-bold transition-all"
                          >
                            ✎ Edit
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-black/80 border border-zinc-900 group-hover:border-blue-500/30 font-mono text-xs transition-all">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">ASSETS</span>
                          <span className="text-white font-bold text-base">{smmAssets.length}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">IMPR</span>
                          <span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">ENG</span>
                          <span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-zinc-400 group-hover:text-blue-300 pt-1">
                        <span>SM: {(smm.platforms || ["twitter"]).join(", ").toUpperCase()}</span>
                        <span className="font-bold">Pop Out Vault ↗</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 3: ASSETS */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {filteredAssets
              .filter((a) => !q || (a.account_id || "").toLowerCase().includes(q) || (a.platform || "").toLowerCase().includes(q))
              .map((asset) => {
                const isSuspended = asset.status === "suspended";
                const smm = profiles.find((p) => p.id === asset.smm_id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => setInspectingAsset(asset)}
                    className={`group cursor-pointer bg-zinc-950 border rounded-3xl p-5 space-y-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_-12px_rgba(168,85,247,0.4)] ${
                      isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800 hover:border-purple-400"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetAssetStatus(asset, isSuspended ? "active" : "suspended");
                      }}
                      className={`absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                        isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {isSuspended ? "⚠ SUSP" : "● ACTV"} ⇄
                    </button>
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                    <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-20 group-hover:text-purple-300">{asset.account_id}</h3>
                    <p className="text-xs text-zinc-400">🌍 {asset.country_language} • 🗣 {asset.language || "English"} • 👤 {smm?.full_name || "Unassigned"}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold rounded-xl text-xs transition-all">
                        🔍 Pop Out Asset
                      </button>
                      <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold rounded-xl text-xs transition-all">
                        ✎ Edit All 15
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 4: GIVE CAMPAIGN */}
        {activeTab === "campaign" && (
          <CampaignDispatchWizard
            actorId={adminProfile.id}
            teamLeaders={teamLeaders}
            smms={allSmms}
            assets={assets}
            onSuccess={(msg) => {
              setStatusMsg(msg);
              loadAllEnterpriseData();
              setActiveTab("assets");
            }}
          />
        )}

        {/* TAB 5: SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <ExecutiveAnalyticsGraphs
            assets={filteredAssets}
            metrics={metrics}
            profiles={profiles}
            onSelectAsset={(a) => setInspectingAsset(a)}
            titlePrefix="Global Enterprise"
          />
        )}

        {/* TAB 6: ARCHIVES */}
        {activeTab === "archives" && (
          <ForensicArchiveVault logs={auditLogs} onRestore={handleRestoreArchive} />
        )}

        {/* TAB 7: ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {globalAchievements.map((ach) => (
              <div key={ach.id} className={`rounded-2xl p-5 border ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60" : "bg-zinc-950 border-zinc-800 opacity-75"}`}>
                <div className="flex justify-between items-center"><span className="text-3xl">{ach.icon}</span><span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-500"}`}>{ach.unlocked ? "✓ UNLOCKED" : `${ach.progress}%`}</span></div>
                <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MOBILE STICKY BOTTOM DOCK */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-1.5 py-1.5 flex justify-around items-center">
        {[
          { id: "tls", icon: "🛡", label: "TLs" },
          { id: "smms", icon: "👤", label: "SMMs" },
          { id: "assets", icon: "🗂", label: "Assets" },
          { id: "campaign", icon: "🎯", label: "Campaign" },
          { id: "graphs", icon: "📈", label: "Graphs" },
          { id: "archives", icon: "🗄", label: "Archives" },
        ].map((t: any) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center py-1 px-2 rounded-xl ${activeTab === t.id ? "text-emerald-400 font-bold bg-emerald-500/10" : "text-zinc-500"}`}>
            <span className="text-base">{t.icon}</span><span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>

      {/* STAGE 1 POP-UP WINDOW: TEAM LEADER SPOTLIGHT (BLURS BACKGROUND & BRINGS TL FORWARD) */}
      {activeSpotlightTl && (
        <TeamLeaderSpotlightModal
          tl={activeSpotlightTl}
          smms={allSmms}
          assets={filteredAssets}
          metrics={metrics}
          onClose={() => setSpotlightTl(null)}
          onSelectSmm={(smm) => setSpotlightSmm(smm)}
          onEditTl={(tl) => openEditEmployee(tl)}
          onEditSmm={(smm) => openEditEmployee(smm)}
          onToggleSmmLock={handleToggleSmmLock}
        />
      )}

      {/* STAGE 2 POP-UP WINDOW: SMM HANDLER SPOTLIGHT (BLURS BACKGROUND & BRINGS SMM + ASSETS FORWARD) */}
      {activeSpotlightSmm && (
        <SMMSpotlightModal
          smm={activeSpotlightSmm}
          tlName={teamLeaders.find((t) => t.id === activeSpotlightSmm.team_leader_id)?.full_name}
          assets={filteredAssets}
          metrics={metrics}
          onClose={() => setSpotlightSmm(null)}
          onSelectAsset={(a) => setInspectingAsset(a)}
          onEditAsset={(a) => setEditingAsset(a)}
          onToggleAssetStatus={handleSetAssetStatus}
          onEditSmm={(smm) => openEditEmployee(smm)}
          onToggleSmmLock={handleToggleSmmLock}
        />
      )}

      {/* STAGE 3 POP-UP WINDOW: ASSET SPOTLIGHT */}
      {inspectingAsset && (
        <AssetGrowthModal
          asset={inspectingAsset}
          metrics={metrics}
          profiles={profiles}
          onClose={() => setInspectingAsset(null)}
          onEdit={(a) => setEditingAsset(a)}
          onToggleStatus={handleSetAssetStatus}
        />
      )}

      {/* UNIVERSAL 15-FIELD ASSET EDITOR */}
      {editingAsset && (
        <UniversalAssetEditModal
          asset={editingAsset}
          teamLeaders={teamLeaders}
          smms={allSmms}
          canReassignSmm={true}
          onClose={() => setEditingAsset(null)}
          onSave={handleSaveAsset}
          onDelete={handleDeleteAsset}
        />
      )}

      {/* ADMIN SETTINGS DRAWER */}
      {showAdminSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowAdminSettings(false)}>
          <form onSubmit={handleSaveAdminOwnSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">⚙ Master Admin Settings & Locks</h2>
              <button type="button" onClick={() => setShowAdminSettings(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-300 rounded-xl">✕</button>
            </div>
            <div className="p-4 bg-black border border-zinc-800 rounded-2xl space-y-3">
              <div className="text-xs font-bold uppercase text-amber-400">🔒 Global SMM Submission Lock Controls</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleGlobalBatchLock(true)} className="py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs">🔒 Lock All SMMs</button>
                <button type="button" onClick={() => handleGlobalBatchLock(false)} className="py-3 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl text-xs">🔓 Unlock All SMMs</button>
              </div>
            </div>
            <input type="text" required value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} placeholder="Admin Display Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Admin Regions" options={ALL_COUNTRIES} selected={adminCountries} onChange={setAdminCountries} />
            <input type="password" value={adminNewPass} onChange={(e) => setAdminNewPass(e.target.value)} placeholder="New Master Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Master Admin Settings Live</button>
            <button type="button" onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="w-full py-3 bg-zinc-900 text-red-400 font-bold rounded-xl text-xs">Sign Out of Executive Vault</button>
          </form>
        </div>
      )}

      {/* ADMIN EDIT TL OR SMM MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-3 sm:p-4" onClick={() => setEditingEmployee(null)}>
          <form onSubmit={handleSaveEmployee} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-zinc-950 border border-emerald-500/50 rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">✎ Edit {editingEmployee.full_name} ({editingEmployee.role.toUpperCase()})</h3>
              <button type="button" onClick={() => setEditingEmployee(null)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" required value={editingEmployee.full_name || ""} onChange={(e) => setEditingEmployee({ ...editingEmployee, full_name: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <select value={editingEmployee.role} onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-bold">
                <option value="smm">SMM HANDLER</option><option value="team_leader">TEAM LEADER</option><option value="admin">ADMIN</option>
              </select>
              <input type="password" value={empNewPass} onChange={(e) => setEmpNewPass(e.target.value)} placeholder="Reset Password (optional)" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>
            <FancyMultiSelect label="Social Media Platforms" options={PLATFORMS} selected={empPlatforms} onChange={setEmpPlatforms} />
            <FancyMultiSelect label="Assigned Countries" options={ALL_COUNTRIES} selected={empCountries} onChange={setEmpCountries} />
            {editingEmployee.role === "team_leader" && (
              <FancyEntityMultiSelect
                label="SMM Handlers Under This Team Leader"
                items={allSmms.map((s) => ({ id: s.id, label: s.full_name, sub: `${s.country} • ${(s.platforms || ["twitter"]).join(", ")}` }))}
                selectedIds={empAssignedSmmIds}
                onChange={setEmpAssignedSmmIds}
              />
            )}
            {editingEmployee.role === "smm" && (
              <>
                <FancyEntityMultiSelect label="Assigned Team Leader(s)" items={teamLeaders.map((tl) => ({ id: tl.id, label: `Commander ${tl.full_name}`, sub: tl.country }))} selectedIds={empTlIds} onChange={setEmpTlIds} />
                <FancyEntityMultiSelect label="Social Media Assets Assigned" items={assets.map((a) => ({ id: a.id, label: `[${(a.platform || "").toUpperCase()}] ${a.account_id}`, sub: a.country_language }))} selectedIds={empAssignedAssetIds} onChange={setEmpAssignedAssetIds} />
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Changes Live</button>
              {editingEmployee.id !== adminProfile.id && <button type="button" onClick={() => handleDeleteEmployee(editingEmployee)} className="px-4 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs">🗑 Delete</button>}
            </div>
          </form>
        </div>
      )}

      {/* PROVISION NEW USER MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4" onClick={() => setShowProvisionModal(false)}>
          <form onSubmit={handleProvisionUser} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">+ Provision New Enterprise Account</h3>
              <button type="button" onClick={() => setShowProvisionModal(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">✕</button>
            </div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-emerald-400 font-bold">
              <option value="smm">Role: SMM Handler (@smm)</option><option value="team_leader">Role: Team Leader (@tl)</option><option value="admin">Role: Master Admin (@admin)</option>
            </select>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Username (e.g. name@smm or name@tl)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={newPlatforms} onChange={setNewPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={newCountries} onChange={setNewCountries} />
            {newRole === "smm" && <FancyEntityMultiSelect label="Assign Team Leader(s)" items={teamLeaders.map((tl) => ({ id: tl.id, label: tl.full_name, sub: tl.country }))} selectedIds={newTlIds} onChange={setNewTlIds} />}
            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Provision Account Live</button>
          </form>
        </div>
      )}
    </div>
  );
}
