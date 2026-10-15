"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  toLocalDatetimeInput,
  normalizeAuthUsername,
  fetchAllRows,
  computeLive2FACode,
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

  const [activeTab, setActiveTab] = useState<"squads" | "compliance" | "graphs" | "achievements" | "employees" | "assets" | "bulk" | "vault">("squads");
  const [globalSearch, setGlobalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "team_leader" | "smm">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  const [archiveStartDate, setArchiveStartDate] = useState("");
  const [archiveEndDate, setArchiveEndDate] = useState("");
  const [archiveAction, setArchiveAction] = useState("ALL");
  const [archiveEntity, setArchiveEntity] = useState("ALL");

  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [selectedSmmId, setSelectedSmmId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [revealedAssets, setRevealedAssets] = useState<Record<string, boolean>>({});
  const [statusBanner, setStatusBanner] = useState("");
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpSeconds, setTotpSeconds] = useState<number>(30);

  const [showSettings, setShowSettings] = useState(false);
  const [setAdminName, setSetAdminName] = useState("");
  const [setAdminCountries, setSetAdminCountries] = useState<string[]>([]);
  const [masterNewPass, setMasterNewPass] = useState("");
  const [autoMaskDefault, setAutoMaskDefault] = useState(true);

  const [showCreateEmpModal, setShowCreateEmpModal] = useState(false);
  const [empRole, setEmpRole] = useState<"admin" | "team_leader" | "smm">("smm");
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPass, setEmpPass] = useState("");
  const [empCountries, setEmpCountries] = useState<string[]>(["Ethiopia"]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>(["twitter"]);
  const [empTlIds, setEmpTlIds] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    smm_id: "", team_leader_id: "", platform: "twitter", project_name: "General Campaign",
    profile_link: "", bio: "", account_id: "", account_password: "",
    email: "", email_password: "", two_fa_code: "", country_language: "Ethiopia", phone_number: ""
  });
  const [editingAsset, setEditingAsset] = useState<any>(null);

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

  useEffect(() => {
    const updateCodes = async () => {
      setTotpSeconds(30 - (Math.floor(Date.now() / 1000) % 30));
      const map: Record<string, string> = {};
      for (const a of assets.slice(0, 150)) {
        if (a.two_fa_code) map[a.id] = await computeLive2FACode(a.two_fa_code);
      }
      setTotpCodes(map);
    };
    updateCodes();
    const t = setInterval(updateCodes, 5000);
    return () => clearInterval(t);
  }, [assets]);

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
    await loadAllEnterpriseData();
  };

  const loadAllEnterpriseData = async () => {
    const [pList, aList, mList, logList] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
      fetchAllRows(supabase, "audit_logs", "created_at", undefined, undefined, 2000)
    ]);
    setProfiles(pList);
    setAssets(aList);
    setMetrics(mList);
    setAuditLogs(logList);

    const tls = pList.filter(x => x.role === "team_leader");
    const smms = pList.filter(x => x.role === "smm");
    if (tls.length > 0 && !bulkDefaultTl) setBulkDefaultTl(tls[0].id);
    if (smms.length > 0 && !bulkDefaultSmm) setBulkDefaultSmm(smms[0].id);
  };

  const handleRestoreArchivedRecord = async (logId: string) => {
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "audit", action: "restore", payload: { logId } })
    });
    const data = await res.json();
    if (res.ok) {
      flashBanner("♻ Record Restored from Archive Vault back into Live Database!");
      loadAllEnterpriseData();
    } else alert(data.error);
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "update", payload: { id: asset.id, status: newStatus } })
    });
    flashBanner(`Asset [${asset.platform.toUpperCase()}] ${asset.account_id} marked ${newStatus.toUpperCase()}`);
    loadAllEnterpriseData();
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
    flashBanner("✓ Executive Settings Synced Live!");
    loadAllEnterpriseData();
  };

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
    await fetch("/api/crud", {
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
    flashBanner(`✓ Updated Employee: ${editingProfile.full_name}`);
    setEditingProfile(null);
    loadAllEnterpriseData();
  };

  const handleDeleteEmployee = async (targetId: string, name: string) => {
    if (!confirm(`Delete employee "${name}"? (Snapshot preserved in Archive Vault)`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "delete", payload: { targetId } })
    });
    flashBanner(`🗑 Deleted Employee: ${name}`);
    loadAllEnterpriseData();
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "create", payload: { ...newAsset, status: "active" } })
    });
    flashBanner(`✓ Created Asset [${newAsset.platform.toUpperCase()}] ${newAsset.account_id}`);
    setShowCreateAssetModal(false);
    loadAllEnterpriseData();
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
    if (!confirm(`Delete Asset "${handle}"? (Restorable from Archive Vault)`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "delete", payload: { id: assetId } })
    });
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    flashBanner(`🗑 Deleted Asset: ${handle}`);
    loadAllEnterpriseData();
  };

  const handleExecuteBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkText);
    if (rows.length === 0) return alert("Paste at least 1 row.");

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
        flashBanner(`⚡ Bulk Imported ${data.count} Assets Live!`);
        setBulkText("");
        setActiveTab("assets");
        loadAllEnterpriseData();
      }
    } else {
      const empRows = rows.map(r => ({
        full_name: r[0] || "Employee",
        email: r[1] || "",
        password: r[2] || "Welcome@2026!",
        role: (r[3] || "smm").toLowerCase(),
        country: r[4] || bulkDefaultCountry,
        team_leader_id: bulkDefaultTl || null
      })).filter(x => Boolean(x.email));
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
      }
    }
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

  const applyArchivePreset = (hoursBack: number | null) => {
    if (hoursBack === null) {
      setArchiveStartDate("");
      setArchiveEndDate("");
      return;
    }
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 3600 * 1000);
    setArchiveStartDate(toLocalDatetimeInput(past));
    setArchiveEndDate(toLocalDatetimeInput(now));
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse px-4 text-center">Connecting Global Executive Stream (5,000+ Asset Capacity)...</div>;

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-6 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">Tier 1 — Executive Vault</span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Command Center</h1>
          </div>
          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 rounded-3xl sm:rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xl">
            <input type="text" autoCapitalize="none" autoCorrect="off" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@executive.com or admin@admin" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none font-mono" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Master Passcode" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white outline-none" />
            {authMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold py-3.5 rounded-xl text-sm">Unlock Executive Vault</button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400 py-2 inline-block">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter(p => p.role === "team_leader");
  const allSmms = profiles.filter(p => p.role === "smm");
  const suspendedAssets = assets.filter(a => a.status === "suspended");
  const activeAssets = assets.filter(a => a.status === "active");
  const uniqueProjects = Array.from(new Set(assets.map(a => a.project_name || "General Campaign")));
  const q = globalSearch.toLowerCase().trim();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split("T")[0];
  const recentAssetIds = new Set(metrics.filter(m => m.week_of >= sevenDaysAgo).map(m => m.asset_id));
  const missingReportAssets = activeAssets.filter(a => !recentAssetIds.has(a.id));

  const filteredEmployees = profiles.filter(p => {
    const roleMatch = roleFilter === "all" || p.role === roleFilter;
    const searchMatch = !q || (p.full_name || "").toLowerCase().includes(q) || (p.country || "").toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q);
    return roleMatch && searchMatch;
  });

  const filteredGlobalAssets = assets.filter(a => {
    const platMatch = platformFilter === "all" || a.platform === platformFilter;
    const statMatch = statusFilter === "all" || a.status === statusFilter;
    const projMatch = projectFilter === "All" || a.project_name === projectFilter;
    const searchMatch = !q ||
      (a.account_id || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.profile_link || "").toLowerCase().includes(q) ||
      (a.country_language || "").toLowerCase().includes(q) ||
      (a.project_name || "").toLowerCase().includes(q);
    return platMatch && statMatch && projMatch && searchMatch;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    if (archiveAction !== "ALL" && log.action !== archiveAction) return false;
    if (archiveEntity !== "ALL" && log.entity_type !== archiveEntity) return false;
    if (archiveStartDate && new Date(log.created_at).getTime() < new Date(archiveStartDate).getTime()) return false;
    if (archiveEndDate && new Date(log.created_at).getTime() > new Date(archiveEndDate).getTime()) return false;
    if (!q) return true;
    return (
      (log.summary || "").toLowerCase().includes(q) ||
      (log.actor_name || "").toLowerCase().includes(q) ||
      (log.entity_type || "").toLowerCase().includes(q) ||
      JSON.stringify(log.record_snapshot || {}).toLowerCase().includes(q)
    );
  });

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

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        
        {/* Mobile-Optimized Top Executive Bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-4 gap-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  Tier 1 — God Mode
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {allSmms.length} SMMs • {assets.length} Assets
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">Global Command Center</h1>
            </div>
            <div className="flex sm:hidden gap-1.5">
              <button onClick={() => setShowSettings(true)} className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-emerald-400 text-xs font-bold active:scale-95">⚙</button>
              <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs active:scale-95">🚪</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 sm:flex-initial items-center bg-zinc-950 border border-emerald-500/40 rounded-xl p-1 gap-1">
              <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="flex-1 sm:flex-initial bg-black text-emerald-300 text-xs font-bold px-2 py-2 rounded-lg outline-none uppercase">
                <option value="weekly">📅 Weekly CSV</option>
                <option value="monthly">📆 Monthly CSV</option>
                <option value="quarterly">📊 Quarterly CSV</option>
                <option value="yearly">📈 Yearly CSV</option>
              </select>
              <button
                onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics, assets, profiles, projectFilter, scopeLabel: "Executive_Master" })}
                className="px-3 py-2 bg-emerald-500 text-black font-bold rounded-lg text-xs whitespace-nowrap active:scale-95"
              >
                ⬇ CSV
              </button>
            </div>

            <button onClick={() => setShowCreateEmpModal(true)} className="px-3 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs active:scale-95">+ Staff</button>
            <button onClick={() => setShowCreateAssetModal(true)} className="px-3 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-xs active:scale-95">+ Asset</button>
            <button onClick={() => setShowSettings(true)} className="hidden sm:inline-flex px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold rounded-xl text-xs">⚙ Settings</button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="hidden sm:inline-flex px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400">Sign Out</button>
          </div>
        </div>

        {/* Live Suspended Assets Alert Ribbon */}
        {suspendedAssets.length > 0 && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 flex flex-wrap justify-between items-center gap-2 text-xs text-red-300">
            <span>⚠️ <b>{suspendedAssets.length} Suspended Asset(s)</b> detected across squads.</span>
            <button onClick={() => { setStatusFilter("suspended"); setActiveTab("assets"); }} className="px-3 py-1.5 rounded-lg bg-red-500 text-black font-bold active:scale-95">
              Inspect Suspended →
            </button>
          </div>
        )}

        {statusBanner && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
            {statusBanner}
          </div>
        )}

        {/* Instant Omnisearch + Desktop Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="hidden md:flex flex-wrap gap-1.5">
            <button onClick={() => setActiveTab("squads")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "squads" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>🛡 Squads ({teamLeaders.length})</button>
            <button onClick={() => setActiveTab("compliance")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "compliance" ? "bg-rose-500 text-white" : "bg-zinc-900 text-rose-400 border border-rose-500/30"}`}>⚠️ Radar ({missingReportAssets.length})</button>
            <button onClick={() => setActiveTab("graphs")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300 border border-cyan-500/30"}`}>📈 Graphs</button>
            <button onClick={() => setActiveTab("achievements")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300 border border-yellow-500/30"}`}>🏆 Badges</button>
            <button onClick={() => setActiveTab("employees")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "employees" ? "bg-blue-500 text-white" : "bg-zinc-900 text-zinc-400"}`}>👥 Staff ({profiles.length})</button>
            <button onClick={() => setActiveTab("assets")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>🗂 Assets ({assets.length})</button>
            <button onClick={() => setActiveTab("bulk")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400 border border-amber-500/30"}`}>⚡ Bulk</button>
            <button onClick={() => setActiveTab("vault")} className={`px-3 py-2 rounded-xl text-xs font-bold ${activeTab === "vault" ? "bg-teal-400 text-black" : "bg-zinc-900 text-teal-300 border border-teal-500/30"}`}>📜 Vault ({auditLogs.length})</button>
          </div>

          <div className="w-full md:w-72 relative">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="🔍 Search staff, @Handle, email, country..."
              className="w-full rounded-xl bg-black border border-zinc-700 px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* TAB 1: SQUADS DRILL-DOWN */}
        {activeTab === "squads" && (
          !selectedTlId ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {teamLeaders.map(tl => {
                const tlSmms = allSmms.filter(s => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
                const tlAssets = assets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id));
                const tlActive = tlAssets.filter(a => a.status === "active").length;
                const tlSusp = tlAssets.filter(a => a.status === "suspended").length;
                const impr = metrics.filter(m => tlAssets.some(a => a.id === m.asset_id)).reduce((sum, x) => sum + (x.impressions || 0), 0);

                return (
                  <div
                    key={tl.id}
                    onClick={() => { setSelectedTlId(tl.id); setSelectedSmmId(null); }}
                    className="group cursor-pointer rounded-2xl p-5 sm:p-6 bg-zinc-950 border border-zinc-800 hover:border-emerald-500 active:scale-[0.99] transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-xl text-white">{tl.full_name}</h3>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-300">
                        {tlSmms.length} SMMs • {tlAssets.length} Assets
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 truncate">Countries: {tl.country}</p>
                    <div className="flex gap-3 mt-3 text-xs font-mono">
                      <span className="text-emerald-400">● {tlActive} Active</span>
                      <span className="text-red-400">⚠ {tlSusp} Susp</span>
                      <span className="text-blue-400 ml-auto">{impr.toLocaleString()} Impr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            activeTl && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-zinc-950 border border-zinc-800 p-2.5 rounded-2xl">
                  <button onClick={() => setSelectedTlId(null)} className="px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 font-bold text-xs whitespace-nowrap shrink-0">
                    ← All TLs
                  </button>
                  {teamLeaders.map(tl => (
                    <button key={tl.id} onClick={() => setSelectedTlId(tl.id)} className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 ${selectedTlId === tl.id ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                      {tl.full_name}
                    </button>
                  ))}
                </div>

                {displayedSmms.map(smm => {
                  const isSmmOpen = selectedSmmId === smm.id;
                  const smmAssets = assets.filter(a => a.smm_id === smm.id);
                  const smmActive = smmAssets.filter(a => a.status === "active").length;
                  const smmSusp = smmAssets.filter(a => a.status === "suspended").length;

                  return (
                    <div key={smm.id} className="rounded-2xl border border-zinc-800 bg-zinc-950">
                      <div onClick={() => setSelectedSmmId(isSmmOpen ? null : smm.id)} className="cursor-pointer p-4 sm:p-5 flex justify-between items-center gap-2">
                        <div>
                          <h4 className="font-bold text-base sm:text-lg text-white">{smm.full_name}</h4>
                          <p className="text-xs text-zinc-400">● {smmActive} Active • ⚠ {smmSusp} Susp • {smm.country}</p>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold shrink-0">
                          {isSmmOpen ? "Hide ▲" : `${smmAssets.length} Assets ▼`}
                        </span>
                      </div>
                      {isSmmOpen && (
                        <div className="p-4 pt-0 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                          {smmAssets.map(asset => (
                            <div key={asset.id} className="p-3.5 rounded-xl bg-black border border-zinc-800 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-purple-300">{asset.platform}</span>
                                <span className="text-xs text-white font-bold truncate max-w-[160px]">{asset.account_id}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button onClick={() => handleSetAssetStatus(asset, "active")} className={`min-h-[36px] py-1.5 rounded-lg text-[10px] font-bold ${asset.status === "active" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>● ACTIVE</button>
                                <button onClick={() => handleSetAssetStatus(asset, "suspended")} className={`min-h-[36px] py-1.5 rounded-lg text-[10px] font-bold ${asset.status === "suspended" ? "bg-red-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>⚠ SUSPENDED</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )
        )}

        {/* TAB 2: COMPLIANCE RADAR (ADAPTIVE CARDS ON MOBILE, TABLE ON DESKTOP) */}
        {activeTab === "compliance" && (
          <div className="bg-zinc-950 border border-rose-500/40 rounded-2xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">⚠️ Weekly Compliance Radar ({missingReportAssets.length} Pending)</h2>
              <p className="text-xs text-zinc-400">Active assets with zero metric logs since {sevenDaysAgo}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto">
              {missingReportAssets.slice(0, 200).map(a => {
                const smm = profiles.find(p => p.id === a.smm_id);
                const tl = profiles.find(p => p.id === a.team_leader_id);
                return (
                  <div key={a.id} className="p-3.5 rounded-xl bg-black border border-zinc-800 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="uppercase font-bold text-purple-300 text-[10px]">{a.platform}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">PENDING</span>
                    </div>
                    <div className="font-bold text-white font-mono truncate">{a.account_id}</div>
                    <div className="text-zinc-400 text-[11px]">SMM: <b className="text-white">{smm?.full_name || "Unassigned"}</b> • TL: <b className="text-blue-400">{tl?.full_name || "N/A"}</b></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <div className="bg-zinc-950 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">📈 Executive Summary Graphs ({csvHorizon.toUpperCase()})</h2>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map(h => (
                  <button key={h} onClick={() => setCsvHorizon(h)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${csvHorizon === h ? "bg-cyan-400 text-black" : "bg-black text-zinc-400"}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {periodSeries.map(([period, val]) => {
                const w = Math.min(100, Math.max(6, Math.round((val.impr / maxPeriodImpr) * 100)));
                return (
                  <div key={period} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-white">{period}</span>
                      <span className="text-cyan-300">{val.impr.toLocaleString()} Impr • {val.eng.toLocaleString()} Eng</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" style={{ width: `${w}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {achievements.map(ach => (
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

        {/* TAB 5: EMPLOYEES CRUD (ADAPTIVE MOBILE CARDS + DESKTOP TABLE) */}
        {activeTab === "employees" && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Employees Directory ({filteredEmployees.length})</h2>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(["all", "admin", "team_leader", "smm"] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${roleFilter === r ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                    {r === "all" ? `All (${profiles.length})` : r.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Cards (< 768px) */}
            <div className="md:hidden space-y-2.5 max-h-[540px] overflow-y-auto">
              {filteredEmployees.map(emp => {
                const tl = teamLeaders.find(t => t.id === emp.team_leader_id);
                const cnt = assets.filter(a => a.smm_id === emp.id || a.team_leader_id === emp.id).length;
                return (
                  <div key={emp.id} className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{emp.full_name}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase text-[10px] font-bold">{emp.role}</span>
                    </div>
                    <div className="text-zinc-400">Countries: {emp.country}</div>
                    <div className="flex justify-between items-center pt-2 border-t border-zinc-900">
                      <span className="text-purple-400 font-mono font-bold">{cnt} Assets {emp.role === "smm" && `• TL: ${tl?.full_name || "None"}`}</span>
                      <div className="space-x-2">
                        <button onClick={() => setEditingProfile({ ...emp })} className="px-3 py-1 rounded-lg bg-zinc-900 text-emerald-400 font-bold">✎ Edit</button>
                        {emp.id !== adminProfile.id && (
                          <button onClick={() => handleDeleteEmployee(emp.id, emp.full_name)} className="px-3 py-1 rounded-lg bg-zinc-900 text-red-400 font-bold">🗑</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto border border-zinc-800 rounded-xl max-h-[600px]">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase sticky top-0">
                  <tr>
                    <th className="p-3.5">Full Name</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Countries</th>
                    <th className="p-3.5">Team Leader</th>
                    <th className="p-3.5">Assets</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-black">
                  {filteredEmployees.map(emp => {
                    const tl = teamLeaders.find(t => t.id === emp.team_leader_id);
                    const cnt = assets.filter(a => a.smm_id === emp.id || a.team_leader_id === emp.id).length;
                    return (
                      <tr key={emp.id}>
                        <td className="p-3.5 font-bold text-white">{emp.full_name}</td>
                        <td className="p-3.5 uppercase text-[10px] font-bold">{emp.role}</td>
                        <td className="p-3.5 max-w-xs truncate">{emp.country}</td>
                        <td className="p-3.5 text-blue-400">{emp.role === "smm" ? (tl?.full_name || "Unassigned") : "—"}</td>
                        <td className="p-3.5 font-mono font-bold text-purple-400">{cnt}</td>
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

        {/* TAB 6: GLOBAL ASSETS CRUD (ADAPTIVE MOBILE CARDS + DESKTOP TABLE) */}
        {activeTab === "assets" && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button onClick={() => setStatusFilter("all")} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${statusFilter === "all" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>All ({assets.length})</button>
                <button onClick={() => setStatusFilter("active")} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${statusFilter === "active" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-emerald-400"}`}>● Active ({activeAssets.length})</button>
                <button onClick={() => setStatusFilter("suspended")} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${statusFilter === "suspended" ? "bg-red-500 text-black" : "bg-zinc-900 text-red-400"}`}>⚠ Susp ({suspendedAssets.length})</button>
              </div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                <button onClick={() => setPlatformFilter("all")} className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${platformFilter === "all" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>All</button>
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setPlatformFilter(p)} className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${platformFilter === p ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>{p}</button>
                ))}
              </div>
            </div>

            {/* Mobile Asset Cards (< 768px) */}
            <div className="md:hidden space-y-3 max-h-[560px] overflow-y-auto">
              {filteredGlobalAssets.slice(0, 150).map(asset => {
                const smm = profiles.find(p => p.id === asset.smm_id);
                const tl = profiles.find(p => p.id === asset.team_leader_id);
                const isRev = !autoMaskDefault || !!revealedAssets[asset.id];
                return (
                  <div key={asset.id} className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase text-[10px]">{asset.platform}</span>
                      <span className="text-zinc-400">{smm?.full_name || "Unassigned"} (TL: {tl?.full_name || "N/A"})</span>
                    </div>
                    <div className="font-bold text-white text-sm font-mono">{asset.account_id}</div>
                    <div className="p-2.5 rounded-lg bg-zinc-950 font-mono text-[11px] space-y-1">
                      <div>Pass: <span className={isRev ? "text-emerald-400" : "blur-[4px]"}>{asset.account_password || "N/A"}</span></div>
                      <div>Email: {asset.email || "N/A"}</div>
                      {asset.two_fa_code && <div className="text-amber-300">🔐 2FA: {totpCodes[asset.id] || asset.two_fa_code}</div>}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => handleSetAssetStatus(asset, "active")} className={`min-h-[36px] rounded-lg font-bold text-[11px] ${asset.status === "active" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>● Active</button>
                      <button onClick={() => handleSetAssetStatus(asset, "suspended")} className={`min-h-[36px] rounded-lg font-bold text-[11px] ${asset.status === "suspended" ? "bg-red-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>⚠ Suspended</button>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))} className="px-3 py-1 rounded-lg bg-zinc-900 text-zinc-300">{isRev ? "🙈 Mask" : "👁 Reveal"}</button>
                      <button onClick={() => setEditingAsset({ ...asset })} className="px-3 py-1 rounded-lg bg-zinc-900 text-emerald-400 font-bold">✎ Edit</button>
                      <button onClick={() => handleDeleteAsset(asset.id, asset.account_id)} className="px-3 py-1 rounded-lg bg-zinc-900 text-red-400 font-bold">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto border border-zinc-800 rounded-xl max-h-[600px]">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Platform</th>
                    <th className="p-3">Asset ID (@Handle)</th>
                    <th className="p-3">SMM / TL</th>
                    <th className="p-3">Credentials & Live 2FA ({totpSeconds}s)</th>
                    <th className="p-3">Status Toggle</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-black font-mono">
                  {filteredGlobalAssets.slice(0, 300).map(asset => {
                    const smm = profiles.find(p => p.id === asset.smm_id);
                    const tl = profiles.find(p => p.id === asset.team_leader_id);
                    const isRev = !autoMaskDefault || !!revealedAssets[asset.id];
                    return (
                      <tr key={asset.id}>
                        <td className="p-3 font-sans"><span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase text-[10px]">{asset.platform}</span></td>
                        <td className="p-3 font-bold text-white">{asset.account_id}</td>
                        <td className="p-3 font-sans">
                          <div className="text-white font-bold">{smm?.full_name || "Unassigned"}</div>
                          <div className="text-[10px] text-blue-400">TL: {tl?.full_name || "N/A"}</div>
                        </td>
                        <td className="p-3 text-[11px]">
                          <div>Pass: <span className={isRev ? "text-emerald-400" : "blur-[4px] select-none"}>{asset.account_password || "N/A"}</span></div>
                          <div>Email: {asset.email || "N/A"}</div>
                          {asset.two_fa_code && <div className="text-amber-300">🔐 2FA: {totpCodes[asset.id] || asset.two_fa_code}</div>}
                        </td>
                        <td className="p-3 font-sans">
                          <div className="flex gap-1">
                            <button onClick={() => handleSetAssetStatus(asset, "active")} className={`px-2 py-1 rounded text-[10px] font-bold ${asset.status === "active" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>● Active</button>
                            <button onClick={() => handleSetAssetStatus(asset, "suspended")} className={`px-2 py-1 rounded text-[10px] font-bold ${asset.status === "suspended" ? "bg-red-500 text-black" : "bg-zinc-900 text-zinc-500"}`}>⚠ Susp</button>
                          </div>
                        </td>
                        <td className="p-3 text-right space-x-1.5 font-sans">
                          <button onClick={() => setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] }))} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-[11px]">{isRev ? "🙈" : "👁"}</button>
                          <button onClick={() => setEditingAsset({ ...asset })} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold text-[11px]">✎ Edit</button>
                          <button onClick={() => handleDeleteAsset(asset.id, asset.account_id)} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold text-[11px]">🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: BULK DATA ENTRY */}
        {activeTab === "bulk" && (
          <form onSubmit={handleExecuteBulkImport} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-2">
              <h2 className="text-base sm:text-xl font-bold text-white">⚡ Bulk Data Entry Terminal</h2>
              <div className="flex gap-1.5 bg-black p-1 rounded-xl border border-zinc-800">
                <button type="button" onClick={() => setBulkMode("assets")} className={`px-3 py-2 rounded-lg text-xs font-bold ${bulkMode === "assets" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>1. Bulk Assets</button>
                <button type="button" onClick={() => setBulkMode("employees")} className={`px-3 py-2 rounded-lg text-xs font-bold ${bulkMode === "employees" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>2. Bulk Staff</button>
              </div>
            </div>
            <textarea rows={8} required value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={bulkMode === "assets" ? "Asset_ID, Asset_Password, Email, Email_Password, Profile_Link, Bio, 2FA_Code, Phone, Country, Platform, Project" : "Full_Name, Username(@smm/@tl), Password, Role (admin/team_leader/smm), Country"} className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-xs font-mono text-white outline-none" />
            <button type="submit" className="w-full min-h-[48px] py-3.5 bg-amber-500 text-black font-bold rounded-xl text-sm">
              ⚡ Execute Bulk Import ({parseBulkRows(bulkText).length} Rows Detected)
            </button>
          </form>
        )}

        {/* TAB 8: PERMANENT ARCHIVE VAULT */}
        {activeTab === "vault" && (
          <div className="bg-zinc-950 border border-teal-500/40 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">📜 Permanent Archive Vault ({filteredAuditLogs.length} / {auditLogs.length})</h2>
                <p className="text-xs text-zinc-400">Local-timezone synchronized Date & Time filter + One-Click Restore</p>
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button type="button" onClick={() => applyArchivePreset(1)} className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-xs font-bold text-teal-300 border border-teal-500/30 whitespace-nowrap">1H</button>
                <button type="button" onClick={() => applyArchivePreset(24)} className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-xs font-bold text-teal-300 border border-teal-500/30 whitespace-nowrap">24H</button>
                <button type="button" onClick={() => applyArchivePreset(24 * 7)} className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-xs font-bold text-teal-300 border border-teal-500/30 whitespace-nowrap">7D</button>
                <button type="button" onClick={() => applyArchivePreset(null)} className="px-3 py-1.5 rounded-lg bg-teal-500 text-black text-xs font-bold whitespace-nowrap">Show All ({auditLogs.length})</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-black p-3.5 rounded-xl border border-zinc-800">
              <input type="datetime-local" value={archiveStartDate} onChange={(e) => setArchiveStartDate(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
              <input type="datetime-local" value={archiveEndDate} onChange={(e) => setArchiveEndDate(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
              <select value={archiveAction} onChange={(e) => setArchiveAction(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white">
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="BULK_CREATE">BULK_CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="UPSERT">UPSERT</option>
                <option value="DELETE">DELETE</option>
                <option value="RESTORE">RESTORE</option>
              </select>
              <select value={archiveEntity} onChange={(e) => setArchiveEntity(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white">
                <option value="ALL">All Entities</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="ASSET">ASSET</option>
                <option value="METRIC">METRIC</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto">
              {filteredAuditLogs.map(log => (
                <div key={log.id} className="p-3.5 rounded-xl bg-black border border-zinc-800 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold text-[10px] uppercase">{log.action} • {log.entity_type}</span>
                      <span className="font-bold text-white">{log.summary}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(log.action === "DELETE" && (log.entity_type === "ASSET" || log.entity_type === "METRIC")) && (
                        <button onClick={() => handleRestoreArchivedRecord(log.id)} className="px-3 py-1 rounded-lg bg-emerald-500 text-black font-bold text-[11px]">
                          ♻ Restore
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-teal-300">
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-900 text-[10px] font-mono text-zinc-400 overflow-x-auto">
                    {JSON.stringify(log.record_snapshot, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MOBILE STICKY BOTTOM DOCK FOR ADMIN (Horizontally Swipeable Thumb Bar) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-2 py-1.5 flex overflow-x-auto no-scrollbar justify-between items-center gap-1">
        {[
          { id: "squads", icon: "🛡", label: "Squads" },
          { id: "compliance", icon: "⚠️", label: `Radar(${missingReportAssets.length})` },
          { id: "assets", icon: "🗂", label: "Assets" },
          { id: "employees", icon: "👥", label: "Staff" },
          { id: "graphs", icon: "📈", label: "Graphs" },
          { id: "achievements", icon: "🏆", label: "Badges" },
          { id: "bulk", icon: "⚡", label: "Bulk" },
          { id: "vault", icon: "📜", label: "Vault" }
        ].map((t: any) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl shrink-0 transition-all active:scale-90 ${
              activeTab === t.id ? "text-emerald-400 font-bold bg-emerald-500/10" : "text-zinc-500"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="text-[10px] mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* SLIDE-OVER EXECUTIVE SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveAdminSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Executive Vault Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300">✕ Close</button>
            </div>
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <div className="text-xs font-bold uppercase text-emerald-400">Global Agency Input Lock</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleGlobalLockAll(true)} className="min-h-[42px] py-2 bg-red-500/20 border border-red-500/40 text-red-400 font-bold rounded-xl text-xs">🔒 Lock All SMMs</button>
                <button type="button" onClick={() => handleGlobalLockAll(false)} className="min-h-[42px] py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold rounded-xl text-xs">🔓 Unlock All SMMs</button>
              </div>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-black border border-zinc-800 rounded-xl">
              <span className="text-xs font-bold text-zinc-300">Auto-Mask Asset Passwords</span>
              <button type="button" onClick={() => setAutoMaskDefault(!autoMaskDefault)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${autoMaskDefault ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                {autoMaskDefault ? "MASKED" : "REVEALED"}
              </button>
            </div>
            <input type="text" required value={setAdminName} onChange={(e) => setSetAdminName(e.target.value)} placeholder="Master Admin Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="password" value={masterNewPass} onChange={(e) => setMasterNewPass(e.target.value)} placeholder="Update Master Password (Optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Executive Settings</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: CREATE EMPLOYEE */}
      {showCreateEmpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowCreateEmpModal(false)}>
          <form onSubmit={handleCreateEmployee} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-zinc-950 border-t sm:border border-blue-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Create New Employee (Admin / @tl / @smm)</h3>
            <div className="grid grid-cols-3 gap-2 p-1 bg-black rounded-xl border border-zinc-800">
              {(["smm", "team_leader", "admin"] as const).map(r => (
                <button type="button" key={r} onClick={() => setEmpRole(r)} className={`py-2 rounded-lg text-xs font-bold uppercase ${empRole === r ? "bg-blue-600 text-white" : "text-zinc-400"}`}>{r.replace("_", " ")}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input type="text" required value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Full Name" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" autoCapitalize="none" required value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} placeholder="name@smm or name@tl" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
              <input type="text" required value={empPass} onChange={(e) => setEmpPass(e.target.value)} placeholder="Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Create Account Live</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: EDIT EMPLOYEE */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setEditingProfile(null)}>
          <form onSubmit={handleUpdateEmployee} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Edit Employee Profile</h3>
            <input type="text" required value={editingProfile.full_name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={editingProfile.country || ""} onChange={(e) => setEditingProfile({ ...editingProfile, country: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Changes</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: CREATE SINGLE ASSET */}
      {showCreateAssetModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowCreateAssetModal(false)}>
          <form onSubmit={handleCreateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-t sm:border border-purple-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Create New Social Media Asset</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={newAsset.team_leader_id} onChange={(e) => setNewAsset({ ...newAsset, team_leader_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>TL: {tl.full_name}</option>)}
              </select>
              <select value={newAsset.smm_id} onChange={(e) => setNewAsset({ ...newAsset, smm_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {allSmms.map(s => <option key={s.id} value={s.id}>SMM: {s.full_name}</option>)}
              </select>
              <select value={newAsset.platform} onChange={(e) => setNewAsset({ ...newAsset, platform: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <input type="text" required placeholder="Asset ID (@Handle)" value={newAsset.account_id} onChange={(e) => setNewAsset({ ...newAsset, account_id: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" placeholder="Asset Password" value={newAsset.account_password} onChange={(e) => setNewAsset({ ...newAsset, account_password: e.target.value })} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <button type="submit" className="w-full min-h-[48px] py-3 bg-purple-600 text-white font-bold rounded-xl text-xs">Save & Create Asset</button>
          </form>
        </div>
      )}

      {/* BOTTOM-SHEET MODAL: EDIT ASSET */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setEditingAsset(null)}>
          <form onSubmit={handleUpdateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <h3 className="text-base font-bold text-white">Edit Asset & Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input type="text" value={editingAsset.account_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <select value={editingAsset.status} onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                <option value="active">● ACTIVE</option>
                <option value="suspended">⚠ SUSPENDED</option>
              </select>
            </div>
            <button type="submit" className="w-full min-h-[48px] py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Changes</button>
          </form>
        </div>
      )}

    </div>
  );
}
