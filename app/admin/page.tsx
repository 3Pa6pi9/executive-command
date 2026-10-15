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

  const [activeTab, setActiveTab] = useState<
    "hierarchy" | "campaign" | "directory" | "assets" | "archive" | "graphs" | "achievements"
  >("hierarchy");
  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [selectedSmmId, setSelectedSmmId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  // Modals & Drawers
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [empCountries, setEmpCountries] = useState<string[]>([]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>([]);
  const [empTlIds, setEmpTlIds] = useState<string[]>([]);
  const [empAssignedSmmIds, setEmpAssignedSmmIds] = useState<string[]>([]);
  const [empAssignedAssetIds, setEmpAssignedAssetIds] = useState<string[]>([]);
  const [empNewPass, setEmpNewPass] = useState("");

  // Admin Settings Drawer State
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [adminCountries, setAdminCountries] = useState<string[]>([]);
  const [adminNewPass, setAdminNewPass] = useState("");

  // Provision Modal
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
      fetch("/api/crud").then((r) => r.json()).catch(() => ({ logs: [] })),
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
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadAllEnterpriseData]);

  const verifyAdminSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setIsCheckingAuth(false);
      return false;
    }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      setIsCheckingAuth(false);
      return false;
    }
    setAdminProfile(prof);
    setAdminDisplayName(prof.full_name || "Master Admin");
    setAdminCountries(
      (prof.country || "Kenya")
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean)
    );
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
    setAdminDisplayName(prof.full_name || "Master Admin");
    setAdminCountries(
      (prof.country || "Kenya")
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean)
    );
    await loadAllEnterpriseData();
  };

  const handleToggleSmmLock = async (smm: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "update",
        payload: { targetId: smm.id, is_locked: !smm.is_locked },
      }),
    });
    setStatusMsg(`${smm.full_name} is now ${!smm.is_locked ? "LOCKED 🔒" : "OPEN 🔓"}`);
    await loadAllEnterpriseData();
  };

  const handleGlobalBatchLock = async (lockState: boolean) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "batch_lock",
        payload: { is_locked: lockState },
      }),
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
        payload: {
          targetId: adminProfile.id,
          full_name: adminDisplayName,
          country: adminCountries.join(", "),
          newPassword: adminNewPass,
        },
      }),
    });
    setAdminNewPass("");
    setShowAdminSettings(false);
    setStatusMsg("✓ Master Admin Settings & Security Updated Live!");
    await loadAllEnterpriseData();
  };

  const openEditEmployee = (emp: any) => {
    setEditingEmployee({ ...emp });
    setEmpCountries(
      (emp.country || "Kenya")
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean)
    );
    setEmpPlatforms(emp.platforms?.length > 0 ? emp.platforms : ["twitter"]);
    setEmpTlIds(emp.team_leader_ids?.length > 0 ? emp.team_leader_ids : emp.team_leader_id ? [emp.team_leader_id] : []);
    const smmsUnderTl = profiles
      .filter(
        (p) =>
          p.role === "smm" &&
          (p.team_leader_id === emp.id || (p.team_leader_ids && p.team_leader_ids.includes(emp.id)))
      )
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
    setStatusMsg("✓ Personnel Profile, Platforms, Countries & Squad Assignments Updated Live!");
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
        payload: {
          role: newRole,
          full_name: newName,
          email: newEmail,
          password: newPass,
          country: newCountries.join(", "),
          platforms: newPlatforms,
          team_leader_ids: newRole === "smm" ? newTlIds : [],
        },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowProvisionModal(false);
      setNewName("");
      setNewEmail("");
      setNewPass("");
      setStatusMsg(`✓ Provisioned ${newRole.toUpperCase()} ${newName}!`);
      await loadAllEnterpriseData();
    } else {
      alert(data.error);
    }
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "update",
        payload: { id: asset.id, status: newStatus },
      }),
    });
    setStatusMsg(`Asset marked ${newStatus.toUpperCase()}`);
    await loadAllEnterpriseData();
  };

  const handleSaveAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "update",
        payload: updatedAsset,
      }),
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
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "audit",
        action: "restore",
        payload: { snapshot: snap, entityType: log.entity_type },
      }),
    });
    setStatusMsg("♻ Restored record from Archive Vault!");
    await loadAllEnterpriseData();
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse">
        Verifying Executive Vault Clearance...
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
              Tier 1 — Executive Vault
            </span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Command Center</h1>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-2xl">
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@executive.com"
              className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master Passcode"
              className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none"
            />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm">
              Unlock Executive Vault
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">
              ← Return to SMM Handler Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter((p) => p.role === "team_leader");
  const allSmms = profiles.filter((p) => p.role === "smm");
  const uniqueProjects = Array.from(new Set(assets.map((a) => a.project_name || "General Campaign")));
  const filteredAssets =
    projectFilter === "All" ? assets : assets.filter((a) => (a.project_name || "General Campaign") === projectFilter);

  const q = searchQuery.toLowerCase().trim();
  const globalAchievements = computeAchievements(filteredAssets, metrics);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Executive Bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                Tier 1 — Executive God Mode
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  liveSyncPulse ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"
                }`}
              >
                LIVE
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">Global Admin Command Center</h1>
            <p className="text-xs text-zinc-400">
              Admin: <b className="text-white">{adminProfile.full_name}</b> • TLs: {teamLeaders.length} • SMMs: {allSmms.length} • Assets: {filteredAssets.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("campaign")}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
            >
              🎯 Give Campaign
            </button>
            <button
              onClick={() => setShowProvisionModal(true)}
              className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all"
            >
              + Provision User
            </button>
            <button
              onClick={() => setShowAdminSettings(true)}
              className="px-3.5 py-2.5 bg-zinc-900 border border-emerald-500/40 text-emerald-300 hover:bg-zinc-800 font-bold rounded-xl text-xs transition-all"
            >
              ⚙ Admin Settings
            </button>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white"
            >
              <option value="All">All Campaigns</option>
              {uniqueProjects.map((proj) => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
            <select
              value={csvHorizon}
              onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)}
              className="bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-bold px-2.5 py-2 rounded-xl uppercase"
            >
              <option value="weekly">Weekly CSV</option>
              <option value="monthly">Monthly CSV</option>
              <option value="quarterly">Quarterly CSV</option>
              <option value="yearly">Yearly CSV</option>
            </select>
            <button
              onClick={() =>
                exportHorizonCSV({
                  horizon: csvHorizon,
                  metrics,
                  assets: filteredAssets,
                  profiles,
                  projectFilter,
                  scopeLabel: "Master_Enterprise",
                })
              }
              className="px-3.5 py-2 bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs"
            >
              ⬇ CSV
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-pulse">
            {statusMsg}
          </div>
        )}

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex flex-wrap justify-between items-center gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("hierarchy")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "hierarchy" ? "bg-emerald-500 text-black shadow-md" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🏛 Command Hierarchy
            </button>
            <button onClick={() => setActiveTab("campaign")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "campaign" ? "bg-purple-600 text-white shadow-md" : "bg-zinc-900 text-purple-300 border border-purple-500/30"}`}>
              🎯 Give Campaign
            </button>
            <button onClick={() => setActiveTab("directory")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "directory" ? "bg-blue-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              👥 TLs & SMMs ({profiles.length})
            </button>
            <button onClick={() => setActiveTab("assets")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🗂 All Assets ({filteredAssets.length})
            </button>
            <button onClick={() => setActiveTab("graphs")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "graphs" ? "bg-cyan-400 text-black shadow-md" : "bg-zinc-900 text-cyan-300"}`}>
              📈 Summary Graphs
            </button>
            <button onClick={() => setActiveTab("archive")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "archive" ? "bg-amber-500 text-black shadow-md" : "bg-zinc-900 text-amber-300"}`}>
              🗄 Archive Vault ({auditLogs.length})
            </button>
            <button onClick={() => setActiveTab("achievements")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "achievements" ? "bg-yellow-400 text-black shadow-md" : "bg-zinc-900 text-yellow-300"}`}>
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

        {/* TAB 1: INLINE ACCORDION COMMAND HIERARCHY (UNFOLDS RIGHT UNDERNEATH EACH TL CARD — ZERO SCROLLING TO BOTTOM!) */}
        {activeTab === "hierarchy" && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <p className="text-xs text-zinc-400">
                Tap any <b className="text-emerald-400">Team Leader</b> to unfold their SMM Squad right inside the card. Tap any <b className="text-blue-400">SMM</b> to unfold their Assets inline.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleGlobalBatchLock(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500 hover:text-black border border-red-500/30 text-red-400 text-xs font-bold transition-all"
                >
                  🔒 Lock All SMMs
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalBatchLock(false)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all"
                >
                  🔓 Unlock All SMMs
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {teamLeaders
                .filter((tl) => !q || (tl.full_name || "").toLowerCase().includes(q))
                .map((tl) => {
                  const isSelected = selectedTlId === tl.id;
                  const tlSmms = allSmms.filter(
                    (s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id))
                  );
                  const tlAssets = filteredAssets.filter(
                    (a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id)
                  );
                  const tlLogs = metrics.filter((m) => tlAssets.some((a) => a.id === m.asset_id));
                  const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);
                  const eng = tlLogs.reduce((sum, x) => sum + (x.engagements || 0), 0);

                  return (
                    <div
                      key={tl.id}
                      className={`rounded-3xl border transition-all duration-500 ${
                        isSelected
                          ? "bg-gradient-to-b from-emerald-950/30 via-zinc-950 to-black border-emerald-500/70 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]"
                          : "bg-zinc-950 border-zinc-800 hover:border-emerald-500/40"
                      }`}
                    >
                      {/* Team Leader Header Bar */}
                      <div
                        onClick={() => {
                          setSelectedTlId(isSelected ? null : tl.id);
                          setSelectedSmmId(null);
                        }}
                        className="cursor-pointer p-4 sm:p-5 flex flex-wrap justify-between items-center gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-3 w-3 rounded-full transition-all duration-300 ${
                              isSelected ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-zinc-700"
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg sm:text-xl text-white">Commander {tl.full_name}</h3>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                {tlSmms.length} SMMs • {tlAssets.length} Assets
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">🌍 Regions: {tl.country}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-right font-mono text-xs hidden sm:block">
                            <div className="text-blue-400 font-bold">{impr.toLocaleString()} Impr</div>
                            <div className="text-purple-400">{eng.toLocaleString()} Eng</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEmployee(tl);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-emerald-500 hover:text-black border border-zinc-700 text-emerald-300 text-xs font-bold transition-all"
                          >
                            ✎ Edit TL & Squad
                          </button>
                          <span
                            className={`text-sm font-bold transition-transform duration-300 ${
                              isSelected ? "rotate-180 text-emerald-400" : "text-zinc-500"
                            }`}
                          >
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* INLINE UNFOLDING SMM SQUAD DRAWER RIGHT INSIDE THIS TL CARD */}
                      <div
                        className={`grid transition-all duration-500 ease-in-out ${
                          isSelected ? "grid-rows-[1fr] opacity-100 border-t border-zinc-800/80" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="p-4 sm:p-5 space-y-4 bg-black/50 rounded-b-3xl">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <span className="text-xs font-bold uppercase text-blue-400">
                                👥 {tl.full_name}&apos;s SMM Squad ({tlSmms.length} Handlers) — Tap any SMM to unfold their Assets inline
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              {tlSmms.map((smm) => {
                                const smmAssets = filteredAssets.filter((a) => a.smm_id === smm.id);
                                const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
                                const sImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
                                const isSmmOpen = selectedSmmId === smm.id;

                                return (
                                  <div
                                    key={smm.id}
                                    className={`rounded-2xl border transition-all duration-300 ${
                                      isSmmOpen
                                        ? "bg-blue-950/20 border-blue-400 shadow-lg md:col-span-2"
                                        : "bg-zinc-950 border-zinc-800 hover:border-blue-500/50"
                                    }`}
                                  >
                                    <div
                                      onClick={() => setSelectedSmmId(isSmmOpen ? null : smm.id)}
                                      className="cursor-pointer p-4 flex flex-wrap justify-between items-center gap-3"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-white text-base">{smm.full_name}</h4>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                                            {smmAssets.length} Assets
                                          </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                          🌍 {smm.country} • SM: {(smm.platforms || ["twitter"]).join(", ").toUpperCase()}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-xs font-mono text-blue-400 font-bold mr-1">
                                          {sImpr.toLocaleString()} Impr
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSmmLock(smm)}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                                            smm.is_locked
                                              ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black"
                                              : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                                          }`}
                                          title="Lock or Unlock SMM Weekly Metric Input"
                                        >
                                          {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openEditEmployee(smm)}
                                          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-blue-300 text-[11px] font-bold"
                                        >
                                          ✎ Edit SMM
                                        </button>
                                      </div>
                                    </div>

                                    {/* INLINE UNFOLDING ASSETS INSIDE THIS SMM CARD */}
                                    <div
                                      className={`grid transition-all duration-300 ease-in-out ${
                                        isSmmOpen ? "grid-rows-[1fr] opacity-100 border-t border-zinc-800/80" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                                      }`}
                                    >
                                      <div className="overflow-hidden">
                                        <div className="p-4 bg-black/80 rounded-b-2xl space-y-3">
                                          <div className="text-[11px] font-bold uppercase text-purple-300">
                                            🗂 {smm.full_name}&apos;s Managed Social Media Assets ({smmAssets.length}) — Tap any Asset for Full Details & Growth
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {smmAssets.map((asset) => {
                                              const isSuspended = asset.status === "suspended";
                                              return (
                                                <div
                                                  key={asset.id}
                                                  onClick={() => setInspectingAsset(asset)}
                                                  className={`cursor-pointer bg-zinc-950 border rounded-xl p-3.5 space-y-2 relative transition-all hover:-translate-y-0.5 hover:border-purple-500 ${
                                                    isSuspended ? "border-red-500/40 bg-red-950/10" : "border-zinc-800"
                                                  }`}
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleSetAssetStatus(asset, isSuspended ? "active" : "suspended");
                                                    }}
                                                    className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                                                      isSuspended
                                                        ? "bg-red-500/20 border-red-500/40 text-red-300"
                                                        : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                                    }`}
                                                  >
                                                    {isSuspended ? "⚠ SUSP" : "● ACTV"} ⇄
                                                  </button>
                                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                                    {asset.platform}
                                                  </span>
                                                  <h5 className="font-bold text-white text-sm truncate pr-16">{asset.account_id}</h5>
                                                  <p className="text-[11px] text-zinc-400">
                                                    🌍 {asset.country_language} • 🗣 {asset.language || "English"}
                                                  </p>
                                                  <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                      type="button"
                                                      onClick={() => setInspectingAsset(asset)}
                                                      className="flex-1 py-1.5 bg-purple-600/20 text-purple-300 rounded-lg text-[10px] font-bold"
                                                    >
                                                      📈 Growth
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setEditingAsset(asset)}
                                                      className="flex-1 py-1.5 bg-zinc-900 text-emerald-400 rounded-lg text-[10px] font-bold"
                                                    >
                                                      ✎ Edit All
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                            {smmAssets.length === 0 && (
                                              <div className="col-span-3 text-center py-4 text-xs text-zinc-500">
                                                No Assets registered under {smm.full_name} yet.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: GIVE CAMPAIGN DISPATCH WIZARD */}
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

        {/* TAB 3: PERSONNEL DIRECTORY (WITH DIRECT LOCK SMM BUTTON + EDIT ALL) */}
        {activeTab === "directory" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles
              .filter(
                (p) =>
                  !q ||
                  (p.full_name || "").toLowerCase().includes(q) ||
                  (p.role || "").toLowerCase().includes(q) ||
                  (p.country || "").toLowerCase().includes(q)
              )
              .map((emp) => (
                <div key={emp.id} className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/40 rounded-2xl p-5 space-y-3 transition-all">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {emp.role}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{emp.full_name}</h3>
                      <p className="text-xs text-zinc-400">🌍 {emp.country || "Global"}</p>
                      <p className="text-[11px] text-purple-300 mt-0.5">
                        SM: {(emp.platforms || ["twitter"]).join(", ").toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {emp.role === "smm" && (
                        <button
                          type="button"
                          onClick={() => handleToggleSmmLock(emp)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            emp.is_locked
                              ? "bg-red-500/20 border-red-500/40 text-red-400"
                              : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                          }`}
                        >
                          {emp.is_locked ? "🔒 Locked" : "🔓 Open"}
                        </button>
                      )}
                      <button
                        onClick={() => openEditEmployee(emp)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold"
                      >
                        ✎ Edit All
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* TAB 4: ALL ASSETS GRID */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets
              .filter(
                (a) =>
                  !q ||
                  (a.account_id || "").toLowerCase().includes(q) ||
                  (a.platform || "").toLowerCase().includes(q) ||
                  (a.country_language || "").toLowerCase().includes(q)
              )
              .map((asset) => {
                const isSuspended = asset.status === "suspended";
                const smm = profiles.find((p) => p.id === asset.smm_id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => setInspectingAsset(asset)}
                    className={`cursor-pointer bg-zinc-950 border rounded-2xl p-5 space-y-3 relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-purple-500/60 ${
                      isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetAssetStatus(asset, isSuspended ? "active" : "suspended");
                      }}
                      className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        isSuspended
                          ? "bg-red-500/20 border-red-500/40 text-red-300"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {isSuspended ? "⚠ SUSP" : "● ACTV"} ⇄
                    </button>

                    <div>
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
                        {asset.platform}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-20">{asset.account_id}</h3>
                      <p className="text-xs text-zinc-400">
                        🌍 {asset.country_language} • 🗣 {asset.language || "English"} • 👤 {smm?.full_name || "Unassigned"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setInspectingAsset(asset)}
                        className="py-2 bg-purple-600/20 text-purple-300 font-bold rounded-xl text-xs"
                      >
                        📈 Full Details & Growth
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAsset(asset)}
                        className="py-2 bg-zinc-900 text-emerald-400 font-bold rounded-xl text-xs"
                      >
                        ✎ Edit All 15 Fields
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 5: DEEP ANALYTICS SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <ExecutiveAnalyticsGraphs
            assets={filteredAssets}
            metrics={metrics}
            profiles={profiles}
            onSelectAsset={(a) => setInspectingAsset(a)}
            titlePrefix="Global Enterprise"
          />
        )}

        {/* TAB 6: FORENSIC ARCHIVE VAULT */}
        {activeTab === "archive" && (
          <ForensicArchiveVault logs={auditLogs} onRestore={handleRestoreArchive} />
        )}

        {/* TAB 7: ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {globalAchievements.map((ach) => (
              <div
                key={ach.id}
                className={`rounded-2xl p-5 border ${
                  ach.unlocked
                    ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60"
                    : "bg-zinc-950 border-zinc-800 opacity-75"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-3xl">{ach.icon}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-500"
                    }`}
                  >
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
      </div>

      {/* MOBILE STICKY BOTTOM DOCK */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-1.5 py-1.5 flex justify-around items-center">
        {[
          { id: "hierarchy", icon: "🏛", label: "Squads" },
          { id: "campaign", icon: "🎯", label: "Campaign" },
          { id: "directory", icon: "👥", label: "People" },
          { id: "assets", icon: "🗂", label: "Assets" },
          { id: "graphs", icon: "📈", label: "Graphs" },
          { id: "archive", icon: "🗄", label: "Archive" },
        ].map((t: any) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center py-1 px-2 rounded-xl ${
              activeTab === t.id ? "text-emerald-400 font-bold bg-emerald-500/10" : "text-zinc-500"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>

      {/* FULL ASSET INSPECTOR MODAL */}
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

      {/* UNIVERSAL 15-FIELD ASSET EDITOR MODAL */}
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

      {/* ADMIN SETTINGS SLIDE-OVER DRAWER */}
      {showAdminSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAdminSettings(false)}>
          <form
            onSubmit={handleSaveAdminOwnSettings}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Tier 1 — Executive Configuration</span>
                <h2 className="text-xl font-bold text-white">⚙ Master Admin Settings & Global Locks</h2>
              </div>
              <button type="button" onClick={() => setShowAdminSettings(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                ✕
              </button>
            </div>

            <div className="p-4 bg-black border border-zinc-800 rounded-2xl space-y-3">
              <div className="text-xs font-bold uppercase text-amber-400">🔒 Global SMM Submission Lock Controls</div>
              <p className="text-[11px] text-zinc-400">
                Instantly freeze or open weekly metric logging across all {allSmms.length} SMM Handlers globally.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleGlobalBatchLock(true)}
                  className="py-3 bg-red-500/20 hover:bg-red-500 hover:text-black border border-red-500/40 text-red-400 font-bold rounded-xl text-xs transition-all"
                >
                  🔒 Lock All SMMs
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalBatchLock(false)}
                  className="py-3 bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 font-bold rounded-xl text-xs transition-all"
                >
                  🔓 Unlock All SMMs
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Admin Display Name</label>
              <input
                type="text"
                required
                value={adminDisplayName}
                onChange={(e) => setAdminDisplayName(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white"
              />
            </div>

            <FancyMultiSelect
              label="Admin Oversight Regions"
              options={ALL_COUNTRIES}
              selected={adminCountries}
              onChange={setAdminCountries}
            />

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">New Master Admin Password (Optional)</label>
              <input
                type="password"
                value={adminNewPass}
                onChange={(e) => setAdminNewPass(e.target.value)}
                placeholder="Leave blank to keep current password"
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white"
              />
            </div>

            <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs shadow-lg">
              Save Master Admin Settings Live
            </button>

            <div className="pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setAdminProfile(null);
                }}
                className="w-full py-3 bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 font-bold rounded-xl text-xs"
              >
                Sign Out of Executive Vault
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN EDIT TL OR SMM MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4" onClick={() => setEditingEmployee(null)}>
          <form
            onSubmit={handleSaveEmployee}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-emerald-500/50 rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                ✎ Admin Editor — {editingEmployee.full_name} ({editingEmployee.role.toUpperCase()})
              </h3>
              <button type="button" onClick={() => setEditingEmployee(null)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.full_name || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, full_name: e.target.value })}
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">System Role</label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-bold"
                >
                  <option value="smm">SMM HANDLER</option>
                  <option value="team_leader">TEAM LEADER</option>
                  <option value="admin">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Reset Password (Optional)</label>
                <input
                  type="password"
                  value={empNewPass}
                  onChange={(e) => setEmpNewPass(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <FancyMultiSelect
              label="Assigned Social Media Platforms"
              options={PLATFORMS}
              selected={empPlatforms}
              onChange={setEmpPlatforms}
            />

            <FancyMultiSelect
              label="Assigned Countries"
              options={ALL_COUNTRIES}
              selected={empCountries}
              onChange={setEmpCountries}
            />

            {editingEmployee.role === "team_leader" && (
              <FancyEntityMultiSelect
                label="SMM Handlers Assigned Under This Team Leader"
                items={allSmms.map((s) => ({
                  id: s.id,
                  label: s.full_name,
                  sub: `${s.country} • ${(s.platforms || ["twitter"]).join(", ")}`,
                }))}
                selectedIds={empAssignedSmmIds}
                onChange={setEmpAssignedSmmIds}
              />
            )}

            {editingEmployee.role === "smm" && (
              <>
                <FancyEntityMultiSelect
                  label="Assigned Team Leader(s) for This SMM"
                  items={teamLeaders.map((tl) => ({
                    id: tl.id,
                    label: `Commander ${tl.full_name}`,
                    sub: tl.country,
                  }))}
                  selectedIds={empTlIds}
                  onChange={setEmpTlIds}
                />

                <FancyEntityMultiSelect
                  label="Social Media Assets Assigned to This SMM"
                  items={assets.map((a) => ({
                    id: a.id,
                    label: `[${(a.platform || "").toUpperCase()}] ${a.account_id}`,
                    sub: `${a.country_language || "Global"} • ${a.language || "English"}`,
                  }))}
                  selectedIds={empAssignedAssetIds}
                  onChange={setEmpAssignedAssetIds}
                />
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">
                Save All Personnel Changes Live
              </button>
              {editingEmployee.id !== adminProfile.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteEmployee(editingEmployee)}
                  className="px-4 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs"
                >
                  🗑 Delete User
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* PROVISION NEW USER MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setShowProvisionModal(false)}>
          <form
            onSubmit={handleProvisionUser}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">+ Provision New Enterprise Account</h3>
              <button type="button" onClick={() => setShowProvisionModal(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">
                ✕
              </button>
            </div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-emerald-400 font-bold">
              <option value="smm">Role: SMM Handler (@smm)</option>
              <option value="team_leader">Role: Team Leader (@tl)</option>
              <option value="admin">Role: Master Admin (@admin)</option>
            </select>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Username (e.g. name@smm or name@tl)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={newPlatforms} onChange={setNewPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={newCountries} onChange={setNewCountries} />
            {newRole === "smm" && (
              <FancyEntityMultiSelect
                label="Assign Team Leader(s)"
                items={teamLeaders.map((tl) => ({ id: tl.id, label: tl.full_name, sub: tl.country }))}
                selectedIds={newTlIds}
                onChange={setNewTlIds}
              />
            )}
            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">
              Provision Account Live
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
