"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  parseBulkRows,
  aggregateMetricsByHorizon,
  exportHorizonCSV,
  computeAchievements
} from "@/lib/constants";

export default function AdminCommandCenter() {
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [profiles, setProfiles] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Navigation Tabs & Global Filters
  const [activeTab, setActiveTab] = useState<"squads" | "graphs" | "achievements" | "employees" | "assets" | "bulk" | "vault">("squads");
  const [globalSearch, setGlobalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "team_leader" | "smm">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  // Archive Date & Time Filters
  const [archiveStartDate, setArchiveStartDate] = useState("");
  const [archiveEndDate, setArchiveEndDate] = useState("");
  const [archiveAction, setArchiveAction] = useState("ALL");
  const [archiveEntity, setArchiveEntity] = useState("ALL");

  // Drill-down & Slide-Over States
  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [selectedSmmId, setSelectedSmmId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [revealedAssets, setRevealedAssets] = useState<Record<string, boolean>>({});
  const [statusBanner, setStatusBanner] = useState("");

  // Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  const [setAdminName, setSetAdminName] = useState("");
  const [setAdminCountries, setSetAdminCountries] = useState<string[]>([]);
  const [masterNewPass, setMasterNewPass] = useState("");
  const [autoMaskDefault, setAutoMaskDefault] = useState(true);

  // Employee CRUD Modal States
  const [showCreateEmpModal, setShowCreateEmpModal] = useState(false);
  const [empRole, setEmpRole] = useState<"admin" | "team_leader" | "smm">("smm");
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPass, setEmpPass] = useState("");
  const [empCountries, setEmpCountries] = useState<string[]>(["Ethiopia"]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>(["twitter"]);
  const [empTlIds, setEmpTlIds] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  // Asset CRUD Modal States
  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    smm_id: "", team_leader_id: "", platform: "twitter", project_name: "General Campaign",
    profile_link: "", bio: "", account_id: "", account_password: "",
    email: "", email_password: "", two_fa_code: "", country_language: "Ethiopia", phone_number: ""
  });
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingMetric, setEditingMetric] = useState<any>(null);

  // Bulk Data Entry States
  const [bulkMode, setBulkMode] = useState<"assets" | "employees">("assets");
  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultSmm, setBulkDefaultSmm] = useState("");
  const [bulkDefaultTl, setBulkDefaultTl] = useState("");
  const [bulkDefaultPlatform, setBulkDefaultPlatform] = useState("twitter");
  const [bulkDefaultCountry, setBulkDefaultCountry] = useState("Ethiopia");

  useEffect(() => {
    let channel: any;
    verifyAdminSession().then((ok) => {
      if (!ok) return;
      channel = supabase
        .channel("admin-master-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { triggerPulse(); loadAllEnterpriseData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { triggerPulse(); loadAllEnterpriseData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { triggerPulse(); loadAllEnterpriseData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => { triggerPulse(); loadAllEnterpriseData(); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const triggerPulse = () => {
    setLiveSyncPulse(true);
    setTimeout(() => setLiveSyncPulse(false), 1200);
  };

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(""), 4000);
  };

  const verifyAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return false; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      setAuthMsg("Security Violation: Master Admin clearance required.");
      setIsCheckingAuth(false);
      return false;
    }
    setAdminProfile(prof);
    setSetAdminName(prof.full_name || "Master Admin");
    setSetAdminCountries((prof.country || "Ethiopia").split(",").map((c: string) => c.trim()).filter(Boolean));
    setIsCheckingAuth(false);
    await loadAllEnterpriseData();
    return true;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Verifying Master Clearance...");
    await fetch("/api/seed", { method: "POST" });
    const authEmail = normalizeAuthUsername(email.trim(), "admin");
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) return setAuthMsg(error.message);

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      return setAuthMsg("Access Denied: Admin clearance required.");
    }
    setAdminProfile(prof);
    setSetAdminName(prof.full_name || "Master Admin");
    setSetAdminCountries((prof.country || "Ethiopia").split(",").map((c: string) => c.trim()).filter(Boolean));
    await loadAllEnterpriseData();
  };

  const loadAllEnterpriseData = async () => {
    const [pRes, aRes, mRes, logRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("social_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)
    ]);
    const pList = pRes.data || [];
    const aList = aRes.data || [];
    setProfiles(pList);
    setAssets(aList);
    setMetrics(mRes.data || []);
    setAuditLogs(logRes.data || []);

    const tls = pList.filter(x => x.role === "team_leader");
    const smms = pList.filter(x => x.role === "smm");
    if (tls.length > 0 && !bulkDefaultTl) setBulkDefaultTl(tls[0].id);
    if (smms.length > 0 && !bulkDefaultSmm) setBulkDefaultSmm(smms[0].id);
  };

  const handleSaveAdminSettings = async (e: React.FormEvent) => {
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
          full_name: setAdminName,
          country: setAdminCountries.join(", "),
          newPassword: masterNewPass
        }
      })
    });
    setMasterNewPass("");
    setShowSettings(false);
    flashBanner("✓ Executive Settings & Master Profile Synced Live!");
    loadAllEnterpriseData();
  };

  // EMPLOYEE CRUD
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "create",
        payload: {
          role: empRole,
          full_name: empName.trim(),
          email: empEmail.trim(),
          password: empPass,
          country: empCountries.join(", "),
          platforms: empPlatforms,
          team_leader_id: empTlIds[0] || null,
          team_leader_ids: empTlIds
        }
      })
    });
    const data = await res.json();
    if (res.ok) {
      flashBanner(`✓ Created ${empRole.toUpperCase()} Employee: ${empName}`);
      setEmpName(""); setEmpEmail(""); setEmpPass("");
      setShowCreateEmpModal(false);
      loadAllEnterpriseData();
    } else alert(data.error);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "update",
        payload: {
          targetId: editingProfile.id,
          full_name: editingProfile.full_name,
          country: editingProfile.country,
          role: editingProfile.role,
          team_leader_id: editingProfile.team_leader_id,
          is_locked: editingProfile.is_locked,
          newPassword: editingProfile.newPassword
        }
      })
    });
    if (res.ok) {
      flashBanner(`✓ Updated Employee: ${editingProfile.full_name}`);
      setEditingProfile(null);
      loadAllEnterpriseData();
    }
  };

  const handleDeleteEmployee = async (targetId: string, name: string) => {
    if (!confirm(`Permanently delete employee "${name}"? (Snapshot preserved in Archive Vault)`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "delete", payload: { targetId } })
    });
    flashBanner(`🗑 Deleted Employee: ${name} (Archived)`);
    loadAllEnterpriseData();
  };

  // ASSET CRUD
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "create",
        payload: { ...newAsset, status: "active" }
      })
    });
    if (res.ok) {
      flashBanner(`✓ Created Asset [${newAsset.platform.toUpperCase()}] ${newAsset.account_id}`);
      setShowCreateAssetModal(false);
      loadAllEnterpriseData();
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "update", payload: editingAsset })
    });
    flashBanner(`✓ Updated Asset: ${editingAsset.account_id}`);
    setEditingAsset(null);
    loadAllEnterpriseData();
  };

  const handleDeleteAsset = async (assetId: string, handle: string) => {
    if (!confirm(`Delete Asset "${handle}"? (Snapshot preserved in Archive Vault)`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "delete", payload: { id: assetId } })
    });
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    flashBanner(`🗑 Deleted Asset: ${handle} (Archived)`);
    loadAllEnterpriseData();
  };

  // BULK IMPORT
  const handleExecuteBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkText);
    if (rows.length === 0) return alert("Paste at least 1 row of data.");

    if (bulkMode === "assets") {
      const items = rows.map(r => ({
        smm_id: bulkDefaultSmm || null,
        team_leader_id: bulkDefaultTl || null,
        account_id: r[0] || "Pending_Handle",
        account_password: r[1] || "",
        email: r[2] || "",
        email_password: r[3] || "",
        profile_link: r[4] || "",
        bio: r[5] || "",
        two_fa_code: r[6] || "",
        phone_number: r[7] || "",
        country_language: r[8] || bulkDefaultCountry,
        platform: (r[9] || bulkDefaultPlatform).toLowerCase(),
        project_name: r[10] || "General Campaign",
        status: "active"
      }));

      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "bulk_create", payload: { items } })
      });
      const data = await res.json();
      if (res.ok) {
        flashBanner(`⚡ Bulk Imported ${data.count} Social Media Assets Live!`);
        setBulkText("");
        setActiveTab("assets");
        loadAllEnterpriseData();
      } else alert(data.error);
    } else {
      const empRows = rows.map(r => ({
        full_name: r[0] || "Employee",
        email: r[1] || "",
        password: r[2] || "Welcome@2026!",
        role: (r[3] || "smm").toLowerCase(),
        country: r[4] || bulkDefaultCountry,
        team_leader_id: bulkDefaultTl || null
      })).filter(x => x.email.includes("@"));

      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "bulk_create", payload: { rows: empRows } })
      });
      const data = await res.json();
      if (res.ok) {
        flashBanner(`⚡ Bulk Onboarded ${data.createdCount} Employees Live!`);
        setBulkText("");
        setActiveTab("employees");
        loadAllEnterpriseData();
      } else alert(data.error);
    }
  };

  // METRIC CRUD
  const handleAdminUpdateMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetric) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "metric", action: "update", payload: editingMetric })
    });
    setEditingMetric(null);
    loadAllEnterpriseData();
  };

  const handleAdminDeleteMetric = async (metricId: string) => {
    if (!confirm("Delete this weekly metric row?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "metric", action: "delete", payload: { id: metricId } })
    });
    loadAllEnterpriseData();
  };

  const handleGlobalLockAll = async (lockState: boolean) => {
    const smmIds = profiles.filter(p => p.role === "smm").map(p => p.id);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch_lock", payload: { smmIds, is_locked: lockState } })
    });
    flashBanner(`Global Lock ${lockState ? "ENGAGED 🔒" : "RELEASED 🔓"} across all ${smmIds.length} SMMs!`);
  };

  // Quick Archive Date Range Presets
  const applyArchivePreset = (hoursBack: number | null) => {
    if (hoursBack === null) {
      setArchiveStartDate("");
      setArchiveEndDate("");
      return;
    }
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 3600 * 1000);
    setArchiveStartDate(past.toISOString().slice(0, 16));
    setArchiveEndDate(now.toISOString().slice(0, 16));
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse">Connecting Global Executive Realtime Stream...</div>;

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">Tier 1 — Executive Vault</span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Command Center</h1>
            <p className="text-xs text-zinc-500 mt-1">Maximum-Security Global Oversight Terminal</p>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500"></div>
            <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@executive.com or admin@admin" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm">Unlock Executive Vault</button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter(p => p.role === "team_leader");
  const allSmms = profiles.filter(p => p.role === "smm");
  const uniqueProjects = Array.from(new Set(assets.map(a => a.project_name || "General Campaign")));
  const q = globalSearch.toLowerCase().trim();

  // Filtered Lists
  const filteredEmployees = profiles.filter(p => {
    const roleMatch = roleFilter === "all" || p.role === roleFilter;
    const searchMatch = !q || (p.full_name || "").toLowerCase().includes(q) || (p.country || "").toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q);
    return roleMatch && searchMatch;
  });

  const filteredGlobalAssets = assets.filter(a => {
    const platMatch = platformFilter === "all" || a.platform === platformFilter;
    const projMatch = projectFilter === "All" || a.project_name === projectFilter;
    const searchMatch = !q ||
      (a.account_id || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.profile_link || "").toLowerCase().includes(q) ||
      (a.country_language || "").toLowerCase().includes(q) ||
      (a.project_name || "").toLowerCase().includes(q) ||
      (a.phone_number || "").toLowerCase().includes(q);
    return platMatch && projMatch && searchMatch;
  });

  // Archive Logs filtered by Search + Exact Date & Time + Action + Entity
  const filteredAuditLogs = auditLogs.filter(log => {
    if (archiveAction !== "ALL" && log.action !== archiveAction) return false;
    if (archiveEntity !== "ALL" && log.entity_type !== archiveEntity) return false;
    if (archiveStartDate) {
      const logTime = new Date(log.created_at).getTime();
      const startTime = new Date(archiveStartDate).getTime();
      if (logTime < startTime) return false;
    }
    if (archiveEndDate) {
      const logTime = new Date(log.created_at).getTime();
      const endTime = new Date(archiveEndDate).getTime();
      if (logTime > endTime) return false;
    }
    if (!q) return true;
    return (
      (log.summary || "").toLowerCase().includes(q) ||
      (log.actor_name || "").toLowerCase().includes(q) ||
      (log.entity_type || "").toLowerCase().includes(q) ||
      JSON.stringify(log.record_snapshot || {}).toLowerCase().includes(q)
    );
  });

  // Analytics & Achievements Calculations
  const horizonRows = aggregateMetricsByHorizon(metrics, csvHorizon);
  const periodTotalsMap = new Map<string, { impr: number; eng: number; posts: number }>();
  horizonRows.forEach(r => {
    const cur = periodTotalsMap.get(r.period) || { impr: 0, eng: 0, posts: 0 };
    cur.impr += r.impressions;
    cur.eng += r.engagements;
    cur.posts += r.posts_published;
    periodTotalsMap.set(r.period, cur);
  });
  const periodSeries = Array.from(periodTotalsMap.entries()).slice(0, 10);
  const maxPeriodImpr = Math.max(1000, ...periodSeries.map(([, v]) => v.impr));

  const achievements = computeAchievements(assets, metrics);

  const activeTl = teamLeaders.find(t => t.id === selectedTlId);
  const displayedSmms = selectedTlId
    ? allSmms.filter(s => s.team_leader_id === selectedTlId || (s.team_leader_ids && s.team_leader_ids.includes(selectedTlId)))
    : [];

  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeAssetMetrics = selectedAssetId ? metrics.filter(m => m.asset_id === selectedAssetId) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Executive Bar with Multi-Horizon CSV Exporter & Settings */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                Tier 1 — Executive Master CRUD & Analytics
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Global Command Center</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-Horizon CSV Selector (Weekly / Monthly / Quarterly / Yearly) */}
            <div className="flex items-center bg-zinc-950 border border-emerald-500/40 rounded-lg p-1 gap-1">
              <select
                value={csvHorizon}
                onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)}
                className="bg-black text-emerald-300 text-xs font-bold px-2.5 py-1.5 rounded outline-none uppercase"
              >
                <option value="weekly">📅 Weekly CSV</option>
                <option value="monthly">📆 Monthly CSV</option>
                <option value="quarterly">📊 Quarterly CSV</option>
                <option value="yearly">📈 Yearly CSV</option>
              </select>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-black text-zinc-300 text-xs px-2 py-1.5 rounded outline-none"
              >
                <option value="All">All Campaigns</option>
                {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button
                onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics, assets, profiles, projectFilter, scopeLabel: "Executive_Master" })}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-xs transition-all"
              >
                ⬇ Export {csvHorizon.toUpperCase()}
              </button>
            </div>

            <button
              onClick={() => {
                setEmpRole("smm");
                if (teamLeaders.length > 0 && empTlIds.length === 0) setEmpTlIds([teamLeaders[0].id]);
                setShowCreateEmpModal(true);
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs"
            >
              + Employee
            </button>
            <button
              onClick={() => {
                setNewAsset({
                  ...newAsset,
                  team_leader_id: selectedTlId || (teamLeaders[0]?.id ?? ""),
                  smm_id: selectedSmmId || (allSmms[0]?.id ?? "")
                });
                setShowCreateAssetModal(true);
              }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs"
            >
              + Asset
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 text-emerald-400 font-bold rounded-lg text-xs"
            >
              ⚙ Settings
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-pulse">
            {statusBanner}
          </div>
        )}

        {/* 7-Tab Navigation Bar + Instant Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setActiveTab("squads")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "squads" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🛡 Squads ({teamLeaders.length})
            </button>
            <button onClick={() => setActiveTab("graphs")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300 border border-cyan-500/30"}`}>
              📈 Summary Graphs
            </button>
            <button onClick={() => setActiveTab("achievements")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300 border border-yellow-500/30"}`}>
              🏆 Achievements
            </button>
            <button onClick={() => setActiveTab("employees")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "employees" ? "bg-blue-500 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              👥 Employees ({profiles.length})
            </button>
            <button onClick={() => setActiveTab("assets")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
              🗂 Assets ({assets.length})
            </button>
            <button onClick={() => setActiveTab("bulk")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400 border border-amber-500/30"}`}>
              ⚡ Bulk Entry
            </button>
            <button onClick={() => setActiveTab("vault")} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "vault" ? "bg-teal-400 text-black" : "bg-zinc-900 text-teal-300 border border-teal-500/30"}`}>
              📜 Archive Vault ({auditLogs.length})
            </button>
          </div>

          <div className="flex-1 min-w-[220px] max-w-sm relative">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="🔍 Search employee, @Handle, email, country..."
              className="w-full rounded-xl bg-black border border-zinc-700 focus:border-emerald-400 px-3 py-2 text-xs text-white outline-none"
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch("")} className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-white">✕</button>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: SQUADS DRILL-DOWN                                              */}
        {/* ===================================================================== */}
        {activeTab === "squads" && (
          !selectedTlId ? (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <p className="text-xs uppercase tracking-wider font-bold text-zinc-400">
                  Select any Team Leader card to morph into their Squad Workspace in-place
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleGlobalLockAll(true)} className="px-3 py-1 bg-red-500/15 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-black transition-all">
                    🔒 Lock All Agency SMMs
                  </button>
                  <button onClick={() => handleGlobalLockAll(false)} className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-black transition-all">
                    🔓 Unlock All Agency SMMs
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teamLeaders.filter(t => !q || t.full_name.toLowerCase().includes(q) || (t.country || "").toLowerCase().includes(q)).map(tl => {
                  const tlSmms = allSmms.filter(s => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
                  const tlAssets = assets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id));
                  const tlAssetIds = tlAssets.map(a => a.id);
                  const tlLogs = metrics.filter(m => tlAssetIds.includes(m.asset_id));
                  const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);
                  const eng = tlLogs.reduce((sum, x) => sum + (x.engagements || 0), 0);

                  return (
                    <div
                      key={tl.id}
                      onClick={() => { setSelectedTlId(tl.id); setSelectedSmmId(null); setSelectedAssetId(null); }}
                      className="group cursor-pointer rounded-2xl p-6 bg-zinc-950 border border-zinc-800 hover:border-emerald-500 hover:-translate-y-1 transition-all duration-200"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl text-white group-hover:text-emerald-300">{tl.full_name}</h3>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {tlSmms.length} SMMs • {tlAssets.length} Assets
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 truncate">Countries: {tl.country}</p>

                      <div className="mt-5 space-y-2.5">
                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="text-zinc-400">Impressions</span>
                            <span className="text-blue-400 font-bold">{impr.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.min(100, Math.max(6, (impr / 100000) * 100))}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="text-zinc-400">Engagements</span>
                            <span className="text-purple-400 font-bold">{eng.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.min(100, Math.max(6, (eng / 10000) * 100))}%` }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-zinc-900 flex justify-between items-center text-xs">
                        <div className="space-x-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingProfile({ ...tl })} className="text-emerald-400 hover:underline font-bold">✎ Edit TL</button>
                          <button onClick={() => handleDeleteEmployee(tl.id, tl.full_name)} className="text-red-400 hover:underline font-bold">🗑 Delete</button>
                        </div>
                        <span className="text-zinc-400 group-hover:text-emerald-300 font-bold">Open Squad →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            activeTl && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                  <button
                    onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black font-bold text-xs transition-all"
                  >
                    ← All Team Leaders
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {teamLeaders.map(tl => (
                      <button
                        key={tl.id}
                        onClick={() => { setSelectedTlId(tl.id); setSelectedSmmId(null); setSelectedAssetId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedTlId === tl.id ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
                      >
                        {tl.full_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {displayedSmms.map(smm => {
                    const isSmmOpen = selectedSmmId === smm.id;
                    const smmAssets = assets.filter(a => a.smm_id === smm.id);
                    const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
                    const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
                    const totalEng = smmLogs.reduce((s, x) => s + (x.engagements || 0), 0);

                    return (
                      <div key={smm.id} className={`rounded-2xl border transition-all ${isSmmOpen ? "bg-zinc-950 border-blue-500" : "bg-zinc-950/80 border-zinc-800"}`}>
                        <div onClick={() => setSelectedSmmId(isSmmOpen ? null : smm.id)} className="cursor-pointer p-5 flex flex-wrap justify-between items-center gap-4">
                          <div>
                            <h4 className="font-bold text-lg text-white">{smm.full_name}</h4>
                            <p className="text-xs text-zinc-400">Countries: {smm.country} • Status: {smm.is_locked ? "🔒 Locked" : "🔓 Open"}</p>
                          </div>
                          <div className="flex items-center gap-5 font-mono text-xs">
                            <div><span className="text-zinc-500 block text-[10px]">ASSETS</span><span className="text-purple-400 font-bold text-sm">{smmAssets.length}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">IMPR</span><span className="text-blue-400 font-bold text-sm">{totalImpr.toLocaleString()}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">ENG</span><span className="text-purple-400 font-bold text-sm">{totalEng.toLocaleString()}</span></div>
                            <div className="space-x-2 font-sans" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => setEditingProfile({ ...smm })} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">✎ Edit</button>
                              <button onClick={() => handleDeleteEmployee(smm.id, smm.full_name)} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold">🗑 Delete</button>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 font-sans font-bold">
                              {isSmmOpen ? "Hide ▲" : `Assets (${smmAssets.length}) ▼`}
                            </span>
                          </div>
                        </div>

                        {isSmmOpen && (
                          <div className="p-5 pt-0 border-t border-zinc-800/80 bg-black/50 rounded-b-2xl">
                            <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                              {smmAssets.map(asset => (
                                <div key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className="cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-purple-500 p-4 rounded-xl space-y-2 transition-all">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">ASSET: {asset.platform}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{asset.status.toUpperCase()}</span>
                                  </div>
                                  <h5 className="font-bold text-white text-base">{asset.account_id}</h5>
                                  <p className="text-xs text-zinc-500 truncate">{asset.profile_link || "Pending URL"}</p>
                                  <div className="pt-2 flex justify-between items-center text-[11px]" onClick={(e) => e.stopPropagation()}>
                                    <div className="space-x-2">
                                      <button onClick={() => setEditingAsset({ ...asset })} className="text-emerald-400 hover:underline font-bold">✎ Edit</button>
                                      <button onClick={() => handleDeleteAsset(asset.id, asset.account_id)} className="text-red-400 hover:underline font-bold">🗑 Delete</button>
                                    </div>
                                    <button onClick={() => setSelectedAssetId(asset.id)} className="text-purple-400 font-bold">Inspect Vault →</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )
        )}

        {/* ===================================================================== */}
        {/* TAB 2: SUMMARY GRAPHS & VISUAL ANALYTICS (WEEKLY/MONTHLY/QUARTERLY/Y) */}
        {/* ===================================================================== */}
        {activeTab === "graphs" && (
          <div className="space-y-6">
            {/* Horizon Switcher Bar */}
            <div className="flex flex-wrap justify-between items-center bg-zinc-950 border border-cyan-500/30 p-4 rounded-2xl gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400">Enterprise Visual Intelligence</span>
                <h2 className="text-xl font-bold text-white">Executive Summary Graphs ({csvHorizon.toUpperCase()} View)</h2>
              </div>
              <div className="flex gap-2">
                {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map(h => (
                  <button
                    key={h}
                    onClick={() => setCsvHorizon(h)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${csvHorizon === h ? "bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]" : "bg-black border border-zinc-800 text-zinc-400 hover:text-white"}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Graph 1: Time-Horizon Trend Bar Chart */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold uppercase text-cyan-400">1. {csvHorizon.toUpperCase()} Impressions & Engagement Trajectory</h3>
                <div className="space-y-3">
                  {periodSeries.map(([period, val]) => {
                    const w = Math.min(100, Math.max(6, Math.round((val.impr / maxPeriodImpr) * 100)));
                    return (
                      <div key={period} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="font-bold text-white">{period}</span>
                          <span className="text-cyan-300">{val.impr.toLocaleString()} Impr • <span className="text-purple-400">{val.eng.toLocaleString()} Eng</span> • {val.posts} Posts</span>
                        </div>
                        <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-700" style={{ width: `${w}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                  {periodSeries.length === 0 && <div className="text-xs text-zinc-500 py-8 text-center">No metrics logged yet.</div>}
                </div>
              </div>

              {/* Graph 2: Platform Share Breakdown */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold uppercase text-purple-400">2. Platform Performance & Asset Distribution</h3>
                <div className="space-y-3">
                  {PLATFORMS.map(plat => {
                    const platAssets = assets.filter(a => a.platform === plat);
                    const platLogs = metrics.filter(m => platAssets.some(a => a.id === m.asset_id));
                    const pImpr = platLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
                    const pEng = platLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
                    const totalAllImpr = Math.max(1, metrics.reduce((s, x) => s + Number(x.impressions || 0), 0));
                    const pct = Math.round((pImpr / totalAllImpr) * 100);
                    return (
                      <div key={plat} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="uppercase font-bold text-white">{plat} ({platAssets.length} Assets)</span>
                          <span className="text-purple-300">{pImpr.toLocaleString()} Impr ({pct}%) • {pEng.toLocaleString()} Eng</span>
                        </div>
                        <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: ACHIEVEMENTS, MILESTONES & LEADERBOARDS                        */}
        {/* ===================================================================== */}
        {activeTab === "achievements" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {achievements.map(ach => (
                <div key={ach.id} className={`rounded-2xl p-5 border transition-all ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60 shadow-[0_0_25px_rgba(234,179,8,0.2)]" : "bg-zinc-950 border-zinc-800 opacity-75"}`}>
                  <div className="flex justify-between items-start">
                    <span className="text-3xl">{ach.icon}</span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${ach.unlocked ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-500"}`}>
                      {ach.unlocked ? "✓ UNLOCKED" : `${ach.progress}% PROGRESS`}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{ach.desc}</p>
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-yellow-300">
                      <span>Milestone Status</span>
                      <span>{ach.stat}</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 transition-all duration-700" style={{ width: `${ach.progress}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Squads & Top SMMs Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-bold uppercase text-yellow-400">🏆 Top Squad Commanders Leaderboard</h3>
                <div className="divide-y divide-zinc-800 text-xs font-mono">
                  {teamLeaders
                    .map(tl => {
                      const tlSmms = allSmms.filter(s => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
                      const tlAssets = assets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id));
                      const impr = metrics.filter(m => tlAssets.some(a => a.id === m.asset_id)).reduce((s, x) => s + Number(x.impressions || 0), 0);
                      return { ...tl, impr, assetCount: tlAssets.length };
                    })
                    .sort((a, b) => b.impr - a.impr)
                    .map((tl, idx) => (
                      <div key={tl.id} className="py-3 flex justify-between items-center">
                        <div>
                          <span className="text-yellow-400 font-bold mr-2">#{idx + 1}</span>
                          <span className="text-white font-bold font-sans">{tl.full_name}</span>
                          <span className="text-zinc-500 ml-2">({tl.assetCount} Assets)</span>
                        </div>
                        <span className="text-emerald-400 font-bold">{tl.impr.toLocaleString()} Impr</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-bold uppercase text-purple-400">🌟 Top SMM Handlers Leaderboard</h3>
                <div className="divide-y divide-zinc-800 text-xs font-mono">
                  {allSmms
                    .map(smm => {
                      const smmAssets = assets.filter(a => a.smm_id === smm.id);
                      const impr = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id)).reduce((s, x) => s + Number(x.impressions || 0), 0);
                      return { ...smm, impr, assetCount: smmAssets.length };
                    })
                    .sort((a, b) => b.impr - a.impr)
                    .slice(0, 10)
                    .map((smm, idx) => (
                      <div key={smm.id} className="py-3 flex justify-between items-center">
                        <div>
                          <span className="text-purple-400 font-bold mr-2">#{idx + 1}</span>
                          <span className="text-white font-bold font-sans">{smm.full_name}</span>
                          <span className="text-zinc-500 ml-2">({smm.assetCount} Assets)</span>
                        </div>
                        <span className="text-blue-400 font-bold">{smm.impr.toLocaleString()} Impr</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: EMPLOYEES CRUD TABLE                                           */}
        {/* ===================================================================== */}
        {activeTab === "employees" && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-bold text-white">Global Employees Directory — Full CRUD</h2>
              <div className="flex flex-wrap gap-2">
                {(["all", "admin", "team_leader", "smm"] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${roleFilter === r ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                    {r === "all" ? `All (${profiles.length})` : r.replace("_", " ")}
                  </button>
                ))}
                <button onClick={() => setShowCreateEmpModal(true)} className="px-4 py-1.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">
                  + Create Employee
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3.5">Full Name</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Operational Countries</th>
                    <th className="p-3.5">Assigned Team Leader</th>
                    <th className="p-3.5">Assets</th>
                    <th className="p-3.5">Input Status</th>
                    <th className="p-3.5 text-right">CRUD Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-black">
                  {filteredEmployees.map(emp => {
                    const tl = teamLeaders.find(t => t.id === emp.team_leader_id);
                    const empAssetCount = assets.filter(a => a.smm_id === emp.id || a.team_leader_id === emp.id).length;
                    return (
                      <tr key={emp.id} className="hover:bg-zinc-900/50">
                        <td className="p-3.5 font-bold text-white">{emp.full_name}</td>
                        <td className="p-3.5 uppercase text-[10px] font-bold">{emp.role}</td>
                        <td className="p-3.5 text-zinc-300 max-w-xs truncate">{emp.country}</td>
                        <td className="p-3.5 text-blue-400">{emp.role === "smm" ? (tl?.full_name || "Unassigned") : "—"}</td>
                        <td className="p-3.5 font-mono font-bold text-purple-400">{empAssetCount}</td>
                        <td className="p-3.5">{emp.role === "smm" ? (emp.is_locked ? "🔒 LOCKED" : "🔓 OPEN") : "—"}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button onClick={() => setEditingProfile({ ...emp })} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">✎ Edit</button>
                          {emp.id !== adminProfile.id && (
                            <button onClick={() => handleDeleteEmployee(emp.id, emp.full_name)} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold">🗑 Delete</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: GLOBAL ASSETS CRUD TABLE                                       */}
        {/* ===================================================================== */}
        {activeTab === "assets" && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-bold text-white">Global Social Media Assets Vault — Full CRUD ({filteredGlobalAssets.length})</h2>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setPlatformFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${platformFilter === "all" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                  All ({assets.length})
                </button>
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setPlatformFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${platformFilter === p ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Platform</th>
                    <th className="p-3">Asset ID (@Handle)</th>
                    <th className="p-3">SMM / TL</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">Credentials</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">CRUD Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-black font-mono">
                  {filteredGlobalAssets.map(asset => {
                    const smm = profiles.find(p => p.id === asset.smm_id);
                    const tl = profiles.find(p => p.id === asset.team_leader_id);
                    const isRev = !autoMaskDefault || !!revealedAssets[asset.id];
                    return (
                      <tr key={asset.id} className="hover:bg-zinc-900/50">
                        <td className="p-3 font-sans"><span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase text-[10px]">{asset.platform}</span></td>
                        <td className="p-3 font-bold text-white">{asset.account_id}</td>
                        <td className="p-3 font-sans">
                          <div className="text-white font-bold">{smm?.full_name || "Unassigned"}</div>
                          <div className="text-[10px] text-blue-400">TL: {tl?.full_name || "N/A"}</div>
                        </td>
                        <td className="p-3 font-sans text-emerald-300">{asset.country_language || "N/A"}</td>
                        <td className="p-3 text-[11px]">
                          <div>Pass: <span className={isRev ? "text-emerald-400" : "blur-[4px] select-none"}>{asset.account_password || "N/A"}</span></div>
                          <div>Email: {asset.email || "N/A"} (<span className={isRev ? "text-emerald-400" : "blur-[4px] select-none"}>{asset.email_password || "N/A"}</span>)</div>
                        </td>
                        <td className="p-3 font-sans uppercase text-[10px] font-bold">{asset.status}</td>
                        <td className="p-3 text-right space-x-1.5 font-sans">
                          <button onClick={() => setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px]">
                            {isRev ? "🙈" : "👁"}
                          </button>
                          <button onClick={() => setSelectedAssetId(asset.id)} className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-[11px]">
                            Logs
                          </button>
                          <button onClick={() => setEditingAsset({ ...asset })} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold text-[11px]">
                            ✎ Edit
                          </button>
                          <button onClick={() => handleDeleteAsset(asset.id, asset.account_id)} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold text-[11px]">
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 6: BULK DATA ENTRY ENGINE                                         */}
        {/* ===================================================================== */}
        {activeTab === "bulk" && (
          <form onSubmit={handleExecuteBulkImport} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">⚡ Bulk Data Entry Terminal (Excel / Google Sheets / CSV Paste)</h2>
              <div className="flex gap-2 bg-black p-1 rounded-xl border border-zinc-800">
                <button type="button" onClick={() => setBulkMode("assets")} className={`px-4 py-2 rounded-lg text-xs font-bold ${bulkMode === "assets" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
                  1. Bulk Import Assets
                </button>
                <button type="button" onClick={() => setBulkMode("employees")} className={`px-4 py-2 rounded-lg text-xs font-bold ${bulkMode === "employees" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
                  2. Bulk Onboard Employees
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              required
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={bulkMode === "assets" ? "Asset_ID, Asset_Password, Email, Email_Password, Profile_Link, Bio, 2FA_Code, Phone, Country, Platform, Project" : "Full_Name, Email, Password, Role (admin/team_leader/smm), Country"}
              className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white outline-none"
            />
            <button type="submit" className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl text-sm">
              ⚡ Execute Bulk Import ({parseBulkRows(bulkText).length} Rows Detected)
            </button>
          </form>
        )}

        {/* ===================================================================== */}
        {/* TAB 7: PERMANENT ARCHIVE & AUDIT VAULT WITH DATE + TIME FILTER        */}
        {/* ===================================================================== */}
        {activeTab === "vault" && (
          <div className="bg-zinc-950 border border-teal-500/40 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">📜 Permanent Archive & Audit Vault ({filteredAuditLogs.length} Records)</h2>
                <p className="text-xs text-zinc-400">Filter by exact Date & Time down to the minute, Action Type, or Entity Snapshot</p>
              </div>
              {/* Quick Time Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => applyArchivePreset(1)} className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-teal-500 hover:text-black text-xs font-bold text-teal-300 border border-teal-500/30">Last 1 Hour</button>
                <button type="button" onClick={() => applyArchivePreset(24)} className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-teal-500 hover:text-black text-xs font-bold text-teal-300 border border-teal-500/30">Last 24 Hours</button>
                <button type="button" onClick={() => applyArchivePreset(24 * 7)} className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-teal-500 hover:text-black text-xs font-bold text-teal-300 border border-teal-500/30">Last 7 Days</button>
                <button type="button" onClick={() => applyArchivePreset(24 * 30)} className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-teal-500 hover:text-black text-xs font-bold text-teal-300 border border-teal-500/30">Last 30 Days</button>
                <button type="button" onClick={() => applyArchivePreset(null)} className="px-2.5 py-1 rounded bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white">Reset Dates</button>
              </div>
            </div>

            {/* Date & Time Range Pickers + Action & Entity Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-black p-4 rounded-xl border border-zinc-800">
              <div>
                <label className="text-[10px] uppercase font-bold text-teal-400">From Date & Time</label>
                <input
                  type="datetime-local"
                  value={archiveStartDate}
                  onChange={(e) => setArchiveStartDate(e.target.value)}
                  className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-teal-400">To Date & Time</label>
                <input
                  type="datetime-local"
                  value={archiveEndDate}
                  onChange={(e) => setArchiveEndDate(e.target.value)}
                  className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Filter Action</label>
                <select value={archiveAction} onChange={(e) => setArchiveAction(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white">
                  <option value="ALL">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="BULK_CREATE">BULK_CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="UPSERT">UPSERT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Filter Entity</label>
                <select value={archiveEntity} onChange={(e) => setArchiveEntity(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white">
                  <option value="ALL">All Entities</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="ASSET">ASSET</option>
                  <option value="METRIC">METRIC</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredAuditLogs.map(log => (
                <div key={log.id} className="p-4 rounded-xl bg-black border border-zinc-800 hover:border-teal-500/40 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold text-[10px] uppercase">{log.action} • {log.entity_type}</span>
                      <span className="font-bold text-white">{log.summary}</span>
                    </div>
                    <span className="text-[11px] font-mono text-teal-300">
                      🕒 {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()} • By {log.actor_name} ({log.actor_role})
                    </span>
                  </div>
                  <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-900 text-[11px] font-mono text-zinc-400 overflow-x-auto">
                    {JSON.stringify(log.record_snapshot, null, 2)}
                  </pre>
                </div>
              ))}
              {filteredAuditLogs.length === 0 && <div className="text-center py-12 text-zinc-500 text-xs">No archive records match your selected Date & Time window.</div>}
            </div>
          </div>
        )}

      </div>

      {/* ======================================================================= */}
      {/* SLIDE-OVER EXECUTIVE SETTINGS DRAWER                                    */}
      {/* ======================================================================= */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveAdminSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Tier 1 — Master Configuration</span>
                <h2 className="text-xl font-bold text-white">Executive Vault Settings</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-zinc-900 text-xs text-zinc-400">✕ Close</button>
            </div>

            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <div className="text-xs font-bold uppercase text-emerald-400">Global Agency Input Lock</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleGlobalLockAll(true)} className="py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 font-bold rounded-lg text-xs">🔒 Lock All SMMs</button>
                <button type="button" onClick={() => handleGlobalLockAll(false)} className="py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold rounded-lg text-xs">🔓 Unlock All SMMs</button>
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-black border border-zinc-800 rounded-xl">
              <span className="text-xs font-bold text-zinc-300">Auto-Mask Asset Passwords by Default</span>
              <button type="button" onClick={() => setAutoMaskDefault(!autoMaskDefault)} className={`px-3 py-1 rounded text-xs font-bold ${autoMaskDefault ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                {autoMaskDefault ? "MASKED" : "REVEALED"}
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Master Admin Display Name</label>
              <input type="text" required value={setAdminName} onChange={(e) => setSetAdminName(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Operational Countries ({setAdminCountries.length})</label>
              <div className="grid grid-cols-4 gap-1.5 mt-1 max-h-40 overflow-y-auto p-1 bg-black rounded-xl border border-zinc-900">
                {ALL_COUNTRIES.map(c => (
                  <button type="button" key={c} onClick={() => setSetAdminCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1 px-2 rounded text-[11px] font-bold border truncate ${setAdminCountries.includes(c) ? "bg-emerald-500/25 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Update Master Admin Password (Optional)</label>
              <input type="password" value={masterNewPass} onChange={(e) => setMasterNewPass(e.target.value)} placeholder="Leave blank to keep current password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>

            <button type="submit" className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">
              Save & Sync Executive Settings
            </button>
          </form>
        </div>
      )}

      {/* MODAL: CREATE EMPLOYEE */}
      {showCreateEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreateEmpModal(false)}>
          <form onSubmit={handleCreateEmployee} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-zinc-950 border border-blue-500/40 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Create New Employee (Admin / Team Leader / SMM)</h3>
              <button type="button" onClick={() => setShowCreateEmpModal(false)} className="text-xs text-zinc-400">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 bg-black rounded-xl border border-zinc-800">
              {(["smm", "team_leader", "admin"] as const).map(r => (
                <button type="button" key={r} onClick={() => setEmpRole(r)} className={`py-2 rounded-lg text-xs font-bold uppercase ${empRole === r ? "bg-blue-600 text-white" : "text-zinc-400"}`}>
                  {r.replace("_", " ")}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" required value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Full Name" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="text" required value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} placeholder="name@smm or name@tl" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="text" required value={empPass} onChange={(e) => setEmpPass(e.target.value)} placeholder="Initial Password" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>
            {empRole === "smm" && (
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Assign Team Leader(s)</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {teamLeaders.map(tl => (
                    <button type="button" key={tl.id} onClick={() => setEmpTlIds(prev => prev.includes(tl.id) ? prev.filter(x => x !== tl.id) : [...prev, tl.id])} className={`py-1.5 px-2 rounded text-xs font-bold border truncate ${empTlIds.includes(tl.id) ? "bg-blue-500/25 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                      ✓ {tl.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Select Operational Countries ({empCountries.length})</label>
              <div className="grid grid-cols-4 gap-1.5 mt-1 max-h-40 overflow-y-auto p-1 bg-black rounded-xl border border-zinc-900">
                {ALL_COUNTRIES.map(c => (
                  <button type="button" key={c} onClick={() => setEmpCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1 px-2 rounded text-[11px] font-bold border truncate ${empCountries.includes(c) ? "bg-emerald-500/25 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">
              Create & Provision {empRole.toUpperCase()} Account Live
            </button>
          </form>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingProfile(null)}>
          <form onSubmit={handleUpdateEmployee} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Employee Profile</h3>
            <input type="text" required value={editingProfile.full_name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <input type="text" required value={editingProfile.country || ""} onChange={(e) => setEditingProfile({ ...editingProfile, country: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <div className="grid grid-cols-2 gap-3">
              <select value={editingProfile.role} onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })} className="rounded bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">
                <option value="smm">SMM Handler</option>
                <option value="team_leader">Team Leader</option>
                <option value="admin">Master Admin</option>
              </select>
              {editingProfile.role === "smm" && (
                <select value={editingProfile.team_leader_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, team_leader_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                </select>
              )}
            </div>
            <input type="text" value={editingProfile.newPassword || ""} onChange={(e) => setEditingProfile({ ...editingProfile, newPassword: e.target.value })} placeholder="Reset Password (Optional)" className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Employee Changes</button>
          </form>
        </div>
      )}

      {/* MODAL: CREATE SINGLE ASSET */}
      {showCreateAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreateAssetModal(false)}>
          <form onSubmit={handleCreateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-purple-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create & Assign New Social Media Asset</h3>
            <div className="grid grid-cols-3 gap-2">
              <select value={newAsset.team_leader_id} onChange={(e) => setNewAsset({ ...newAsset, team_leader_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>TL: {tl.full_name}</option>)}
              </select>
              <select value={newAsset.smm_id} onChange={(e) => setNewAsset({ ...newAsset, smm_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {allSmms.map(s => <option key={s.id} value={s.id}>SMM: {s.full_name}</option>)}
              </select>
              <select value={newAsset.platform} onChange={(e) => setNewAsset({ ...newAsset, platform: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <input type="url" placeholder="1. Asset Profile Link" value={newAsset.profile_link} onChange={(e) => setNewAsset({ ...newAsset, profile_link: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            <input type="text" placeholder="2. Asset Bio" value={newAsset.bio} onChange={(e) => setNewAsset({ ...newAsset, bio: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" required placeholder="3. Asset ID (@Handle)" value={newAsset.account_id} onChange={(e) => setNewAsset({ ...newAsset, account_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="4. Asset Password" value={newAsset.account_password} onChange={(e) => setNewAsset({ ...newAsset, account_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="email" placeholder="5. Asset Email" value={newAsset.email} onChange={(e) => setNewAsset({ ...newAsset, email: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="6. Email Password" value={newAsset.email_password} onChange={(e) => setNewAsset({ ...newAsset, email_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" placeholder="7. 2FA Code" value={newAsset.two_fa_code} onChange={(e) => setNewAsset({ ...newAsset, two_fa_code: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <select value={newAsset.country_language} onChange={(e) => setNewAsset({ ...newAsset, country_language: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="9. Phone Number" value={newAsset.phone_number} onChange={(e) => setNewAsset({ ...newAsset, phone_number: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-purple-600 text-white font-bold rounded-lg text-xs">Save & Create Asset Live</button>
          </form>
        </div>
      )}

      {/* MODAL: EDIT ASSET */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingAsset(null)}>
          <form onSubmit={handleUpdateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit / Reassign Social Asset</h3>
            <div className="grid grid-cols-3 gap-2">
              <select value={editingAsset.team_leader_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, team_leader_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>TL: {tl.full_name}</option>)}
              </select>
              <select value={editingAsset.smm_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, smm_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {allSmms.map(s => <option key={s.id} value={s.id}>SMM: {s.full_name}</option>)}
              </select>
              <select value={editingAsset.status} onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                <option value="active">ACTIVE</option>
                <option value="suspended">SUSPENDED</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Asset ID" value={editingAsset.account_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Asset Password" value={editingAsset.account_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="email" placeholder="Email" value={editingAsset.email || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Email Pass" value={editingAsset.email_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Asset Changes</button>
          </form>
        </div>
      )}

      {/* SLIDE-OVER RIGHT INSPECTOR FOR SELECTED ASSET */}
      {activeAsset && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setSelectedAssetId(null)}>
          <div className="w-full max-w-2xl bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-purple-500/20 text-purple-300">ASSET VAULT: {activeAsset.platform}</span>
                <h3 className="text-2xl font-bold text-white mt-2">{activeAsset.account_id}</h3>
              </div>
              <button onClick={() => setSelectedAssetId(null)} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">✕ Close</button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase text-emerald-400">Weekly Metrics History (Edit / Delete)</h4>
              {editingMetric && (
                <form onSubmit={handleAdminUpdateMetric} className="grid grid-cols-4 gap-2 bg-black p-3 rounded-xl border border-emerald-500/40 text-xs">
                  <input type="number" value={editingMetric.impressions} onChange={(e) => setEditingMetric({ ...editingMetric, impressions: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <input type="number" value={editingMetric.engagements} onChange={(e) => setEditingMetric({ ...editingMetric, engagements: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <input type="number" value={editingMetric.total_followers} onChange={(e) => setEditingMetric({ ...editingMetric, total_followers: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <button type="submit" className="bg-emerald-500 text-black font-bold rounded">Save</button>
                </form>
              )}
              <table className="w-full text-left text-xs text-zinc-300 font-mono border border-zinc-800 rounded-xl overflow-hidden">
                <thead className="bg-zinc-900 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Week</th>
                    <th className="p-3">Impr</th>
                    <th className="p-3">Eng</th>
                    <th className="p-3">Fol.</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-black">
                  {activeAssetMetrics.map(m => (
                    <tr key={m.id}>
                      <td className="p-3 text-white">{m.week_of}</td>
                      <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                      <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                      <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                      <td className="p-3 text-right space-x-2 font-sans">
                        <button onClick={() => setEditingMetric({ ...m })} className="text-emerald-400 hover:underline">Edit</button>
                        <button onClick={() => handleAdminDeleteMetric(m.id)} className="text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
