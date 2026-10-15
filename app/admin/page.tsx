"use client";

import { useState, useEffect, useCallback } from "react";
import { adminSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  SheetTabOption,
  normalizeAuthUsername,
  fetchAllRows,
  exportHorizonCSV,
  computeAchievements,
} from "@/lib/constants";
import {
  usePortalTheme,
  ThemePickerDropdown,
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

export default function AdminControlCenter() {
  const { themeId, changeTheme, currentTheme } = usePortalTheme();
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
  const [customMilestones, setCustomMilestones] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [activeTab, setActiveTab] = useState<
    "tls" | "smms" | "assets" | "campaign" | "graphs" | "archives" | "achievements"
  >("tls");

  // Clean Executive Export & Action Popover
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");
  const [csvSheetTab, setCsvSheetTab] = useState<SheetTabOption>("all");

  // SMMs & Assets Dedicated Platform (SM) & Country Filters
  const [smmPlatformFilter, setSmmPlatformFilter] = useState<string>("all");
  const [smmCountryFilter, setSmmCountryFilter] = useState<string>("all");
  const [assetPlatformFilter, setAssetPlatformFilter] = useState<string>("all");
  const [assetCountryFilter, setAssetCountryFilter] = useState<string>("all");

  // Blurred Spotlight Pop-Up Windows
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

  // Custom Admin Milestone Form
  const [msTitle, setMsTitle] = useState("");
  const [msMetric, setMsMetric] = useState("engagements");
  const [msTarget, setMsTarget] = useState("10000");
  const [msIcon, setMsIcon] = useState("👑");

  const loadAllEnterpriseData = useCallback(async () => {
    const [pList, aList, mList, auditRes] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
      fetch("/api/crud", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ logs: [], milestones: [] })),
    ]);
    setProfiles(pList);
    setAssets(aList);
    setMetrics(mList);
    setAuditLogs(auditRes.logs || []);
    setCustomMilestones(auditRes.milestones || []);
  }, []);

  useEffect(() => {
    let channel: any;
    verifyAdminSession().then((ok) => {
      if (!ok) return;
      channel = supabase
        .channel("admin-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadAllEnterpriseData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadAllEnterpriseData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); loadAllEnterpriseData(); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [loadAllEnterpriseData]);

  const verifyAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return false; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") { await supabase.auth.signOut(); setIsCheckingAuth(false); return false; }
    setAdminProfile(prof);
    setAdminDisplayName(prof.full_name || "Admin");
    setAdminCountries((prof.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadAllEnterpriseData();
    return true;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating Admin Control Center...");
    await fetch("/api/seed", { method: "POST" });
    const raw = email.trim();
    const norm = raw.includes("@") ? raw : normalizeAuthUsername(raw, "admin");
    const { data, error } = await supabase.auth.signInWithPassword({ email: norm, password });
    if (error) return setAuthMsg(error.message);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "admin") { await supabase.auth.signOut(); return setAuthMsg("Admin clearance required."); }
    setAdminProfile(prof);
    await loadAllEnterpriseData();
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "milestone",
        action: "create",
        payload: { title: msTitle.trim(), metric: msMetric, target: Number(msTarget), icon: msIcon },
      }),
    });
    setMsTitle("");
    setStatusMsg("🏆 Custom Milestone Achievement published live!");
    await loadAllEnterpriseData();
  };

  const handleDeleteMilestone = async (id: string) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "milestone", action: "delete", payload: { id } }),
    });
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
    setStatusMsg(lockState ? "🔒 All SMMs Locked!" : "🔓 All SMMs Unlocked!");
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
    setStatusMsg("✓ Admin Control Center Settings Updated!");
    await loadAllEnterpriseData();
  };

  const openEditEmployee = (emp: any) => {
    setEditingEmployee({ ...emp });
    setEmpCountries((emp.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
    setEmpPlatforms(emp.platforms?.length > 0 ? emp.platforms : ["twitter"]);
    setEmpTlIds(emp.team_leader_ids?.length > 0 ? emp.team_leader_ids : emp.team_leader_id ? [emp.team_leader_id] : []);
    const smmsUnderTl = profiles.filter((p) => p.role === "smm" && (p.team_leader_id === emp.id || (p.team_leader_ids && p.team_leader_ids.includes(emp.id)))).map((s) => s.id);
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
    return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse">Initializing Admin Control Center...</div>;
  }

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">Executive Authorization</span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Control Center</h1>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-2xl">
            <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@executive.com" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passcode" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none" />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm">Sign In to Admin Control Center</button>
          </form>
          <div className="mt-6 text-center"><Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Portal</Link></div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter((p) => p.role === "team_leader");
  const allSmms = profiles.filter((p) => p.role === "smm");
  const uniqueProjects = Array.from(new Set(assets.map((a) => a.project_name || "General Campaign")));
  const filteredAssets = projectFilter === "All" ? assets : assets.filter((a) => (a.project_name || "General Campaign") === projectFilter);
  const q = searchQuery.toLowerCase().trim();
  const globalAchievements = computeAchievements(filteredAssets, metrics, customMilestones);

  // Filtered SMMs by SM Platform & Country
  const visibleSmms = allSmms.filter((s) => {
    if (q && !(s.full_name || "").toLowerCase().includes(q) && !(s.country || "").toLowerCase().includes(q)) return false;
    if (smmPlatformFilter !== "all") {
      const sPlats: string[] = s.platforms || [];
      const sAssetPlats = assets.filter((a) => a.smm_id === s.id).map((a) => a.platform);
      if (!sPlats.includes(smmPlatformFilter) && !sAssetPlats.includes(smmPlatformFilter)) return false;
    }
    if (smmCountryFilter !== "all" && !(s.country || "").toLowerCase().includes(smmCountryFilter.toLowerCase())) return false;
    return true;
  });

  // Filtered Assets by SM Platform & Country
  const visibleAssets = filteredAssets.filter((a) => {
    if (q && !(a.account_id || "").toLowerCase().includes(q) && !(a.platform || "").toLowerCase().includes(q)) return false;
    if (assetPlatformFilter !== "all" && (a.platform || "").toLowerCase() !== assetPlatformFilter.toLowerCase()) return false;
    if (assetCountryFilter !== "all" && !(a.country_language || "").toLowerCase().includes(assetCountryFilter.toLowerCase())) return false;
    return true;
  });

  const activeSpotlightTl = spotlightTl ? profiles.find((p) => p.id === spotlightTl.id) || spotlightTl : null;
  const activeSpotlightSmm = spotlightSmm ? profiles.find((p) => p.id === spotlightSmm.id) || spotlightSmm : null;

  return (
    <div className={`min-h-screen ${currentTheme.shellBg} p-3 sm:p-6 md:p-8 pb-28 md:pb-12 font-sans transition-colors duration-500`}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Clean, Authoritative Admin Control Center Header (No Cluttered Button Mess) */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center border-b border-zinc-800/90 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-widest border px-2.5 py-0.5 rounded-full font-bold ${currentTheme.badge}`}>
                Admin Control Center
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${liveSyncPulse ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                ● LIVE SYNC
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1.5 tracking-tight">Admin Control Center</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Team Leaders: <b className="text-white">{teamLeaders.length}</b> • SMM Handlers: <b className="text-white">{allSmms.length}</b> • Social Media Assets: <b className="text-white">{filteredAssets.length}</b>
            </p>
          </div>

          {/* Sleek Consolidated Command Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <ThemePickerDropdown themeId={themeId} onChange={changeTheme} />

            <button
              onClick={() => setActiveTab("campaign")}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-all ${currentTheme.accentBg}`}
            >
              🎯 Give Campaign
            </button>

            <button
              onClick={() => setShowProvisionModal(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-white font-bold transition-all"
            >
              + New User
            </button>

            {/* Clean Consolidated Reports & Export Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-emerald-300 font-bold flex items-center gap-1.5"
              >
                <span>📊 Fanpage CSV Report</span>
                <span className="text-[10px]">▼</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-zinc-950 border border-zinc-700 rounded-2xl p-4 shadow-2xl space-y-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-xs font-bold text-white border-b border-zinc-800 pb-2">
                    ⬇ Fanpage Umbrella 27-Column CSV
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">1. Sheet Tab</label>
                    <select value={csvSheetTab} onChange={(e) => setCsvSheetTab(e.target.value as SheetTabOption)} className="w-full rounded-xl bg-black border border-zinc-800 p-2 text-xs text-white">
                      <option value="all">All Platforms Combined</option>
                      <option value="twitter">Tab: Twitter(X)</option>
                      <option value="facebook">Tab: Facebook</option>
                      <option value="instagram">Tab: Instagram</option>
                      <option value="tiktok">Tab: Tiktok</option>
                      <option value="achievements">Tab: Achievements</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">2. Horizon</label>
                    <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="w-full rounded-xl bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">3. Campaign Filter</label>
                    <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-2 text-xs text-white">
                      <option value="All">All Campaigns</option>
                      {uniqueProjects.map((proj) => <option key={proj} value={proj}>{proj}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportHorizonCSV({ horizon: csvHorizon, sheetTab: csvSheetTab, metrics, assets, profiles, projectFilter });
                      setShowExportMenu(false);
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs ${currentTheme.accentBg}`}
                  >
                    ⬇ Download 27-Column CSV
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAdminSettings(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 font-bold"
            >
              ⚙ Settings
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* Unified Authoritative Navigation Bar */}
        <div className="hidden md:flex flex-wrap justify-between items-center gap-2 bg-zinc-950/90 border border-zinc-800/90 p-2.5 rounded-2xl">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "tls", label: `🛡 Team Leaders (${teamLeaders.length})` },
              { id: "smms", label: `👤 SMMs (${allSmms.length})` },
              { id: "assets", label: `🗂 Assets (${filteredAssets.length})` },
              { id: "campaign", label: "🎯 Give Campaign" },
              { id: "graphs", label: "📈 Leaderboard & Graphs" },
              { id: "archives", label: `🗄 Archives (${auditLogs.length})` },
              { id: "achievements", label: `🏆 Milestones (${globalAchievements.length})` },
            ].map((t: any) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === t.id ? `${currentTheme.accentBg} shadow-md` : "bg-zinc-900/70 text-zinc-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Team Leaders, SMMs, Assets..."
            className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 w-56"
          />
        </div>

        {/* TAB 1: TEAM LEADERS */}
        {activeTab === "tls" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
            {teamLeaders
              .filter((tl) => !q || (tl.full_name || "").toLowerCase().includes(q) || (tl.country || "").toLowerCase().includes(q))
              .map((tl) => {
                const tlSmms = allSmms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
                const tlAssets = filteredAssets.filter((a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id));
                const tlLogs = metrics.filter((m) => tlAssets.some((a) => a.id === m.asset_id));
                const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);

                return (
                  <div
                    key={tl.id}
                    onClick={() => setSpotlightTl(tl)}
                    className={`group cursor-pointer rounded-3xl p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-black border border-zinc-800 hover:${currentTheme.cardBorder} transition-all duration-300 hover:-translate-y-2 ${currentTheme.glow} space-y-4`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border font-bold ${currentTheme.badge}`}>
                          🛡 Team Leader
                        </span>
                        <h3 className="font-bold text-xl text-white mt-2">Team Leader {tl.full_name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">🌍 {tl.country}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditEmployee(tl); }}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 font-bold"
                      >
                        ✎ Edit
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-black/80 border border-zinc-900 font-mono text-xs">
                      <div><span className="text-[9px] text-zinc-500 block">SMM SQUAD</span><span className="text-emerald-400 font-bold text-base">{tlSmms.length}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">ASSETS</span><span className="text-purple-400 font-bold text-base">{tlAssets.length}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold text-base">{impr.toLocaleString()}</span></div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-zinc-400 group-hover:text-white pt-1">
                      <span>Tap to Pop Out Squad Window</span>
                      <span className="font-bold">↗</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 2: SMMs WITH DEDICATED SOCIAL MEDIA (SM) & COUNTRY FILTER BAR */}
        {activeTab === "smms" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* SMM Filter Matrix by Social Media & Country */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Filter SMMs by SM:</span>
                {["all", ...PLATFORMS].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSmmPlatformFilter(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border transition-all ${
                      smmPlatformFilter === p ? `${currentTheme.accentBg} border-transparent` : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {p === "all" ? "All SMs" : p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Filter by Country:</span>
                <select
                  value={smmCountryFilter}
                  onChange={(e) => setSmmCountryFilter(e.target.value)}
                  className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none"
                >
                  <option value="all">All Countries ({allSmms.length})</option>
                  {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => handleGlobalBatchLock(true)} className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold">🔒 Lock All</button>
                <button type="button" onClick={() => handleGlobalBatchLock(false)} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">🔓 Unlock All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleSmms.map((smm) => {
                const smmAssets = filteredAssets.filter((a) => a.smm_id === smm.id);
                const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
                const totalImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
                const totalEng = smmLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
                const tl = teamLeaders.find((t) => t.id === smm.team_leader_id);

                return (
                  <div
                    key={smm.id}
                    onClick={() => setSpotlightSmm(smm)}
                    className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-black border border-zinc-800 hover:border-blue-400 transition-all duration-300 hover:-translate-y-2 shadow-xl space-y-4"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold">
                            👤 SMM
                          </span>
                          {tl && <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-emerald-300 font-bold">TL: {tl.full_name}</span>}
                        </div>
                        <h3 className="text-xl font-bold text-white mt-2">{smm.full_name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">🌍 {smm.country}</p>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSmmLock(smm)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                            smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                          }`}
                        >
                          {smm.is_locked ? "🔒" : "🔓"}
                        </button>
                        <button type="button" onClick={() => openEditEmployee(smm)} className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 font-bold">✎ Edit</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-black/80 border border-zinc-900 font-mono text-xs">
                      <div><span className="text-[9px] text-zinc-500 block">ASSETS</span><span className="text-white font-bold text-base">{smmAssets.length}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                      <div><span className="text-[9px] text-zinc-500 block">ENG</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
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

        {/* TAB 3: ASSETS WITH DEDICATED SOCIAL MEDIA (SM) & COUNTRY FILTER BAR */}
        {activeTab === "assets" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Filter Assets by SM:</span>
                {["all", ...PLATFORMS].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAssetPlatformFilter(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border transition-all ${
                      assetPlatformFilter === p ? `${currentTheme.accentBg} border-transparent` : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {p === "all" ? "All SMs" : p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Filter by Country:</span>
                <select
                  value={assetCountryFilter}
                  onChange={(e) => setAssetCountryFilter(e.target.value)}
                  className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none"
                >
                  <option value="all">All Countries ({filteredAssets.length})</option>
                  {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleAssets.map((asset) => {
                const isSuspended = asset.status === "suspended";
                const smm = profiles.find((p) => p.id === asset.smm_id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => setInspectingAsset(asset)}
                    className={`group cursor-pointer bg-zinc-950 border rounded-3xl p-5 space-y-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 ${
                      isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800 hover:border-purple-400"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetAssetStatus(asset, isSuspended ? "active" : "suspended"); }}
                      className={`absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                        isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {isSuspended ? "⚠ SUSP" : "● ACTV"} ⇄
                    </button>
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                    <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-20">{asset.account_id}</h3>
                    <p className="text-xs text-zinc-400">🌍 {asset.country_language} • 🗣 {asset.language || "English"} • 👤 {smm?.full_name || "Unassigned"}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold rounded-xl text-xs">
                        🔍 Pop Out Asset
                      </button>
                      <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold rounded-xl text-xs">
                        ✎ Edit All 15
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: GIVE CAMPAIGN */}
        {activeTab === "campaign" && (
          <CampaignDispatchWizard actorId={adminProfile.id} teamLeaders={teamLeaders} smms={allSmms} assets={assets} onSuccess={(msg) => { setStatusMsg(msg); loadAllEnterpriseData(); setActiveTab("assets"); }} />
        )}

        {/* TAB 5: CONTRASTING LEADERBOARD & SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <ExecutiveAnalyticsGraphs
            assets={filteredAssets}
            metrics={metrics}
            profiles={profiles}
            onSelectAsset={(a) => setInspectingAsset(a)}
            onSelectTl={(tl) => setSpotlightTl(tl)}
            onSelectSmm={(smm) => setSpotlightSmm(smm)}
            titlePrefix="Admin Control Center"
          />
        )}

        {/* TAB 6: ARCHIVES (CLICK ANY EVENT FOR BLURRED SPOTLIGHT MODAL + CSV EXPORT) */}
        {activeTab === "archives" && (
          <ForensicArchiveVault logs={auditLogs} onRestore={handleRestoreArchive} />
        )}

        {/* TAB 7: CUSTOM ADMIN MILESTONES & ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <form onSubmit={handleCreateMilestone} className="bg-zinc-950 border border-yellow-500/40 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase tracking-widest bg-yellow-500/20 text-yellow-300 px-2.5 py-0.5 rounded-full font-bold">
                    Custom Milestone Creator
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">🏆 Create Custom Admin Milestone Achievement</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <input type="text" required value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="Milestone Title (e.g. 50K Club)" className="sm:col-span-2 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                <select value={msMetric} onChange={(e) => setMsMetric(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                  <option value="engagements">Metric: Engagements</option>
                  <option value="impressions">Metric: Impressions</option>
                  <option value="followers">Metric: Total Followers</option>
                  <option value="posts">Metric: Posts Published</option>
                  <option value="assets">Metric: Active Assets</option>
                </select>
                <input type="number" required value={msTarget} onChange={(e) => setMsTarget(e.target.value)} placeholder="Target Number" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                <button type="submit" className="py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-xs">
                  + Publish Milestone
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {globalAchievements.map((ach: any) => (
                <div key={ach.id} className={`rounded-2xl p-5 border relative ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60" : "bg-zinc-950 border-zinc-800 opacity-80"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-3xl">{ach.icon}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400"}`}>
                        {ach.unlocked ? "✓ UNLOCKED" : `${ach.progress}%`}
                      </span>
                      {ach.isCustom && (
                        <button type="button" onClick={() => handleDeleteMilestone(ach.id)} className="text-xs text-red-400 hover:underline">✕</button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{ach.desc}</p>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${ach.progress}%` }} />
                  </div>
                  <div className="mt-2 text-xs font-mono text-yellow-300">{ach.stat}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE STICKY BOTTOM DOCK */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-1.5 py-1.5 flex justify-around items-center">
        {[
          { id: "tls", icon: "🛡", label: "TLs" },
          { id: "smms", icon: "👤", label: "SMMs" },
          { id: "assets", icon: "🗂", label: "Assets" },
          { id: "graphs", icon: "📈", label: "Leaders" },
          { id: "archives", icon: "🗄", label: "Archives" },
          { id: "achievements", icon: "🏆", label: "Goals" },
        ].map((t: any) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center py-1 px-2 rounded-xl ${activeTab === t.id ? "text-emerald-400 font-bold bg-emerald-500/10" : "text-zinc-500"}`}>
            <span className="text-base">{t.icon}</span><span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>

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

      {inspectingAsset && (
        <AssetGrowthModal asset={inspectingAsset} metrics={metrics} profiles={profiles} onClose={() => setInspectingAsset(null)} onEdit={(a) => setEditingAsset(a)} onToggleStatus={handleSetAssetStatus} />
      )}

      {editingAsset && (
        <UniversalAssetEditModal asset={editingAsset} teamLeaders={teamLeaders} smms={allSmms} canReassignSmm={true} onClose={() => setEditingAsset(null)} onSave={handleSaveAsset} onDelete={handleDeleteAsset} />
      )}

      {showAdminSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowAdminSettings(false)}>
          <form onSubmit={handleSaveAdminOwnSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">⚙ Admin Control Center Settings</h2>
              <button type="button" onClick={() => setShowAdminSettings(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-300 rounded-xl">✕</button>
            </div>
            <input type="text" required value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} placeholder="Admin Display Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Admin Regions" options={ALL_COUNTRIES} selected={adminCountries} onChange={setAdminCountries} />
            <input type="password" value={adminNewPass} onChange={(e) => setAdminNewPass(e.target.value)} placeholder="New Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Settings Live</button>
            <button type="button" onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="w-full py-3 bg-zinc-900 text-red-400 font-bold rounded-xl text-xs">Sign Out</button>
          </form>
        </div>
      )}

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
              <FancyEntityMultiSelect label="SMM Handlers Under This Team Leader" items={allSmms.map((s) => ({ id: s.id, label: s.full_name, sub: `${s.country} • ${(s.platforms || ["twitter"]).join(", ")}` }))} selectedIds={empAssignedSmmIds} onChange={setEmpAssignedSmmIds} />
            )}
            {editingEmployee.role === "smm" && (
              <>
                <FancyEntityMultiSelect label="Assigned Team Leader(s)" items={teamLeaders.map((tl) => ({ id: tl.id, label: `Team Leader ${tl.full_name}`, sub: tl.country }))} selectedIds={empTlIds} onChange={setEmpTlIds} />
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

      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4" onClick={() => setShowProvisionModal(false)}>
          <form onSubmit={handleProvisionUser} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">+ Provision New User</h3>
              <button type="button" onClick={() => setShowProvisionModal(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">✕</button>
            </div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-emerald-400 font-bold">
              <option value="smm">Role: SMM Handler (@smm)</option><option value="team_leader">Role: Team Leader (@tl)</option><option value="admin">Role: Admin (@admin)</option>
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
