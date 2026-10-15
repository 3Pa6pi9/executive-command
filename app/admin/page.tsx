"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

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

  // Executive Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "team_leader">("admin");
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
    if (!session) {
      setIsCheckingAuth(false);
      return false;
    }

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

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg("Provisioning account...");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newAdminEmail.trim(),
        password: newAdminPass,
        role: newAdminRole,
        full_name: newAdminName,
        country: "Global"
      })
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMsg(`${newAdminRole.toUpperCase()} Provisioned Live!`);
      setNewAdminName(""); setNewAdminEmail(""); setNewAdminPass("");
    } else {
      setAdminMsg("Error: " + data.error);
    }
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

  const handleChangeUserRole = async (targetUserId: string, newRole: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admin_manage_user", payload: { targetUserId, newRole } })
    });
    setAdminMsg("Personnel role updated live!");
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
                Executive God Mode
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">Global Command Center</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none">
              <option value="All">All Campaigns</option>
              {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <button onClick={handleExportMasterCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">
              ⬇ Export Master CSV
            </button>
            <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 rounded-lg text-xs font-bold text-emerald-400">
              ⚙ System & Personnel Settings
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {/* VIEW 1: TEAM LEADER GRID (IN-PLACE STAGE MORPHING) */}
        {!selectedTlId ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs uppercase tracking-wider font-bold text-zinc-400">
                Select any Team Leader to open their live workspace right here
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

                    <div className="mt-5 pt-3 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-400 group-hover:text-emerald-300">
                      <span>Open Squad Workspace</span>
                      <span className="font-bold">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VIEW 2: IN-PLACE TEAM LEADER WORKSPACE */
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
                  <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">
                    Active Squad Commander
                  </span>
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
                    {activeTl.full_name}&apos;s Squad Performance Chart (Live Synced)
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  SMM Handlers Under {activeTl.full_name} (Click any SMM to unfold their Assets inline)
                </h3>

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

                          <div className="flex items-center gap-6 font-mono text-xs">
                            <div><span className="text-zinc-500 block text-[10px]">ASSETS</span><span className="text-purple-400 font-bold text-sm">{smmAssets.length}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">IMPR</span><span className="text-blue-400 font-bold text-sm">{totalImpr.toLocaleString()}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">ENG</span><span className="text-purple-400 font-bold text-sm">{totalEng.toLocaleString()}</span></div>
                            <div><span className="text-zinc-500 block text-[10px]">FOLLOWERS</span><span className="text-emerald-400 font-bold text-sm">{totalFol.toLocaleString()}</span></div>
                            <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 font-sans font-bold">
                              {isSmmOpen ? "Hide Assets ▲" : `Inspect ${smmAssets.length} Assets ▼`}
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
                                  <div className="pt-2 flex justify-between items-center text-[11px] text-purple-400 font-bold">
                                    <span>Open Vault & Weekly Ledger</span>
                                    <span>→</span>
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

      {/* SLIDE-OVER RIGHT INSPECTOR DRAWER FOR SELECTED ASSET */}
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
              <button onClick={() => setSelectedAssetId(null)} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white">
                ✕ Close Inspector
              </button>
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
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET COUNTRY</span>
                  <span>{activeAsset.country_language || "N/A"}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 block">ASSET PHONE</span>
                  <span>{activeAsset.phone_number || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase text-emerald-400">Weekly Metrics History</h4>
              <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs text-zinc-300 font-mono">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Week</th>
                      <th className="p-3">Impr</th>
                      <th className="p-3">Eng</th>
                      <th className="p-3">Eng %</th>
                      <th className="p-3">Fol.</th>
                      <th className="p-3">Posts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-black">
                    {activeAssetMetrics.map(m => (
                      <tr key={m.id}>
                        <td className="p-3 font-bold text-white">{m.week_of}</td>
                        <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                        <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                        <td className="p-3 text-emerald-400">{m.impressions > 0 ? ((m.engagements / m.impressions) * 100).toFixed(2) : "0.00"}%</td>
                        <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                        <td className="p-3">{m.posts_published}</td>
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

      {/* SLIDE-OVER EXECUTIVE SYSTEM & PERSONNEL SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-zinc-950 border-l border-emerald-500/40 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Tier 1 — Master Control</span>
                <h2 className="text-xl font-bold text-white">Executive System & Personnel Settings</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-zinc-900 text-xs text-zinc-400">✕ Close</button>
            </div>

            {adminMsg && <div className="p-3 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">{adminMsg}</div>}

            {/* 1. Global Reporting Lock Controls */}
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">1. Global Agency Metric Input Lock</h3>
              <p className="text-xs text-zinc-400">Instantly lock or unlock weekly metric submissions for every SMM Handler across all 9 squads in real time.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleGlobalLockAll(true)} className="py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black font-bold rounded-lg text-xs transition-all">
                  🔒 Lock All Agency SMMs
                </button>
                <button onClick={() => handleGlobalLockAll(false)} className="py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black font-bold rounded-lg text-xs transition-all">
                  🔓 Unlock All Agency SMMs
                </button>
              </div>
            </div>

            {/* 2. Provision New Admin or Team Leader */}
            <form onSubmit={handleAddPersonnel} className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">2. Provision Co-Admin or Team Leader</h3>
              <div className="grid grid-cols-2 gap-2">
                <select value={newAdminRole} onChange={(e: any) => setNewAdminRole(e.target.value)} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white">
                  <option value="admin">Role: Master Co-Admin</option>
                  <option value="team_leader">Role: Team Leader</option>
                </select>
                <input type="text" required value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Full Name" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="user@executive.com" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                <input type="password" required value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Password" className="rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
              </div>
              <button type="submit" className="w-full py-2 bg-emerald-500 text-black font-bold rounded text-xs">
                + Provision Account Live
              </button>
            </form>

            {/* 3. Master Admin Password Update */}
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">3. Update Your Master Admin Passcode</h3>
              <div className="flex gap-2">
                <input type="password" value={masterNewPass} onChange={(e) => setMasterNewPass(e.target.value)} placeholder="New Master Passcode" className="flex-1 rounded bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
                <button type="button" onClick={handleUpdateMasterPassword} className="px-4 py-2 bg-white text-black font-bold rounded text-xs">Update</button>
              </div>
            </div>

            {/* 4. Personnel Directory & Role Management */}
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-emerald-400">4. Personnel Role & Clearance Directory ({profiles.length})</h3>
              <div className="max-h-64 overflow-y-auto divide-y divide-zinc-900 text-xs">
                {profiles.map(p => (
                  <div key={p.id} className="py-2.5 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-bold text-white">{p.full_name}</span>
                      <span className="text-zinc-500 ml-2">({p.country})</span>
                    </div>
                    <select
                      value={p.role}
                      onChange={(e) => handleChangeUserRole(p.id, e.target.value)}
                      className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px] text-emerald-300 font-bold uppercase"
                    >
                      <option value="smm">SMM</option>
                      <option value="team_leader">TEAM LEADER</option>
                      <option value="admin">ADMIN</option>
                    </select>
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
