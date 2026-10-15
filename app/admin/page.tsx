"use client";

import { useState, useEffect, useCallback } from "react";
import { adminSupabase as supabase, broadcastRealtimeSync } from "@/lib/supabase";
import Link from "next/link";

const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France",
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany",
  "Kosavo", "Greece", "Hungary", "Africa", "Global"
];

export default function AdminCommandCenter() {
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [profiles, setProfiles] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [motd, setMotd] = useState("");
  const [dailyTarget, setDailyTarget] = useState(20);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Live");

  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [selectedSmmId, setSelectedSmmId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [revealedAssets, setRevealedAssets] = useState<Record<string, boolean>>({});
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"global" | "personnel" | "provision" | "security">("global");

  // Provisioning State
  const [newRole, setNewRole] = useState<"admin" | "team_leader" | "smm">("admin");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newCountry, setNewCountry] = useState("Global");
  const [newTlId, setNewTlId] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  // Admin Own Security State
  const [myNewName, setMyNewName] = useState("");
  const [myNewEmail, setMyNewEmail] = useState("");
  const [myNewPassword, setMyNewPassword] = useState("");
  const [ personnelSearch, setPersonnelSearch ] = useState("");

  const loadAllEnterpriseData = useCallback(async () => {
    const [pRes, aRes, mRes, sRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("social_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false }),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (pRes.data) setProfiles(pRes.data);
    if (aRes.data) setAssets(aRes.data);
    if (mRes.data) setMetrics(mRes.data);
    if (sRes.data) {
      setMotd(sRes.data.motd || "");
      setDailyTarget(sRes.data.daily_target || 20);
    }
    setLastSyncTime(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    verifyAdminSession();
  }, []);

  // Real-time subscription across all tables + broadcast channel
  useEffect(() => {
    if (!adminProfile) return;

    const pgChannel = supabase
      .channel("admin-postgres-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadAllEnterpriseData())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => loadAllEnterpriseData())
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => loadAllEnterpriseData())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => loadAllEnterpriseData())
      .subscribe();

    const broadcastChannel = supabase
      .channel("executive-live-sync")
      .on("broadcast", { event: "db-sync" }, () => loadAllEnterpriseData())
      .subscribe();

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [adminProfile, loadAllEnterpriseData]);

  const verifyAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsCheckingAuth(false);
      return;
    }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      setAuthMsg("Security Violation: Only Master Admins are permitted inside the Executive Vault.");
      setIsCheckingAuth(false);
      return;
    }

    setAdminProfile(prof);
    setMyNewName(prof.full_name || "");
    setMyNewEmail(session.user.email || "");
    setIsCheckingAuth(false);
    await loadAllEnterpriseData();
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Verifying Master Clearance...");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return setAuthMsg(error.message);

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      return setAuthMsg("Access Denied: You do not hold Admin clearance.");
    }

    setAdminProfile(prof);
    setMyNewName(prof.full_name || "");
    setMyNewEmail(data.user.email || "");
    await loadAllEnterpriseData();
  };

  const notifyAndReload = async (msg: string) => {
    setAdminMsg(msg);
    await loadAllEnterpriseData();
    await broadcastRealtimeSync("admin");
    setTimeout(() => setAdminMsg(""), 4000);
  };

  const handleProvisionAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg("Provisioning account...");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail.trim(),
        password: newPass,
        role: newRole,
        full_name: newName.trim(),
        country: newCountry,
        team_leader_id: newRole === "smm" ? newTlId : null,
        team_leader_ids: newRole === "smm" && newTlId ? [newTlId] : [],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewName(""); setNewEmail(""); setNewPass("");
      await notifyAndReload(`✅ Provisioned ${newRole.toUpperCase()} account!`);
    } else {
      setAdminMsg("Error: " + data.error);
    }
  };

  const handleGlobalLockToggle = async (lockState: boolean) => {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_lock_smms", is_locked: lockState }),
    });
    if (res.ok) {
      await notifyAndReload(lockState ? "🔒 All SMM metric inputs globally LOCKED." : "🔓 All SMM metric inputs globally UNLOCKED.");
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_system_settings", motd, daily_target: dailyTarget }),
    });
    if (res.ok) await notifyAndReload("✅ Global broadcast & target settings synced live!");
  };

  const handleUpdateMySecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_profile", id: adminProfile.id, full_name: myNewName }),
    });
    if (myNewPassword || (myNewEmail && myNewEmail !== email)) {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_auth", id: adminProfile.id, email: myNewEmail, password: myNewPassword }),
      });
      const json = await res.json();
      if (!res.ok) return setAdminMsg("Error: " + json.error);
    }
    setMyNewPassword("");
    setAdminProfile((prev: any) => ({ ...prev, full_name: myNewName }));
    await notifyAndReload("✅ Admin profile & credentials updated!");
  };

  const handleUpdateUserRow = async (userId: string, updates: Record<string, any>) => {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_profile", id: userId, ...updates }),
    });
    if (res.ok) await notifyAndReload("✅ Personnel profile updated live!");
  };

  const handleResetUserPassword = async (userId: string, userName: string) => {
    const newPassword = prompt(`Enter new password (min 6 chars) for ${userName}:`);
    if (!newPassword || newPassword.length < 6) return;
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_auth", id: userId, password: newPassword }),
    });
    if (res.ok) await notifyAndReload(`🔑 Password reset for ${userName}!`);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Permanently terminate ${userName} and remove their account?`)) return;
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", id: userId }),
    });
    if (res.ok) await notifyAndReload(`🗑 Terminated ${userName}.`);
  };

  const handleToggleAssetStatus = async (asset: any) => {
    const newStatus = asset.status === "active" ? "suspended" : "active";
    await supabase.from("social_assets").update({ status: newStatus }).eq("id", asset.id);
    await notifyAndReload(`Asset ${asset.account_id} marked ${newStatus.toUpperCase()}`);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Permanently delete this Social Asset from the vault?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    await notifyAndReload("🗑 Asset deleted from vault.");
  };

  // Filtered assets based on top campaign filter
  const projectFilteredAssets = projectFilter === "All"
    ? assets
    : assets.filter(a => (a.project_name || "General Campaign") === projectFilter);

  const handleExportMasterCSV = () => {
    const headers = [
      "Project", "Team Leader", "SMM Handler", "Platform", "Asset ID", "Status", "Asset Profile Link",
      "Week Of", "Impressions", "Engagements", "Likes", "Reposts", "Comments",
      "Followers Gained", "Followers Lost", "Total Followers", "Posts Published", "Top Post Impr.",
      "Engagement %", "Net Followers", "Posts/Day"
    ];

    const filteredMetrics = metrics.filter(m => {
      const asset = projectFilteredAssets.find(a => a.id === m.asset_id);
      if (!asset) return false;
      if (selectedTlId && asset.team_leader_id !== selectedTlId) return false;
      if (selectedSmmId && asset.smm_id !== selectedSmmId) return false;
      return true;
    });

    const rows = filteredMetrics.map(m => {
      const asset = assets.find(a => a.id === m.asset_id) || {};
      const smm = profiles.find(p => p.id === asset.smm_id) || {};
      const tl = profiles.find(p => p.id === (asset.team_leader_id || smm.team_leader_id)) || {};
      const engPct = m.impressions > 0 ? ((m.engagements / m.impressions) * 100).toFixed(2) : "0.00";
      const netFol = (m.followers_gained || 0) - (m.followers_lost || 0);
      const postsDay = ((m.posts_published || 0) / 7).toFixed(2);

      return [
        `"${asset.project_name || "General"}"`, `"${tl.full_name || "Unassigned"}"`, `"${smm.full_name || "SMM"}"`,
        `"${asset.platform || ""}"`, `"${asset.account_id || ""}"`, `"${asset.status || ""}"`, `"${asset.profile_link || ""}"`,
        `"${m.week_of}"`, m.impressions, m.engagements, m.likes, m.shares_reposts, m.comments,
        m.followers_gained, m.followers_lost, m.total_followers, m.posts_published, m.top_post_impressions,
        engPct, netFol, postsDay
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Enterprise_MEL_Report_${projectFilter}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm animate-pulse">Verifying Executive Vault Clearance...</div>;

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md transition-all duration-500">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]">Tier 1 — Executive Vault</span>
            <h1 className="text-3xl font-bold text-white mt-3">Admin Command Center</h1>
            <p className="text-xs text-zinc-500 mt-1">Maximum-Security Global Oversight Terminal</p>
          </div>

          <form onSubmit={handleAdminLogin} className="bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500"></div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Master Admin Email" className="w-full rounded-lg bg-black border border-zinc-800 focus:border-emerald-500 p-3 text-sm text-white outline-none transition-all" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg bg-black border border-zinc-800 focus:border-emerald-500 p-3 text-sm text-white outline-none transition-all" />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center animate-pulse">{authMsg}</div>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold py-3 rounded-lg text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">Unlock Executive Vault</button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400 transition-colors">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const teamLeaders = profiles.filter(p => p.role === "team_leader");
  const allSmms = profiles.filter(p => p.role === "smm");
  const uniqueProjects = Array.from(new Set(assets.map(a => a.project_name || "General Campaign")));

  const activeTl = teamLeaders.find(t => t.id === selectedTlId);
  const displayedSmms = selectedTlId
    ? allSmms.filter(s => s.team_leader_id === selectedTlId || (s.team_leader_ids && s.team_leader_ids.includes(selectedTlId)))
    : [];

  const activeSmm = allSmms.find(s => s.id === selectedSmmId);
  const displayedAssets = selectedSmmId
    ? projectFilteredAssets.filter(a => a.smm_id === selectedSmmId)
    : [];

  const activeAsset = projectFilteredAssets.find(a => a.id === selectedAssetId);
  const activeAssetMetrics = selectedAssetId ? metrics.filter(m => m.asset_id === selectedAssetId) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Executive Bar */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                Tier 1 — Executive God Mode
              </span>
              <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-emerald-400 px-2.5 py-1 rounded-full">
                ⚡ LIVE SYNC ({lastSyncTime})
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">Global Admin Command Center</h1>
            <p className="text-xs text-zinc-400">
              Admin: <b className="text-white">{adminProfile.full_name}</b> • Team Leaders: {teamLeaders.length} • SMM Handlers: {allSmms.length} • Assets: {projectFilteredAssets.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs text-white transition-all outline-none">
              <option value="All">All Projects / Campaigns</option>
              {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                showSettingsDrawer
                  ? "bg-emerald-500 text-black border-emerald-400"
                  : "bg-zinc-900 text-emerald-400 border-emerald-500/40 hover:bg-zinc-800"
              }`}
            >
              ⚙ Executive Settings & Controls
            </button>
            <button onClick={handleExportMasterCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              ⬇ Export Master CSV
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-lg text-xs text-zinc-400 hover:text-red-400 transition-all">
              Lock & Sign Out
            </button>
          </div>
        </div>

        {adminMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-pulse">
            {adminMsg}
          </div>
        )}

        {/* EXECUTIVE SETTINGS & CONTROLS DRAWER */}
        {showSettingsDrawer && (
          <div className="bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-6 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSettingsTab("global")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${settingsTab === "global" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>🌐 Global Broadcast & Locks</button>
                <button onClick={() => setSettingsTab("personnel")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${settingsTab === "personnel" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>👥 Personnel & Role Manager ({profiles.length})</button>
                <button onClick={() => setSettingsTab("provision")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${settingsTab === "provision" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>➕ Provision New Account</button>
                <button onClick={() => setSettingsTab("security")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${settingsTab === "security" ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>🔐 My Admin Security</button>
              </div>
              <button onClick={() => setShowSettingsDrawer(false)} className="text-xs text-zinc-400 hover:text-white">Close Settings ✕</button>
            </div>

            {/* Sub-tab 1: Global Broadcast & Bulk Locks */}
            {settingsTab === "global" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form onSubmit={handleSaveSystemSettings} className="bg-black border border-zinc-800 p-5 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase text-emerald-400">📢 Global Portal Broadcast Banner (MOTD)</h3>
                  <p className="text-[11px] text-zinc-400">Appears live at the top of Team Leader & SMM dashboards without reloading.</p>
                  <input type="text" value={motd} onChange={(e) => setMotd(e.target.value)} placeholder="e.g. All weekly reports due Friday 18:00 UTC!" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-400">Default Target:</label>
                    <input type="number" value={dailyTarget} onChange={(e) => setDailyTarget(Number(e.target.value))} className="w-24 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                    <button type="submit" className="ml-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs">Save & Broadcast Live</button>
                  </div>
                </form>

                <div className="bg-black border border-zinc-800 p-5 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase text-amber-400">🔒 Global SMM Metric Submission Controls</h3>
                  <p className="text-[11px] text-zinc-400">Instantly freeze or open weekly metric logging across all {allSmms.length} SMM Handlers globally.</p>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => handleGlobalLockToggle(true)} className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500 hover:text-black border border-red-500/40 text-red-400 font-bold rounded-lg text-xs transition-all">
                      🔒 Lock All SMM Inputs Globally
                    </button>
                    <button onClick={() => handleGlobalLockToggle(false)} className="flex-1 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 font-bold rounded-lg text-xs transition-all">
                      🔓 Unlock All SMM Inputs Globally
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Personnel & Role Directory */}
            {settingsTab === "personnel" && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                  placeholder="Search personnel by name, role, or country..."
                  className="w-full md:w-96 rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-900 text-zinc-400 uppercase sticky top-0">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Countries</th>
                        <th className="p-3">Assigned TL (for SMM)</th>
                        <th className="p-3">Metric Lock</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {profiles
                        .filter(p =>
                          (p.full_name || "").toLowerCase().includes(personnelSearch.toLowerCase()) ||
                          (p.role || "").toLowerCase().includes(personnelSearch.toLowerCase()) ||
                          (p.country || "").toLowerCase().includes(personnelSearch.toLowerCase())
                        )
                        .map(p => (
                          <tr key={p.id} className="hover:bg-zinc-900/50">
                            <td className="p-2.5 font-bold text-white">{p.full_name}</td>
                            <td className="p-2.5">
                              <select
                                value={p.role}
                                onChange={(e) => handleUpdateUserRow(p.id, { role: e.target.value })}
                                className="rounded bg-black border border-zinc-800 px-2 py-1 text-xs text-emerald-300"
                              >
                                <option value="admin">ADMIN</option>
                                <option value="team_leader">TEAM LEADER</option>
                                <option value="smm">SMM HANDLER</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                defaultValue={p.country || ""}
                                onBlur={(e) => {
                                  if (e.target.value !== p.country) handleUpdateUserRow(p.id, { country: e.target.value });
                                }}
                                className="rounded bg-black border border-zinc-800 px-2 py-1 text-xs text-white w-36"
                              />
                            </td>
                            <td className="p-2.5">
                              {p.role === "smm" ? (
                                <select
                                  value={p.team_leader_id || ""}
                                  onChange={(e) => handleUpdateUserRow(p.id, { team_leader_id: e.target.value, team_leader_ids: [e.target.value] })}
                                  className="rounded bg-black border border-zinc-800 px-2 py-1 text-xs text-blue-300"
                                >
                                  <option value="">Unassigned</option>
                                  {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                                </select>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              {p.role === "smm" ? (
                                <button
                                  onClick={() => handleUpdateUserRow(p.id, { is_locked: !p.is_locked })}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${p.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
                                >
                                  {p.is_locked ? "🔒 Locked" : "🔓 Open"}
                                </button>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="p-2.5 flex items-center gap-2">
                              <button onClick={() => handleResetUserPassword(p.id, p.full_name)} className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-bold">
                                🔑 Reset Pass
                              </button>
                              {p.id !== adminProfile.id && (
                                <button onClick={() => handleDeleteUser(p.id, p.full_name)} className="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 text-[10px] font-bold">
                                  ✕ Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Provision Any Account */}
            {settingsTab === "provision" && (
              <form onSubmit={handleProvisionAccount} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-black border border-zinc-800 p-5 rounded-xl">
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-emerald-400 font-bold">
                  <option value="admin">Role: Co-Admin</option>
                  <option value="team_leader">Role: Team Leader</option>
                  <option value="smm">Role: SMM Handler</option>
                </select>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@executive.com" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password (min 6)" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <select value={newCountry} onChange={(e) => setNewCountry(e.target.value)} className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white">
                  {HIERARCHY_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {newRole === "smm" ? (
                  <select value={newTlId} onChange={(e) => setNewTlId(e.target.value)} className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-blue-300">
                    <option value="">Select Team Leader</option>
                    {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                  </select>
                ) : (
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs p-2.5">
                    + Provision Account
                  </button>
                )}
                {newRole === "smm" && (
                  <button type="submit" className="md:col-span-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs p-2.5">
                    + Provision SMM Handler Account
                  </button>
                )}
              </form>
            )}

            {/* Sub-tab 4: Admin Own Security */}
            {settingsTab === "security" && (
              <form onSubmit={handleUpdateMySecurity} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-black border border-zinc-800 p-5 rounded-xl">
                <input type="text" required value={myNewName} onChange={(e) => setMyNewName(e.target.value)} placeholder="Admin Display Name" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <input type="email" value={myNewEmail} onChange={(e) => setMyNewEmail(e.target.value)} placeholder="Admin Login Email" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <input type="password" value={myNewPassword} onChange={(e) => setMyNewPassword(e.target.value)} placeholder="New Master Password (optional)" className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white" />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs p-2.5">
                  Save My Admin Credentials
                </button>
              </form>
            )}
          </div>
        )}

        {/* Interactive Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-800/80 px-4 py-2.5 rounded-xl">
          <span className="text-zinc-500 font-mono uppercase">Command Path:</span>
          <button onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }} className={`font-bold transition-colors ${!selectedTlId ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}>
            All Team Leaders ({teamLeaders.length})
          </button>
          {activeTl && (
            <>
              <span className="text-zinc-600">/</span>
              <button onClick={() => { setSelectedSmmId(null); setSelectedAssetId(null); }} className={`font-bold transition-colors ${!selectedSmmId ? "text-blue-400" : "text-zinc-400 hover:text-white"}`}>
                Commander {activeTl.full_name} ({displayedSmms.length} SMMs)
              </button>
            </>
          )}
          {activeSmm && (
            <>
              <span className="text-zinc-600">/</span>
              <button onClick={() => setSelectedAssetId(null)} className={`font-bold transition-colors ${!selectedAssetId ? "text-purple-400" : "text-zinc-400 hover:text-white"}`}>
                SMM {activeSmm.full_name} ({displayedAssets.length} Assets)
              </button>
            </>
          )}
          {activeAsset && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="font-bold text-amber-400">[{activeAsset.platform.toUpperCase()}] {activeAsset.account_id}</span>
            </>
          )}
        </div>

        {/* TIER 1: TEAM LEADERS GRID */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
              1. Select a Team Leader to Unfold Squad & Performance Chart
            </h2>
            {selectedTlId && (
              <button onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }} className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800 transition-all">
                ✕ Collapse All Drawers
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {teamLeaders.map(tl => {
              const isSelected = selectedTlId === tl.id;
              const tlSmms = allSmms.filter(s => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
              const tlAssets = projectFilteredAssets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id));
              const tlAssetIds = tlAssets.map(a => a.id);
              const tlLogs = metrics.filter(m => tlAssetIds.includes(m.asset_id));
              const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);
              const eng = tlLogs.reduce((sum, x) => sum + (x.engagements || 0), 0);

              return (
                <div
                  key={tl.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null);
                    } else {
                      setSelectedTlId(tl.id); setSelectedSmmId(null); setSelectedAssetId(null);
                    }
                  }}
                  className={`group cursor-pointer rounded-2xl p-5 border transition-all duration-300 ease-out transform ${
                    isSelected
                      ? "bg-gradient-to-b from-emerald-950/40 to-zinc-950 border-emerald-500 -translate-y-1.5 shadow-[0_12px_35px_-10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/50"
                      : "bg-zinc-950 border-zinc-800/90 hover:border-emerald-500/50 hover:-translate-y-1"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-zinc-700 group-hover:bg-emerald-400"}`}></span>
                      <h3 className="font-bold text-lg text-white group-hover:text-emerald-300">{tl.full_name}</h3>
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${isSelected ? "bg-emerald-500 text-black border-emerald-400" : "bg-blue-500/15 text-blue-300 border-blue-500/30"}`}>
                      {tlSmms.length} SMMs • {tlAssets.length} Assets
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 mt-1">Regions: {tl.country}</p>

                  <div className="mt-4 space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">Squad Impressions</span>
                        <span className="text-blue-400 font-bold">{impr.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${Math.min(100, Math.max(6, (impr / 100000) * 100))}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">Squad Engagements</span>
                        <span className="text-purple-400 font-bold">{eng.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700" style={{ width: `${Math.min(100, Math.max(6, (eng / 10000) * 100))}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TIER 2 ANIMATED DRAWER */}
        <div className={`grid transition-all duration-500 ease-in-out ${selectedTlId ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            {activeTl && (
              <div className="bg-zinc-950/95 border border-blue-500/40 rounded-2xl p-6 space-y-6 shadow-2xl">
                <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      Tier 2 — Squad Command Drawer
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      Commander {activeTl.full_name}&apos;s Squad ({displayedSmms.length} SMMs)
                    </h2>
                  </div>
                  <button onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400">
                    Close Squad View ✕
                  </button>
                </div>

                {/* SMM Handler Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayedSmms.map(smm => {
                    const isSmmSelected = selectedSmmId === smm.id;
                    const smmAssets = projectFilteredAssets.filter(a => a.smm_id === smm.id);
                    const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
                    const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
                    const totalEng = smmLogs.reduce((s, x) => s + (x.engagements || 0), 0);
                    const totalFol = smmLogs.reduce((s, x) => s + (x.total_followers || 0), 0);

                    return (
                      <div
                        key={smm.id}
                        onClick={() => {
                          if (isSmmSelected) {
                            setSelectedSmmId(null); setSelectedAssetId(null);
                          } else {
                            setSelectedSmmId(smm.id); setSelectedAssetId(null);
                          }
                        }}
                        className={`group cursor-pointer rounded-xl p-5 border transition-all duration-300 ${
                          isSmmSelected
                            ? "bg-gradient-to-b from-blue-950/50 to-black border-blue-400 shadow-lg"
                            : "bg-black/80 border-zinc-800 hover:border-blue-500/50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-white text-base">{smm.full_name}</h3>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleUpdateUserRow(smm.id, { is_locked: !smm.is_locked }); }}
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${smm.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
                            >
                              {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                            </button>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300">
                              {smmAssets.length} Assets
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">Countries: {smm.country}</p>
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                          <div><span className="text-zinc-500 block text-[9px]">IMPR</span><span className="text-blue-400 font-bold">{totalImpr.toLocaleString()}</span></div>
                          <div><span className="text-zinc-500 block text-[9px]">ENG</span><span className="text-purple-400 font-bold">{totalEng.toLocaleString()}</span></div>
                          <div><span className="text-zinc-500 block text-[9px]">FOLLOWERS</span><span className="text-emerald-400 font-bold">{totalFol.toLocaleString()}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TIER 3 ANIMATED DRAWER: ASSETS */}
                <div className={`grid transition-all duration-500 ease-in-out ${selectedSmmId ? "grid-rows-[1fr] opacity-100 pt-4 border-t border-zinc-800" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                  <div className="overflow-hidden space-y-4">
                    {activeSmm && (
                      <>
                        <h3 className="text-xl font-bold text-white">
                          Assets Managed by {activeSmm.full_name} ({displayedAssets.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {displayedAssets.map(asset => {
                            const isRevealed = !!revealedAssets[asset.id];
                            const isAssetSelected = selectedAssetId === asset.id;

                            return (
                              <div
                                key={asset.id}
                                onClick={() => setSelectedAssetId(isAssetSelected ? null : asset.id)}
                                className={`cursor-pointer rounded-xl p-5 border space-y-3 transition-all ${
                                  isAssetSelected ? "bg-purple-950/30 border-purple-400" : "bg-black border-zinc-800 hover:border-purple-500/50"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                    {asset.platform}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] })); }}
                                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300"
                                    >
                                      {isRevealed ? "🙈 Mask" : "🔓 Reveal"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleToggleAssetStatus(asset); }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                                    >
                                      {asset.status.toUpperCase()}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/30"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-bold text-white text-lg">{asset.account_id}</h4>
                                  <a href={asset.profile_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-400 hover:underline truncate block">
                                    {asset.profile_link}
                                  </a>
                                </div>

                                <div className="text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg space-y-1">
                                  <div><b>Pass:</b> <span className={isRevealed ? "text-emerald-300" : "blur-[4px] select-none"}>{asset.account_password}</span></div>
                                  <div><b>Email:</b> {asset.email}</div>
                                  <div><b>Email Pass:</b> <span className={isRevealed ? "text-emerald-300" : "blur-[4px] select-none"}>{asset.email_password}</span></div>
                                  <div><b>2FA:</b> <span className={isRevealed ? "text-amber-300" : "blur-[4px] select-none"}>{asset.two_fa_code || "None"}</span> • <b>Tel:</b> {asset.phone_number || "N/A"}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* TIER 4 ANIMATED DRAWER: WEEKLY METRICS LEDGER */}
                <div className={`grid transition-all duration-500 ease-in-out ${selectedAssetId ? "grid-rows-[1fr] opacity-100 pt-4 border-t border-zinc-800" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                  <div className="overflow-hidden">
                    {activeAsset && (
                      <div className="bg-black border border-emerald-500/40 rounded-xl p-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-bold text-white">
                            📈 Weekly Metrics Ledger — [{activeAsset.platform.toUpperCase()}] {activeAsset.account_id}
                          </h3>
                          <button onClick={() => setSelectedAssetId(null)} className="text-xs text-zinc-400 hover:text-white">Close Ledger ✕</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-zinc-300 font-mono">
                            <thead className="bg-zinc-900 text-zinc-400 uppercase">
                              <tr>
                                <th className="p-3">Week Of</th>
                                <th className="p-3">Impressions</th>
                                <th className="p-3">Engagements</th>
                                <th className="p-3">Eng %</th>
                                <th className="p-3">Likes</th>
                                <th className="p-3">Reposts</th>
                                <th className="p-3">Net Fol.</th>
                                <th className="p-3">Total Fol.</th>
                                <th className="p-3">Posts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                              {activeAssetMetrics.map(m => (
                                <tr key={m.id} className="hover:bg-zinc-900/60">
                                  <td className="p-3 font-bold text-white">{m.week_of}</td>
                                  <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                                  <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                                  <td className="p-3 text-emerald-400">{m.impressions > 0 ? ((m.engagements / m.impressions) * 100).toFixed(2) : "0.00"}%</td>
                                  <td className="p-3">{m.likes}</td>
                                  <td className="p-3">{m.shares_reposts}</td>
                                  <td className="p-3">{(m.followers_gained || 0) - (m.followers_lost || 0)}</td>
                                  <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                                  <td className="p-3">{m.posts_published}</td>
                                </tr>
                              ))}
                              {activeAssetMetrics.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-zinc-500">No weekly logs recorded for this Asset yet.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
