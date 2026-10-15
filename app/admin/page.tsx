"use client";

import { useState, useEffect, useCallback } from "react";
import { adminSupabase as supabase } from "@/lib/supabase";
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
  AssetGrowthModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  CampaignDispatchWizard,
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

  // Modals
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [empCountries, setEmpCountries] = useState<string[]>([]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>([]);
  const [empTlIds, setEmpTlIds] = useState<string[]>([]);
  const [empAssignedSmmIds, setEmpAssignedSmmIds] = useState<string[]>([]);
  const [empAssignedAssetIds, setEmpAssignedAssetIds] = useState<string[]>([]);
  const [empNewPass, setEmpNewPass] = useState("");

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
    // If editing a Team Leader, load all SMMs currently under them
    const smmsUnderTl = profiles
      .filter(
        (p) =>
          p.role === "smm" &&
          (p.team_leader_id === emp.id || (p.team_leader_ids && p.team_leader_ids.includes(emp.id)))
      )
      .map((s) => s.id);
    setEmpAssignedSmmIds(smmsUnderTl);
    // If editing an SMM, load all Assets currently under them
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

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "update",
        payload: editingAsset,
      }),
    });
    setEditingAsset(null);
    setStatusMsg("✓ Asset Updated Live!");
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

  const activeTl = teamLeaders.find((t) => t.id === selectedTlId);
  const displayedSmms = selectedTlId
    ? allSmms.filter(
        (s) => s.team_leader_id === selectedTlId || (s.team_leader_ids && s.team_leader_ids.includes(selectedTlId))
      )
    : [];
  const activeSmm = allSmms.find((s) => s.id === selectedSmmId);
  const displayedSmmAssets = selectedSmmId ? filteredAssets.filter((a) => a.smm_id === selectedSmmId) : [];

  const q = searchQuery.toLowerCase().trim();
  const globalAchievements = computeAchievements(filteredAssets, metrics);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Executive Bar with Front-and-Center Give Campaign Button */}
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
              TLs: {teamLeaders.length} • SMMs: {allSmms.length} • Assets: {filteredAssets.length} • Archive Logs: {auditLogs.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("campaign")}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg active:scale-95 transition-all"
            >
              🎯 Give Campaign
            </button>
            <button
              onClick={() => setShowProvisionModal(true)}
              className="px-3.5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl text-xs"
            >
              + Provision User
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
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setAdminProfile(null);
              }}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 rounded-xl text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold">
            {statusMsg}
          </div>
        )}

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex flex-wrap justify-between items-center gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("hierarchy")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "hierarchy" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
              🏛 Command Hierarchy
            </button>
            <button onClick={() => setActiveTab("campaign")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "campaign" ? "bg-purple-600 text-white" : "bg-zinc-900 text-purple-300 border border-purple-500/30"}`}>
              🎯 Give Campaign
            </button>
            <button onClick={() => setActiveTab("directory")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "directory" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
              👥 TLs & SMMs ({profiles.length})
            </button>
            <button onClick={() => setActiveTab("assets")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
              🗂 All Assets ({filteredAssets.length})
            </button>
            <button onClick={() => setActiveTab("archive")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "archive" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-300"}`}>
              🗄 Archive Vault ({auditLogs.length})
            </button>
            <button onClick={() => setActiveTab("graphs")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300"}`}>
              📈 Graphs
            </button>
            <button onClick={() => setActiveTab("achievements")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300"}`}>
              🏆 Achievements
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search TLs, SMMs, Assets..."
            className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white outline-none"
          />
        </div>

        {/* TAB 1: COMMAND HIERARCHY */}
        {activeTab === "hierarchy" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                  return (
                    <div
                      key={tl.id}
                      onClick={() => {
                        setSelectedTlId(isSelected ? null : tl.id);
                        setSelectedSmmId(null);
                      }}
                      className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                        isSelected
                          ? "bg-emerald-950/30 border-emerald-400 shadow-lg"
                          : "bg-zinc-950 border-zinc-800 hover:border-emerald-500/50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-white">{tl.full_name}</h3>
                          <p className="text-xs text-zinc-400">🌍 {tl.country}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditEmployee(tl);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-300 text-[11px] font-bold"
                        >
                          ✎ Edit TL
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-zinc-900 flex justify-between text-xs font-mono">
                        <span className="text-blue-300">{tlSmms.length} SMMs • {tlAssets.length} Assets</span>
                        <span className="text-emerald-400 font-bold">{impr.toLocaleString()} Impr</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {activeTl && (
              <div className="bg-zinc-950 border border-blue-500/40 rounded-3xl p-5 sm:p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <h2 className="text-xl font-bold text-white">
                    Commander {activeTl.full_name}&apos;s Squad ({displayedSmms.length} SMMs)
                  </h2>
                  <button
                    onClick={() => openEditEmployee(activeTl)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    ✎ Edit {activeTl.full_name}&apos;s Countries & SMM Squad
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayedSmms.map((smm) => {
                    const smmAssets = filteredAssets.filter((a) => a.smm_id === smm.id);
                    const isSmmSelected = selectedSmmId === smm.id;
                    return (
                      <div
                        key={smm.id}
                        onClick={() => setSelectedSmmId(isSmmSelected ? null : smm.id)}
                        className={`cursor-pointer rounded-2xl p-4 border ${
                          isSmmSelected ? "bg-blue-950/30 border-blue-400" : "bg-black border-zinc-800"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-white">{smm.full_name}</h3>
                            <p className="text-xs text-zinc-400">{smm.country}</p>
                            <p className="text-[10px] text-purple-300 mt-0.5">
                              SM: {(smm.platforms || ["twitter"]).join(", ").toUpperCase()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEmployee(smm);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-blue-300 text-[11px] font-bold"
                          >
                            ✎ Edit SMM
                          </button>
                        </div>
                        <div className="mt-3 text-xs font-mono text-purple-300">
                          {smmAssets.length} Managed Assets (Tap to unfold)
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeSmm && (
                  <div className="pt-4 border-t border-zinc-800 space-y-3">
                    <h3 className="text-base font-bold text-white">
                      Assets Managed by {activeSmm.full_name} (Tap any card for Full Details & Growth)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {displayedSmmAssets.map((asset) => {
                        const isSuspended = asset.status === "suspended";
                        return (
                          <div
                            key={asset.id}
                            onClick={() => setInspectingAsset(asset)}
                            className="cursor-pointer bg-black border border-zinc-800 hover:border-purple-500 rounded-2xl p-4 space-y-2 relative"
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
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              {asset.platform}
                            </span>
                            <h4 className="font-bold text-white truncate pr-20">{asset.account_id}</h4>
                            <p className="text-[11px] text-zinc-400">
                              🌍 {asset.country_language} • 🗣 {asset.language || "English"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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

        {/* TAB 3: PERSONNEL DIRECTORY (EDIT TLs & SMMs WITH FANCY MULTI-SELECTS) */}
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
                <div key={emp.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
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
                    <button
                      onClick={() => openEditEmployee(emp)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold"
                    >
                      ✎ Edit All
                    </button>
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
                    className={`cursor-pointer bg-zinc-950 border rounded-2xl p-5 space-y-3 relative overflow-hidden hover:border-purple-500/60 ${
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
                        onClick={() => setEditingAsset({ ...asset, language: asset.language || "English" })}
                        className="py-2 bg-zinc-900 text-emerald-400 font-bold rounded-xl text-xs"
                      >
                        ✎ Edit Asset
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB 5: ARCHIVE VAULT (ALWAYS POPULATED) */}
        {activeTab === "archive" && (
          <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">🗄 Executive Archive Vault ({auditLogs.length} Records)</h2>
                <p className="text-xs text-zinc-400">
                  Complete immutable ledger of all employees, social media assets, campaigns, and weekly metrics.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[65vh]">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Summary</th>
                    <th className="p-3 text-right">Restore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/50">
                      <td className="p-3 text-zinc-400">{new Date(log.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">{log.actor_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-300 text-[10px]">
                          {log.entity_type} • {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-white">{log.summary}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRestoreArchive(log)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black font-bold text-[10px]"
                        >
                          ♻ Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase text-cyan-400">Global Team Leader Squad Comparison</h3>
            {teamLeaders.map((tl) => {
              const tlSmms = allSmms.filter(
                (s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id))
              );
              const tlAssets = filteredAssets.filter(
                (a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id)
              );
              const tlImpr = metrics
                .filter((m) => tlAssets.some((a) => a.id === m.asset_id))
                .reduce((s, x) => s + Number(x.impressions || 0), 0);
              return (
                <div key={tl.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white font-bold">Commander {tl.full_name} ({tlSmms.length} SMMs)</span>
                    <span className="text-cyan-300">{tlImpr.toLocaleString()} Impr</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full">
                    <div
                      className="h-full bg-cyan-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, (tlImpr / 100000) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
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
          { id: "archive", icon: "🗄", label: "Archive" },
          { id: "graphs", icon: "📈", label: "Graphs" },
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
          onEdit={(a) => setEditingAsset({ ...a, language: a.language || "English" })}
          onToggleStatus={handleSetAssetStatus}
        />
      )}

      {/* ADMIN EDIT TL OR SMM MODAL (WITH FANCY MULTI-SELECT FOR COUNTRIES, PLATFORMS, SQUAD SMMS, TLs & ASSETS) */}
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

            {/* When Admin is editing a Team Leader: edit the SMMs under them */}
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

            {/* When Admin is editing an SMM: edit their Team Leaders AND their Assets */}
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

      {/* ADMIN EDIT ASSET MODAL */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4" onClick={() => setEditingAsset(null)}>
          <form
            onSubmit={handleSaveAsset}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-purple-500/50 rounded-3xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">✎ Edit Asset: {editingAsset.account_id}</h3>
              <button type="button" onClick={() => setEditingAsset(null)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400 rounded-xl">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={editingAsset.platform || "twitter"}
                onChange={(e) => setEditingAsset({ ...editingAsset, platform: e.target.value })}
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={editingAsset.country_language || "Kenya"}
                onChange={(e) => setEditingAsset({ ...editingAsset, country_language: e.target.value })}
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              >
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={editingAsset.language || "English"}
                onChange={(e) => setEditingAsset({ ...editingAsset, language: e.target.value })}
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              >
                {ASSET_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={editingAsset.account_id || ""}
                onChange={(e) => setEditingAsset({ ...editingAsset, account_id: e.target.value })}
                placeholder="Handle"
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              />
              <input
                type="text"
                value={editingAsset.account_password || ""}
                onChange={(e) => setEditingAsset({ ...editingAsset, account_password: e.target.value })}
                placeholder="Password"
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              />
              <select
                value={editingAsset.smm_id || ""}
                onChange={(e) => setEditingAsset({ ...editingAsset, smm_id: e.target.value })}
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              >
                <option value="">Unassigned SMM</option>
                {allSmms.map((s) => (
                  <option key={s.id} value={s.id}>SMM: {s.full_name}</option>
                ))}
              </select>
              <select
                value={editingAsset.team_leader_id || ""}
                onChange={(e) => setEditingAsset({ ...editingAsset, team_leader_id: e.target.value })}
                className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              >
                <option value="">Unassigned TL</option>
                {teamLeaders.map((tl) => (
                  <option key={tl.id} value={tl.id}>TL: {tl.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">
                Save Asset Live
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAsset(editingAsset.id)}
                className="px-4 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs"
              >
                🗑 Delete
              </button>
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
