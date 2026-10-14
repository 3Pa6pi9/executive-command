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
      "Project", "Team Leader", "SMM Handler", "Platform", "Account ID", "Status", "Profile Link",
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

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm">Verifying Executive Vault Clearance...</div>;

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
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Master Admin Email" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Master Passcode" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
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
    : allSmms;

  const activeSmm = allSmms.find(s => s.id === selectedSmmId);
  const displayedAssets = selectedSmmId
    ? assets.filter(a => a.smm_id === selectedSmmId)
    : selectedTlId
      ? assets.filter(a => a.team_leader_id === selectedTlId)
      : assets;

  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeAssetMetrics = selectedAssetId ? metrics.filter(m => m.asset_id === selectedAssetId) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-6 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">Tier 1 — Executive God Mode</span>
            <h1 className="text-3xl font-bold text-white mt-2">Global Admin Command Center</h1>
            <p className="text-xs text-zinc-400">Team Leaders: {teamLeaders.length} • SMM Handlers: {allSmms.length} • Protected Assets: {assets.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white">
              <option value="All">All Projects / Campaigns</option>
              {uniqueProjects.map(proj => <option key={proj} value={proj}>{proj}</option>)}
            </select>
            <button onClick={handleExportMasterCSV} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg text-xs hover:bg-emerald-400">⬇ Export Master CSV</button>
            <button onClick={async () => { await supabase.auth.signOut(); setAdminProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">Lock & Sign Out</button>
          </div>
        </div>

        <form onSubmit={handleAddAdmin} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase text-emerald-400 mr-2">👑 Add Co-Admin:</span>
          <input type="text" required value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Admin Name" className="rounded-lg bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white" />
          <input type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="admin2@executive.com" className="rounded-lg bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white" />
          <input type="password" required value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Password" className="rounded-lg bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white" />
          <button type="submit" className="px-4 py-1.5 bg-white text-black font-bold rounded-lg text-xs hover:bg-zinc-200">+ Provision Admin</button>
          {adminMsg && <span className="text-xs text-emerald-400 ml-2">{adminMsg}</span>}
        </form>

        {/* LEVEL 1: TEAM LEADERS */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">1. Team Leaders (Click to Inspect Squad & Performance Chart)</h2>
            {selectedTlId && <button onClick={() => { setSelectedTlId(null); setSelectedSmmId(null); setSelectedAssetId(null); }} className="text-xs text-zinc-400 underline">Reset Filter</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {teamLeaders.map(tl => {
              const tlSmms = allSmms.filter(s => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
              const tlAssetIds = assets.filter(a => a.team_leader_id === tl.id || tlSmms.some(s => s.id === a.smm_id)).map(a => a.id);
              const tlLogs = metrics.filter(m => tlAssetIds.includes(m.asset_id));
              const impr = tlLogs.reduce((sum, x) => sum + (x.impressions || 0), 0);
              const eng = tlLogs.reduce((sum, x) => sum + (x.engagements || 0), 0);

              return (
                <div
                  key={tl.id}
                  onClick={() => { setSelectedTlId(tl.id); setSelectedSmmId(null); setSelectedAssetId(null); }}
                  className={`cursor-pointer bg-zinc-950 border p-5 rounded-xl transition-all ${selectedTlId === tl.id ? "border-emerald-500 ring-1 ring-emerald-500" : "border-zinc-800 hover:border-zinc-700"}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-white">{tl.full_name}</h3>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">{tlSmms.length} SMMs</span>
                  </div>
                  <p className="text-xs text-zinc-500">{tl.country}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-mono"><span className="text-zinc-400">Impr:</span><span className="text-blue-400 font-bold">{impr.toLocaleString()}</span></div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (impr / 100000) * 100)}%` }}></div></div>
                    <div className="flex justify-between text-xs font-mono"><span className="text-zinc-400">Eng:</span><span className="text-purple-400 font-bold">{eng.toLocaleString()}</span></div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (eng / 10000) * 100)}%` }}></div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEVEL 2: SMM MANAGERS */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
            2. SMM Handlers {activeTl ? `Under ${activeTl.full_name}` : "(All Squads)"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayedSmms.map(smm => {
              const smmAssets = assets.filter(a => a.smm_id === smm.id);
              const smmLogs = metrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
              const totalImpr = smmLogs.reduce((s, x) => s + (x.impressions || 0), 0);
              const totalFol = smmLogs.reduce((s, x) => s + (x.total_followers || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => { setSelectedSmmId(smm.id); setSelectedAssetId(null); }}
                  className={`cursor-pointer bg-zinc-950 border p-5 rounded-xl transition-all ${selectedSmmId === smm.id ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-800 hover:border-zinc-700"}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white text-base">{smm.full_name}</h3>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">{smmAssets.length} Assets</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Countries: {smm.country}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">IMPRESSIONS</span><span className="text-blue-400 font-bold">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">FOLLOWERS</span><span className="text-emerald-400 font-bold">{totalFol.toLocaleString()}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEVEL 3: ASSETS WITH CREDENTIAL MASKING */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400">
            3. Registered Social Media Assets {activeSmm ? `Managed by ${activeSmm.full_name}` : ""}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayedAssets.map(asset => {
              const isRevealed = !!revealedAssets[asset.id];
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`cursor-pointer bg-zinc-950 border p-5 rounded-xl space-y-2 transition-all ${selectedAssetId === asset.id ? "border-purple-500 ring-1 ring-purple-500" : "border-zinc-800 hover:border-zinc-700"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">{asset.platform}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setRevealedAssets(prev => ({ ...prev, [asset.id]: !prev[asset.id] })); }}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300"
                      >
                        {isRevealed ? "🙈 Mask Vault" : "🔓 Reveal Credentials"}
                      </button>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{asset.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-white text-lg">{asset.account_id}</h3>
                  <p className="text-xs text-zinc-400 truncate">{asset.profile_link}</p>
                  <div className="text-[11px] font-mono text-zinc-300 bg-zinc-900 p-2.5 rounded space-y-0.5">
                    <div><b>Pass:</b> {isRevealed ? asset.account_password : "••••••••••••"}</div>
                    <div><b>Email:</b> {asset.email} ({isRevealed ? asset.email_password : "••••••••"})</div>
                    <div><b>2FA:</b> {isRevealed ? (asset.two_fa_code || "None") : "••••••"} • <b>Tel:</b> {asset.phone_number || "N/A"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeAsset && (
          <div className="bg-zinc-950 border border-emerald-500/40 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Weekly Metrics Ledger for [{activeAsset.platform.toUpperCase()}] {activeAsset.account_id}</h3>
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
                    <tr key={m.id}>
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
                  {activeAssetMetrics.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-zinc-500">No weekly logs recorded for this asset yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
