"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminCommandCenter() {
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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

  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  useEffect(() => {
    verifyAdminSession();
  }, []);

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

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg("Provisioning new Admin...");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newAdminEmail.trim(),
        password: newAdminPass,
        role: "admin",
        full_name: newAdminName,
        country: "Global"
      })
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMsg("Co-Admin Provisioned!");
      setNewAdminName(""); setNewAdminEmail(""); setNewAdminPass("");
      loadAllEnterpriseData();
    } else {
      setAdminMsg("Error: " + data.error);
    }
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
    ? assets.filter(a => a.smm_id === selectedSmmId)
    : [];

  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeAssetMetrics = selectedAssetId ? metrics.filter(m => m.asset_id === selectedAssetId) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Executive Bar */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-6 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Tier 1 — Executive God Mode
            </span>
            <h1 className="text-3xl font-bold text-white mt-2">Global Admin Command Center</h1>
            <p className="text-xs text-zinc-400">Team Leaders: {teamLeaders.length} • SMM Handlers: {allSmms.length} • Registered Assets: {assets.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs text-white transition-all outline-none">
              <option value="All">All Projects / Campaigns</option>
              {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <button onClick={handleExportMasterCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 hover:-translate-y-0.5 active:scale-95 text-black font-bold rounded-lg text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              ⬇ Export Master CSV
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-lg text-xs text-zinc-400 hover:text-red-400 transition-all">
              Lock & Sign Out
            </button>
          </div>
        </div>

        {/* Add Co-Admin Bar */}
        <form onSubmit={handleAddAdmin} className="bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl flex flex-wrap items-center gap-3 transition-all duration-300">
          <span className="text-xs font-bold uppercase text-emerald-400 mr-2">👑 Provision Co-Admin:</span>
          <input type="text" required value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Admin Name" className="rounded-lg bg-black border border-zinc-800 focus:border-emerald-500 px-3 py-1.5 text-xs text-white outline-none transition-all" />
          <input type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="admin2@executive.com" className="rounded-lg bg-black border border-zinc-800 focus:border-emerald-500 px-3 py-1.5 text-xs text-white outline-none transition-all" />
          <input type="password" required value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Password" className="rounded-lg bg-black border border-zinc-800 focus:border-emerald-500 px-3 py-1.5 text-xs text-white outline-none transition-all" />
          <button type="submit" className="px-4 py-1.5 bg-white hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all active:scale-95">+ Add Admin</button>
          {adminMsg && <span className="text-xs text-emerald-400 ml-2 animate-pulse">{adminMsg}</span>}
        </form>

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
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span>1. Select a Team Leader to Unfold Squad & Performance Chart</span>
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
              const tlAssets = assets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id));
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
                      : "bg-zinc-950 border-zinc-800/90 hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-[0_10px_25px_-10px_rgba(16,185,129,0.2)]"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${isSelected ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-zinc-700 group-hover:bg-emerald-400"}`}></span>
                      <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">{tl.full_name}</h3>
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border transition-all ${isSelected ? "bg-emerald-500 text-black border-emerald-400" : "bg-blue-500/15 text-blue-300 border-blue-500/30"}`}>
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

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex justify-between items-center text-[11px] text-zinc-400 group-hover:text-emerald-300 transition-colors">
                    <span>{isSelected ? "Squad Drawer Open" : "Click to Unfold SMM Squad"}</span>
                    <span className={`transform transition-transform duration-300 font-bold ${isSelected ? "rotate-180 text-emerald-400" : "group-hover:translate-x-1"}`}>
                      {isSelected ? "▲" : "→"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TIER 2 ANIMATED DRAWER: TEAM LEADER PERFORMANCE CHART + SMM HANDLERS */}
        <div className={`grid transition-all duration-500 ease-in-out ${selectedTlId ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            {activeTl && (
              <div className="bg-zinc-950/95 border border-blue-500/40 rounded-2xl p-6 space-y-6 shadow-[0_0_45px_-15px_rgba(59,130,246,0.3)] relative">
                <div className="absolute top-0 left-8 w-16 h-1 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-b"></div>

                {/* Squad Performance Breakdown Chart */}
                <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      Tier 2 — Squad Command Drawer
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      Commander {activeTl.full_name}&apos;s Squad & Performance Chart
                    </h2>
                    <p className="text-xs text-zinc-400">Click any SMM Handler card below to unfold their managed Social Media Assets</p>
                  </div>
                  <button onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-400 transition-all">
                    Close Squad View ✕
                  </button>
                </div>

                {/* Visual Comparative Bar Chart for SMMs under this TL */}
                {displayedSmms.length > 0 && (
                  <div className="bg-black/60 border border-zinc-800/90 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold uppercase text-zinc-400">Squad Member Comparative Performance Chart</div>
                    <div className="space-y-2.5">
                      {displayedSmms.map(smm => {
                        const smmAssets = assets.filter(a => a.smm_id === smm.id);
                        const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
                        const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
                        const maxSquadImpr = Math.max(1000, ...displayedSmms.map(m => {
                          const mAssets = assets.filter(a => a.smm_id === m.id);
                          return metrics.filter(log => mAssets.some(a => a.id === log.asset_id)).reduce((s, x) => s + (x.impressions || 0), 0);
                        }));
                        const widthPct = Math.min(100, Math.max(4, Math.round((totalImpr / maxSquadImpr) * 100)));

                        return (
                          <div key={smm.id} onClick={() => { setSelectedSmmId(smm.id); setSelectedAssetId(null); }} className="cursor-pointer group">
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-zinc-300 group-hover:text-blue-400 transition-colors font-bold">{smm.full_name} ({smmAssets.length} Assets)</span>
                              <span className="text-blue-400">{totalImpr.toLocaleString()} Impr.</span>
                            </div>
                            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 transition-all duration-1000" style={{ width: `${widthPct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SMM Handler Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayedSmms.map(smm => {
                    const isSmmSelected = selectedSmmId === smm.id;
                    const smmAssets = assets.filter(a => a.smm_id === smm.id);
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
                        className={`group cursor-pointer rounded-xl p-5 border transition-all duration-300 transform ${
                          isSmmSelected
                            ? "bg-gradient-to-b from-blue-950/50 to-black border-blue-400 -translate-y-1 shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] ring-1 ring-blue-400/50"
                            : "bg-black/80 border-zinc-800 hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-lg"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">{smm.full_name}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${isSmmSelected ? "bg-blue-500 text-black" : "bg-purple-500/20 text-purple-300"}`}>
                            {smmAssets.length} Assets
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">Countries: {smm.country}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Platforms: {(smm.platforms || []).join(", ").toUpperCase() || "ALL"}</p>

                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                          <div><span className="text-zinc-500 block text-[9px]">IMPR</span><span className="text-blue-400 font-bold">{totalImpr.toLocaleString()}</span></div>
                          <div><span className="text-zinc-500 block text-[9px]">ENG</span><span className="text-purple-400 font-bold">{totalEng.toLocaleString()}</span></div>
                          <div><span className="text-zinc-500 block text-[9px]">FOLLOWERS</span><span className="text-emerald-400 font-bold">{totalFol.toLocaleString()}</span></div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-zinc-900 flex justify-between items-center text-[11px] text-zinc-400 group-hover:text-blue-300">
                          <span>{isSmmSelected ? "Assets Unfolded Below" : "Click to Unfold Assets"}</span>
                          <span className={`transition-transform duration-300 ${isSmmSelected ? "rotate-180 text-blue-400" : "group-hover:translate-x-1"}`}>
                            {isSmmSelected ? "▲" : "→"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {displayedSmms.length === 0 && (
                    <div className="col-span-3 text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                      No SMM Handlers have registered under Commander {activeTl.full_name} yet.
                    </div>
                  )}
                </div>

                {/* TIER 3 ANIMATED DRAWER: ASSETS MANAGED BY SELECTED SMM */}
                <div className={`grid transition-all duration-500 ease-in-out ${selectedSmmId ? "grid-rows-[1fr] opacity-100 pt-4 border-t border-zinc-800" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                  <div className="overflow-hidden space-y-4">
                    {activeSmm && (
                      <>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                              Tier 3 — Handler Asset Vault
                            </span>
                            <h3 className="text-xl font-bold text-white mt-1">
                              Social Media Assets Managed by {activeSmm.full_name} ({displayedAssets.length})
                            </h3>
                          </div>
                          <button onClick={() => { setSelectedSmmId(null); setSelectedAssetId(null); }} className="text-xs text-zinc-400 hover:text-white underline">
                            Collapse Assets ▲
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {displayedAssets.map(asset => {
                            const isRevealed = !!revealedAssets[asset.id];
                            const isAssetSelected = selectedAssetId === asset.id;

                            return (
                              <div
                                key={asset.id}
                                onClick={() => setSelectedAssetId(isAssetSelected ? null : asset.id)}
                                className={`group cursor-pointer rounded-xl p-5 border space-y-3 transition-all duration-300 transform ${
                                  isAssetSelected
                                    ? "bg-gradient-to-b from-purple-950/50 to-black border-purple-400 -translate-y-1 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.45)]"
                                    : "bg-black border-zinc-800 hover:border-purple-500/50 hover:-translate-y-1"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    ASSET: {asset.platform}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] })); }}
                                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 transition-all"
                                    >
                                      {isRevealed ? "🙈 Mask" : "🔓 Reveal"}
                                    </button>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                      {asset.status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors">{asset.account_id}</h4>
                                  <a href={asset.profile_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-400 hover:underline truncate block">
                                    {asset.profile_link}
                                  </a>
                                </div>

                                <div className="text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg space-y-1">
                                  <div><b>Pass:</b> <span className={`transition-all duration-300 ${isRevealed ? "blur-0 text-emerald-300" : "blur-[4px] select-none"}`}>{asset.account_password}</span></div>
                                  <div><b>Email:</b> {asset.email}</div>
                                  <div><b>Email Pass:</b> <span className={`transition-all duration-300 ${isRevealed ? "blur-0 text-emerald-300" : "blur-[4px] select-none"}`}>{asset.email_password}</span></div>
                                  <div><b>2FA:</b> <span className={`transition-all duration-300 ${isRevealed ? "blur-0 text-amber-300" : "blur-[4px] select-none"}`}>{asset.two_fa_code || "None"}</span> • <b>Tel:</b> {asset.phone_number || "N/A"}</div>
                                </div>

                                <div className="text-[11px] text-zinc-400 group-hover:text-purple-300 flex justify-between items-center pt-1">
                                  <span>{isAssetSelected ? "Viewing Weekly Ledger Below" : "Click to Inspect Weekly Ledger"}</span>
                                  <span>{isAssetSelected ? "▲" : "▼"}</span>
                                </div>
                              </div>
                            );
                          })}
                          {displayedAssets.length === 0 && (
                            <div className="col-span-3 text-center py-6 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                              No Assets registered by {activeSmm.full_name} yet.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* TIER 4 ANIMATED DRAWER: WEEKLY METRICS LEDGER FOR SELECTED ASSET */}
                <div className={`grid transition-all duration-500 ease-in-out ${selectedAssetId ? "grid-rows-[1fr] opacity-100 pt-4 border-t border-zinc-800" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                  <div className="overflow-hidden">
                    {activeAsset && (
                      <div className="bg-black border border-emerald-500/40 rounded-xl p-6 space-y-4 shadow-2xl">
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
                                <tr key={m.id} className="hover:bg-zinc-900/60 transition-colors">
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
