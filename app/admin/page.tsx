"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

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
  
  const [selectedTlId, setSelectedTlId] = useState<string | null>(null);
  const [selectedSmmId, setSelectedSmmId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [revealedAssets, setRevealedAssets] = useState<Record<string, boolean>>({});

  // Global CRUD Modals State
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingMetric, setEditingMetric] = useState<any>(null);
  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [newAssetForm, setNewAssetForm] = useState({
    smm_id: "", team_leader_id: "", platform: "twitter", account_id: "",
    account_password: "", email: "", email_password: "", profile_link: "", project_name: "General Campaign"
  });

  // Executive Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "team_leader" | "smm">("team_leader");
  const [newAdminCountry, setNewAdminCountry] = useState("Africa");
  const [masterNewPass, setMasterNewPass] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  useEffect(() => {
    let channel: any;
    verifyAdminSession().then((isOk) => {
      if (!isOk) return;
      channel = supabase
        .channel("admin-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          triggerPulse();
          loadAllEnterpriseData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => {
          triggerPulse();
          loadAllEnterpriseData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => {
          triggerPulse();
          loadAllEnterpriseData();
        })
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const triggerPulse = () => {
    setLiveSyncPulse(true);
    setTimeout(() => setLiveSyncPulse(false), 1200);
  };

  const verifyAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return false; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      setAuthMsg("Security Violation: Only Master Admins are permitted inside the Executive Vault.");
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return setAuthMsg(error.message);

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "admin") {
      await supabase.auth.signOut();
      return setAuthMsg("Access Denied: You do not hold Admin clearance.");
    }

    setAdminProfile(prof);
    await loadAllEnterpriseData();
  };

  const loadAllEnterpriseData = async () => {
    const { data: p } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: a } = await supabase.from("social_assets").select("*").order("created_at", { ascending: false });
    const { data: m } = await supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false });
    setProfiles(p || []);
    setAssets(a || []);
    setMetrics(m || []);
  };

  // ADMIN CRUD: CREATE PERSONNEL
  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg("Creating personnel account...");
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "create",
        payload: {
          email: newAdminEmail.trim(),
          password: newAdminPass,
          role: newAdminRole,
          full_name: newAdminName,
          country: newAdminCountry,
          team_leader_id: selectedTlId
        }
      })
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMsg(`${newAdminRole.toUpperCase()} Created Live!`);
      setNewAdminName(""); setNewAdminEmail(""); setNewAdminPass("");
      loadAllEnterpriseData();
    } else {
      setAdminMsg("Error: " + data.error);
    }
  };

  // ADMIN CRUD: UPDATE PERSONNEL
  const handleSaveProfileEdit = async (e: React.FormEvent) => {
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
          is_locked: editingProfile.is_locked
        }
      })
    });
    setEditingProfile(null);
    loadAllEnterpriseData();
  };

  // ADMIN CRUD: DELETE PERSONNEL
  const handleDeletePersonnel = async (targetId: string, name: string) => {
    if (!confirm(`Permanently delete ${name} and all their associated records?`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "profile",
        action: "delete",
        payload: { targetId }
      })
    });
    if (selectedTlId === targetId) setSelectedTlId(null);
    if (selectedSmmId === targetId) setSelectedSmmId(null);
    loadAllEnterpriseData();
  };

  // ADMIN CRUD: CREATE ASSET
  const handleAdminCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "create",
        payload: { ...newAssetForm, status: "active" }
      })
    });
    setShowCreateAssetModal(false);
    loadAllEnterpriseData();
  };

  // ADMIN CRUD: UPDATE ASSET
  const handleAdminUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "update",
        payload: editingAsset
      })
    });
    setEditingAsset(null);
    loadAllEnterpriseData();
  };

  // ADMIN CRUD: DELETE ASSET
  const handleAdminDeleteAsset = async (assetId: string) => {
    if (!confirm("Permanently delete this Asset and its metrics?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "asset",
        action: "delete",
        payload: { id: assetId }
      })
    });
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    loadAllEnterpriseData();
  };

  // ADMIN CRUD: UPDATE & DELETE WEEKLY METRIC
  const handleAdminUpdateMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetric) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "metric",
        action: "update",
        payload: editingMetric
      })
    });
    setEditingMetric(null);
    loadAllEnterpriseData();
  };

  const handleAdminDeleteMetric = async (metricId: string) => {
    if (!confirm("Delete this weekly metric log?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: adminProfile.id,
        entity: "metric",
        action: "delete",
        payload: { id: metricId }
      })
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
    setAdminMsg(`Global Lock ${lockState ? "ENGAGED 🔒" : "RELEASED 🔓"} for all ${smmIds.length} SMMs!`);
  };

  const handleUpdateMasterPassword = async () => {
    if (!masterNewPass.trim()) return;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_password",
        userId: adminProfile.id,
        payload: { newPassword: masterNewPass.trim() }
      })
    });
    setMasterNewPass("");
    setAdminMsg("Master Admin password updated!");
  };

  const handleExportMasterCSV = () => {
    const headers = [
      "Project", "Team Leader", "SMM Handler", "Platform", "Asset ID", "Status", "Asset Profile Link",
      "Week Of", "Impressions", "Engagements", "Likes", "Reposts", "Comments",
      "Followers Gained", "Followers Lost", "Total Followers", "Posts Published", "Top Post Impr.",
      "Engagement %", "Net Followers", "Posts/Day"
    ];

    const filteredMetrics = metrics.filter(m => {
      const asset = assets.find(a => a.id === m.asset_id);
      if (!asset) return false;
      if (projectFilter !== "All" && asset.project_name !== projectFilter) return false;
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
        `"${asset.project_name || 'General'}"`, `"${tl.full_name || 'Unassigned'}"`, `"${smm.full_name || 'SMM'}"`,
        `"${asset.platform || ''}"`, `"${asset.account_id || ''}"`, `"${asset.status || ''}"`, `"${asset.profile_link || ''}"`,
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
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Master Admin Email" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white outline-none" />
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

  const activeTl = teamLeaders.find(t => t.id === selectedTlId);
  const displayedSmms = selectedTlId
    ? allSmms.filter(s => s.team_leader_id === selectedTlId || (s.team_leader_ids && s.team_leader_ids.includes(selectedTlId)))
    : [];

  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeAssetMetrics = selectedAssetId ? metrics.filter(m => m.asset_id === selectedAssetId) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Executive Bar */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                Tier 1 — Global Master CRUD
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Global Command Center</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setNewAssetForm({
                  ...newAssetForm,
                  team_leader_id: selectedTlId || (teamLeaders[0]?.id ?? ""),
                  smm_id: selectedSmmId || (allSmms[0]?.id ?? "")
                });
                setShowCreateAssetModal(true);
              }}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs"
            >
              + Create Asset
            </button>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none">
              <option value="All">All Campaigns</option>
              {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <button onClick={handleExportMasterCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">
              ⬇ Export Master CSV
            </button>
            <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 rounded-lg text-xs font-bold text-emerald-400">
              ⚙ Personnel & System CRUD
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {/* VIEW 1: TEAM LEADER GRID WITH INLINE EDIT / DELETE */}
        {!selectedTlId ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs uppercase tracking-wider font-bold text-zinc-400">
                Select any Team Leader to open their squad workspace (Or Edit / Delete TL inline)
              </p>
              <span className="text-xs text-zinc-500 font-mono">{teamLeaders.length} Squad Commanders • {allSmms.length} SMMs • {assets.length} Assets</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teamLeaders.map(tl => {
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
                    className="group cursor-pointer rounded-2xl p-6 bg-zinc-950 border border-zinc-800/90 hover:border-emerald-500 hover:-translate-y-1 transition-all duration-200"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-xl text-white group-hover:text-emerald-300">{tl.full_name}</h3>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {tlSmms.length} SMMs • {tlAssets.length} Assets
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 mt-1">Regions: {tl.country}</p>

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
                        <button onClick={() => handleDeletePersonnel(tl.id, tl.full_name)} className="text-red-400 hover:underline font-bold">🗑 Delete</button>
                      </div>
                      <span className="text-zinc-400 group-hover:text-emerald-300 font-bold">Open Squad →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VIEW 2: IN-PLACE TEAM LEADER WORKSPACE WITH SMM & ASSET CRUD */
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedTlId === tl.id ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tl.full_name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-zinc-950 border border-blue-500/40 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">
                      Active Squad Commander
                    </span>
                    <button onClick={() => setEditingProfile({ ...activeTl })} className="text-xs text-emerald-400 underline font-bold">✎ Edit TL</button>
                  </div>
                  <h2 className="text-3xl font-bold text-white">{activeTl.full_name}</h2>
                  <p className="text-xs text-zinc-400">Assigned Countries: {activeTl.country}</p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-black border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] text-zinc-500 block">SQUAD SMMs</span>
                      <span className="text-2xl font-bold text-blue-400 font-mono">{displayedSmms.length}</span>
                    </div>
                    <div className="bg-black border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] text-zinc-500 block">SQUAD ASSETS</span>
                      <span className="text-2xl font-bold text-purple-400 font-mono">
                        {assets.filter(a => a.team_leader_id === activeTl.id || displayedSmms.some(s => s.id === a.smm_id)).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {activeTl.full_name}&apos;s Squad Performance Chart
                  </h3>
                  {displayedSmms.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      {displayedSmms.map(smm => {
                        const smmAssets = assets.filter(a => a.smm_id === smm.id);
                        const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
                        const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
                        const maxSquadImpr = Math.max(1000, ...displayedSmms.map(m => {
                          const mAssets = assets.filter(a => a.smm_id === m.id);
                          return metrics.filter(log => mAssets.some(a => a.id === log.asset_id)).reduce((s, x) => s + (x.impressions || 0), 0);
                        }));
                        const widthPct = Math.min(100, Math.max(5, Math.round((totalImpr / maxSquadImpr) * 100)));

                        return (
                          <div key={smm.id} onClick={() => setSelectedSmmId(selectedSmmId === smm.id ? null : smm.id)} className="cursor-pointer group">
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-white group-hover:text-blue-400 font-bold">{smm.full_name} ({smmAssets.length} Assets)</span>
                              <span className="text-blue-400 font-bold">{totalImpr.toLocaleString()} Impr.</span>
                            </div>
                            <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-700" style={{ width: `${widthPct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 py-8 text-center">No SMMs registered under {activeTl.full_name} yet.</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    SMM Handlers Under {activeTl.full_name} (Click SMM to Unfold Assets • Edit or Delete Inline)
                  </h3>
                  <button onClick={() => { setNewAdminRole("smm"); setShowSettings(true); }} className="text-xs text-emerald-400 font-bold underline">
                    + Create SMM Under {activeTl.full_name}
                  </button>
                </div>

                <div className="space-y-3">
                  {displayedSmms.map(smm => {
                    const isSmmOpen = selectedSmmId === smm.id;
                    const smmAssets = assets.filter(a => a.smm_id === smm.id);
                    const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
                    const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
                    const totalEng = smmLogs.reduce((s, x) => s + (x.engagements || 0), 0);
                    const totalFol = smmLogs.reduce((s, x) => s + (x.total_followers || 0), 0);

                    return (
                      <div key={smm.id} className={`rounded-2xl border transition-all ${isSmmOpen ? "bg-zinc-950 border-blue-500" : "bg-zinc-950/80 border-zinc-800"}`}>
                        <div
                          onClick={() => setSelectedSmmId(isSmmOpen ? null : smm.id)}
                          className="cursor-pointer p-5 flex flex-wrap justify-between items-center gap-4"
                        >
                          <div>
                            <h4 className="font-bold text-lg text-white">{smm.full_name}</h4>
                            <p className="text-xs text-zinc-400">Countries: {smm.country} • Input: {smm.is_locked ? "🔒 Locked" : "🔓 Open"}</p>
                          </div>

                          <div className="flex items-center gap-5 font-mono text-xs">
                            <div><span className="text-zinc-500 block text-[10px]">ASSETS</span><span className="text-purple-400 font-bold text-sm">{smmAssets.length}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">IMPR</span><span className="text-blue-400 font-bold text-sm">{totalImpr.toLocaleString()}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">ENG</span><span className="text-purple-400 font-bold text-sm">{totalEng.toLocaleString()}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">FOLLOWERS</span><span className="text-emerald-400 font-bold text-sm">{totalFol.toLocaleString()}</span></div>
                            <div className="space-x-2 font-sans" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => setEditingProfile({ ...smm })} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">✎ Edit</button>
                              <button onClick={() => handleDeletePersonnel(smm.id, smm.full_name)} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold">🗑 Delete</button>
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
                                <div
                                  key={asset.id}
                                  onClick={() => setSelectedAssetId(asset.id)}
                                  className="group cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-purple-500 p-4 rounded-xl space-y-2 transition-all"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                      ASSET: {asset.platform}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                      {asset.status.toUpperCase()}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-white text-base">{asset.account_id}</h5>
                                  <p className="text-xs text-zinc-500 truncate">{asset.profile_link || "Pending Profile Link"}</p>
                                  <div className="pt-2 flex justify-between items-center text-[11px]" onClick={(e) => e.stopPropagation()}>
                                    <div className="space-x-2">
                                      <button onClick={() => setEditingAsset({ ...asset })} className="text-emerald-400 hover:underline font-bold">✎ Edit</button>
                                      <button onClick={() => handleAdminDeleteAsset(asset.id)} className="text-red-400 hover:underline font-bold">🗑 Delete</button>
                                    </div>
                                    <button onClick={() => setSelectedAssetId(asset.id)} className="text-purple-400 font-bold">Vault & Logs →</button>
                                  </div>
                                </div>
                              ))}
                              {smmAssets.length === 0 && (
                                <div className="col-span-3 text-xs text-zinc-500 py-4 text-center">No Assets registered by {smm.full_name} yet.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

      </div>

      {/* ADMIN MODAL: EDIT PERSONNEL PROFILE (TL OR SMM) */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingProfile(null)}>
          <form onSubmit={handleSaveProfileEdit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Personnel Profile (Global Admin CRUD)</h3>
              <button type="button" onClick={() => setEditingProfile(null)} className="text-xs text-zinc-400">✕</button>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Full Name</label>
              <input type="text" required value={editingProfile.full_name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
              <input type="text" required value={editingProfile.country || ""} onChange={(e) => setEditingProfile({ ...editingProfile, country: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2.5 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">System Role</label>
                <select value={editingProfile.role} onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2.5 text-sm text-white uppercase">
                  <option value="smm">SMM Handler</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="admin">Master Admin</option>
                </select>
              </div>
              {editingProfile.role === "smm" && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Reassign Team Leader</label>
                  <select value={editingProfile.team_leader_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, team_leader_id: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2.5 text-sm text-white">
                    {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Personnel Changes</button>
          </form>
        </div>
      )}

      {/* ADMIN MODAL: CREATE NEW ASSET */}
      {showCreateAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreateAssetModal(false)}>
          <form onSubmit={handleAdminCreateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-purple-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Create & Assign New Social Asset</h3>
              <button type="button" onClick={() => setShowCreateAssetModal(false)} className="text-xs text-zinc-400">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader</label>
                <select value={newAssetForm.team_leader_id} onChange={(e) => setNewAssetForm({ ...newAssetForm, team_leader_id: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                  {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Assign SMM</label>
                <select value={newAssetForm.smm_id} onChange={(e) => setNewAssetForm({ ...newAssetForm, smm_id: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                  {allSmms.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Platform</label>
                <select value={newAssetForm.platform} onChange={(e) => setNewAssetForm({ ...newAssetForm, platform: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" required placeholder="Asset ID / @Handle" value={newAssetForm.account_id} onChange={(e) => setNewAssetForm({ ...newAssetForm, account_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Asset Password" value={newAssetForm.account_password} onChange={(e) => setNewAssetForm({ ...newAssetForm, account_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="email" placeholder="Asset Email" value={newAssetForm.email} onChange={(e) => setNewAssetForm({ ...newAssetForm, email: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Email Password" value={newAssetForm.email_password} onChange={(e) => setNewAssetForm({ ...newAssetForm, email_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <input type="url" placeholder="Asset Profile Link" value={newAssetForm.profile_link} onChange={(e) => setNewAssetForm({ ...newAssetForm, profile_link: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 bg-purple-600 text-white font-bold rounded-lg text-xs">Create Asset Live</button>
          </form>
        </div>
      )}

      {/* ADMIN MODAL: EDIT EXISTING ASSET */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingAsset(null)}>
          <form onSubmit={handleAdminUpdateAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit / Reassign Social Asset (Admin CRUD)</h3>
              <button type="button" onClick={() => setEditingAsset(null)} className="text-xs text-zinc-400">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400">Reassign TL</label>
                <select value={editingAsset.team_leader_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, team_leader_id: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                  {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400">Reassign SMM</label>
                <select value={editingAsset.smm_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, smm_id: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                  {allSmms.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400">Status</label>
                <select value={editingAsset.status} onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value })} className="w-full mt-1 rounded bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                  <option value="active">ACTIVE</option>
                  <option value="suspended">SUSPENDED</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Asset ID" value={editingAsset.account_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_id: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Asset Password" value={editingAsset.account_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="email" placeholder="Email" value={editingAsset.email || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" placeholder="Email Pass" value={editingAsset.email_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email_password: e.target.value })} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <input type="url" placeholder="Profile Link" value={editingAsset.profile_link || ""} onChange={(e) => setEditingAsset({ ...editingAsset, profile_link: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Asset Changes</button>
          </form>
        </div>
      )}

      {/* SLIDE-OVER RIGHT INSPECTOR DRAWER FOR SELECTED ASSET & METRICS CRUD */}
      {activeAsset && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={() => setSelectedAssetId(null)}>
          <div
            className="w-full max-w-2xl bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ASSET VAULT: {activeAsset.platform}
                </span>
                <h3 className="text-2xl font-bold text-white mt-2">{activeAsset.account_id}</h3>
                <a href={activeAsset.profile_link} target="_blank" className="text-xs text-blue-400 underline">{activeAsset.profile_link}</a>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingAsset({ ...activeAsset })} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300 font-bold">
                  ✎ Edit Asset
                </button>
                <button onClick={() => handleAdminDeleteAsset(activeAsset.id)} className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-xs text-red-300 font-bold">
                  🗑 Delete
                </button>
                <button onClick={() => setSelectedAssetId(null)} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white">
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-zinc-400">Encrypted Asset Credentials</span>
                <button
                  onClick={() => setRevealedAssets(prev => ({ ...prev, [activeAsset.id]: !prev[activeAsset.id] }))}
                  className="px-3 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold"
                >
                  {revealedAssets[activeAsset.id] ? "🙈 Mask Credentials" : "🔓 Reveal Credentials"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-zinc-300 pt-2">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET PASSWORD</span>
                  <span className={revealedAssets[activeAsset.id] ? "text-emerald-400" : "blur-[4px] select-none"}>{activeAsset.account_password || "N/A"}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET 2FA CODE</span>
                  <span className={revealedAssets[activeAsset.id] ? "text-amber-400" : "blur-[4px] select-none"}>{activeAsset.two_fa_code || "None"}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET EMAIL</span>
                  <span>{activeAsset.email || "N/A"}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET EMAIL PASSWORD</span>
                  <span className={revealedAssets[activeAsset.id] ? "text-emerald-400" : "blur-[4px] select-none"}>{activeAsset.email_password || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Weekly Metrics History with Admin Edit & Delete CRUD */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase text-emerald-400">Weekly Metrics History (Admin Edit / Delete CRUD)</h4>

              {editingMetric && (
                <form onSubmit={handleAdminUpdateMetric} className="grid grid-cols-4 gap-2 bg-black p-3 rounded-xl border border-emerald-500/40 text-xs">
                  <input type="number" placeholder="Impressions" value={editingMetric.impressions} onChange={(e) => setEditingMetric({ ...editingMetric, impressions: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <input type="number" placeholder="Engagements" value={editingMetric.engagements} onChange={(e) => setEditingMetric({ ...editingMetric, engagements: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <input type="number" placeholder="Total Fol" value={editingMetric.total_followers} onChange={(e) => setEditingMetric({ ...editingMetric, total_followers: parseInt(e.target.value) || 0 })} className="rounded bg-zinc-900 p-2 text-white" />
                  <button type="submit" className="bg-emerald-500 text-black font-bold rounded">Save Row</button>
                </form>
              )}

              <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs text-zinc-300 font-mono">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Week</th>
                      <th className="p-3">Impr</th>
                      <th className="p-3">Eng</th>
                      <th className="p-3">Fol.</th>
                      <th className="p-3">Posts</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-black">
                    {activeAssetMetrics.map(m => (
                      <tr key={m.id}>
                        <td className="p-3 font-bold text-white">{m.week_of}</td>
                        <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                        <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                        <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                        <td className="p-3">{m.posts_published}</td>
                        <td className="p-3 text-right space-x-2 font-sans">
                          <button onClick={() => setEditingMetric({ ...m })} className="text-emerald-400 hover:underline">Edit</button>
                          <button onClick={() => handleAdminDeleteMetric(m.id)} className="text-red-400 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {activeAssetMetrics.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-zinc-500">No weekly metrics logged yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER EXECUTIVE SYSTEM & PERSONNEL CRUD DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Tier 1 — Master Control</span>
                <h2 className="text-xl font-bold text-white">Executive System & Personnel CRUD</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-zinc-900 text-xs text-zinc-400">✕ Close</button>
            </div>

            {adminMsg && <div className="p-3 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">{adminMsg}</div>}

            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">1. Global Agency Metric Input Lock</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleGlobalLockAll(true)} className="py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black font-bold rounded-lg text-xs">
                  🔒 Lock All Agency SMMs
                </button>
                <button onClick={() => handleGlobalLockAll(false)} className="py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black font-bold rounded-lg text-xs">
                  🔓 Unlock All Agency SMMs
                </button>
              </div>
            </div>

            <form onSubmit={handleAddPersonnel} className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">2. Create New Personnel Account (Admin / TL / SMM)</h3>
              <div className="grid grid-cols-3 gap-2">
                <select value={newAdminRole} onChange={(e: any) => setNewAdminRole(e.target.value)} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white">
                  <option value="team_leader">Role: Team Leader</option>
                  <option value="smm">Role: SMM Handler</option>
                  <option value="admin">Role: Co-Admin</option>
                </select>
                <input type="text" required value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Full Name" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                <input type="text" required value={newAdminCountry} onChange={(e) => setNewAdminCountry(e.target.value)} placeholder="Countries" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="user@executive.com" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                <input type="password" required value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Password" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              </div>
              <button type="submit" className="w-full py-2 bg-emerald-500 text-black font-bold rounded text-xs">
                + Create Personnel Account Live
              </button>
            </form>

            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">3. Update Your Master Admin Passcode</h3>
              <div className="flex gap-2">
                <input type="password" value={masterNewPass} onChange={(e) => setMasterNewPass(e.target.value)} placeholder="New Master Passcode" className="flex-1 rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                <button type="button" onClick={handleUpdateMasterPassword} className="px-4 py-2 bg-white text-black font-bold rounded text-xs">Update</button>
              </div>
            </div>

            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">4. Global Personnel Directory — Read / Edit / Delete ({profiles.length})</h3>
              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-900 text-xs">
                {profiles.map(p => (
                  <div key={p.id} className="py-2.5 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-bold text-white">{p.full_name}</span>
                      <span className="text-zinc-500 ml-2">[{p.role.toUpperCase()}] • {p.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setShowSettings(false); setEditingProfile({ ...p }); }} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">
                        ✎ Edit
                      </button>
                      {p.id !== adminProfile.id && (
                        <button onClick={() => handleDeletePersonnel(p.id, p.full_name)} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-red-400 font-bold">
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
