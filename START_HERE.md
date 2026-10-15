]633;E;echo "# Current Codespace State";33e124d1-f0a4-407f-94f6-18cd19456735]633;C# Current Codespace State
## File Tree
```text
.
./AGENTS.md
./CLAUDE.md
./README.md
./START_HERE.md
./app
./app/admin
./app/admin/page.tsx
./app/api
./app/api/log
./app/api/managers
./app/api/register
./app/api/seed
./app/api/team-leaders
./app/api/twitter
./app/favicon.ico
./app/globals.css
./app/layout.tsx
./app/log
./app/log/page.tsx
./app/page.tsx
./app/smm
./app/smm/page.tsx
./app/team-leader
./app/team-leader/page.tsx
./components
./components.json
./components/theme-provider.tsx
./components/ui
./components/ui/avatar.tsx
./components/ui/button.tsx
./components/ui/card.tsx
./components/ui/input.tsx
./components/ui/table.tsx
./create-users.js
./eslint.config.mjs
./hooks
./lib
./lib/supabase.ts
./lib/utils.ts
./next-env.d.ts
./next.config.ts
./package-lock.json
./package.json
./postcss.config.mjs
./public
./tsconfig.json
```
## package.json
```json
{
  "name": "executive-command",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write \"**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.8.0",
    "@supabase/supabase-js": "^2.117.2",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.4.0",
    "lucide-react": "^1.50.0",
    "next": "16.3.6",
    "next-themes": "^0.4.6",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "shadcn": "^4.21.1",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.6",
    "prettier": "^3.9.9",
    "prettier-plugin-tailwindcss": "^0.8.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```
## Current Source Files
### ./app/admin/page.tsx
```
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
```
### ./app/globals.css
```
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: var(--font-sans);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    }
  body {
    @apply bg-background text-foreground;
    }
  html {
    @apply font-sans;
    }
}```
### ./app/layout.tsx
```
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```
### ./app/smm/page.tsx
```
"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const COUNTRY_OPTIONS = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function SMMDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [selectedTl, setSelectedTl] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "register" | "assets">("log");
  const [statusMsg, setStatusMsg] = useState("");

  // 9 Ordered Asset Registration Fields
  const [regPlatform, setRegPlatform] = useState("twitter");
  const [regTlId, setRegTlId] = useState("");
  const [regProject, setRegProject] = useState("General Campaign");
  const [profileLink, setProfileLink] = useState("");
  const [bio, setBio] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [countryLanguage, setCountryLanguage] = useState(COUNTRY_OPTIONS[0]);
  const [phoneNumber, setPhoneNumber] = useState("");

  // Weekly Asset Metrics Form State
  const [weekOf, setWeekOf] = useState(new Date().toISOString().split("T")[0]);
  const [impressions, setImpressions] = useState("");
  const [engagements, setEngagements] = useState("");
  const [likes, setLikes] = useState("");
  const [sharesReposts, setSharesReposts] = useState("");
  const [comments, setComments] = useState("");
  const [followersGained, setFollowersGained] = useState("");
  const [followersLost, setFollowersLost] = useState("");
  const [totalFollowers, setTotalFollowers] = useState("");
  const [postsPublished, setPostsPublished] = useState("");
  const [topPostImpr, setTopPostImpr] = useState("");

  useEffect(() => {
    initSMM();
  }, []);

  const initSMM = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "smm") {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
    setProfile(prof);

    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    const tls = json.teamLeaders || [];
    if (tls.length > 0) {
      const assignedIds = prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : (prof.team_leader_id ? [prof.team_leader_id] : []);
      const myTls = tls.filter((t: any) => assignedIds.includes(t.id));
      const finalTls = myTls.length > 0 ? myTls : tls;
      setTeamLeaders(finalTls);
      if (finalTls.length > 0) {
        setSelectedTl("all");
        setRegTlId(finalTls[0].id);
      }
    }

    await loadAssets(session.user.id);
  };

  const loadAssets = async (smmId: string) => {
    const { data } = await supabase.from("social_assets").select("*").eq("smm_id", smmId).order("created_at", { ascending: false });
    if (data) {
      setAssets(data);
      if (data.length > 0 && !selectedAssetId) {
        setSelectedAssetId(data[0].id);
        loadMetrics(data[0].id);
      }
    }
  };

  const loadMetrics = async (assetId: string) => {
    if (!assetId) return;
    const { data } = await supabase.from("weekly_metrics").select("*").eq("asset_id", assetId).order("week_of", { ascending: false });
    if (data) setMetricsHistory(data);
  };

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Registering new Asset into vault...");
    const { error } = await supabase.from("social_assets").insert([{
      smm_id: profile.id,
      team_leader_id: regTlId || profile.team_leader_id,
      platform: regPlatform,
      project_name: regProject,
      status: "active",
      profile_link: profileLink.trim(),
      bio: bio.trim(),
      account_id: accountId.trim(),
      account_password: accountPassword,
      email: email.trim(),
      email_password: emailPassword,
      two_fa_code: twoFaCode.trim(),
      country_language: countryLanguage,
      phone_number: phoneNumber.trim()
    }]);

    if (error) {
      setStatusMsg("Error: " + error.message);
    } else {
      setStatusMsg("Asset Registered Successfully!");
      setProfileLink(""); setBio(""); setAccountId(""); setAccountPassword("");
      setEmail(""); setEmailPassword(""); setTwoFaCode(""); setPhoneNumber("");
      await loadAssets(profile.id);
      setActiveTab("assets");
    }
  };

  const handleToggleAssetStatus = async (asset: any) => {
    const newStatus = asset.status === "active" ? "suspended" : "active";
    await supabase.from("social_assets").update({ status: newStatus }).eq("id", asset.id);
    await loadAssets(profile.id);
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.is_locked) return alert("Your Team Leader has locked weekly Asset metric submissions.");
    if (!selectedAssetId) return alert("Please select an Asset first.");

    setStatusMsg("Saving Weekly Asset Metrics...");
    const { error } = await supabase.from("weekly_metrics").upsert([{
      asset_id: selectedAssetId,
      week_of: weekOf,
      impressions: parseInt(impressions) || 0,
      engagements: parseInt(engagements) || 0,
      likes: parseInt(likes) || 0,
      shares_reposts: parseInt(sharesReposts) || 0,
      comments: parseInt(comments) || 0,
      followers_gained: parseInt(followersGained) || 0,
      followers_lost: parseInt(followersLost) || 0,
      total_followers: parseInt(totalFollowers) || 0,
      posts_published: parseInt(postsPublished) || 0,
      top_post_impressions: parseInt(topPostImpr) || 0
    }], { onConflict: "asset_id,week_of" });

    if (error) {
      setStatusMsg("Error: " + error.message);
    } else {
      setStatusMsg("Weekly Metrics Logged for Asset Successfully!");
      setImpressions(""); setEngagements(""); setLikes(""); setSharesReposts(""); setComments("");
      setFollowersGained(""); setFollowersLost(""); setTotalFollowers(""); setPostsPublished(""); setTopPostImpr("");
      await loadMetrics(selectedAssetId);
    }
  };

  const filteredAssets = assets.filter(a => {
    const tlMatch = selectedTl === "all" || a.team_leader_id === selectedTl;
    const platMatch = selectedPlatform === "all" || a.platform === selectedPlatform;
    return tlMatch && platMatch;
  });

  const activeAsset = assets.find(a => a.id === selectedAssetId) || filteredAssets[0];

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono">Loading SMM Asset Workspace...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">SMM Asset Handler Portal</span>
            <h1 className="text-3xl font-bold text-white mt-2">{profile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {profile.country} • Metric Input: {profile.is_locked ? <span className="text-red-400 font-bold">🔒 LOCKED BY TEAM LEADER</span> : <span className="text-emerald-400 font-bold">🔓 OPEN</span>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("log")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "log" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>📊 Log Asset Metrics</button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>🗂 My Registered Assets ({assets.length})</button>
            <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "register" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-emerald-400 border border-emerald-500/30"}`}>+ Register New Asset</button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">Sign Out</button>
          </div>
        </div>

        {/* Asset Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">1. Choose Team Leader</label>
            <select value={selectedTl} onChange={(e) => setSelectedTl(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white outline-none">
              <option value="all">All Assigned Team Leaders</option>
              {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">2. Filter Asset Platform</label>
            <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white uppercase outline-none">
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-purple-400">3. Select Target Asset to Log Metrics</label>
            <select value={selectedAssetId} onChange={(e) => { setSelectedAssetId(e.target.value); loadMetrics(e.target.value); }} className="w-full mt-1 rounded-lg bg-zinc-900 border border-purple-500/40 p-2.5 text-sm text-white outline-none">
              {filteredAssets.length === 0 ? <option value="">No Assets Registered — Click "+ Register New Asset"</option> : filteredAssets.map(a => (
                <option key={a.id} value={a.id}>ASSET: [{a.platform.toUpperCase()}] {a.account_id} ({a.status.toUpperCase()})</option>
              ))}
            </select>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* TAB 1: LOG WEEKLY METRICS FOR SELECTED ASSET */}
        {activeTab === "log" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Log Weekly Asset Metrics</h2>
              
              {activeAsset ? (
                <div className="p-3.5 bg-purple-950/20 rounded-lg border border-purple-500/40 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-purple-300 font-bold">Currently Logging Metrics For Asset:</div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-sm uppercase">[{activeAsset.platform}] {activeAsset.account_id}</span>
                    <button type="button" onClick={() => handleToggleAssetStatus(activeAsset)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeAsset.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                      {activeAsset.status === "active" ? "● Asset Active" : "⚠ Asset Suspended"}
                    </button>
                  </div>
                  <p className="text-zinc-400 truncate">Asset URL: <a href={activeAsset.profile_link} target="_blank" className="text-blue-400 underline">{activeAsset.profile_link}</a></p>
                  {(activeAsset.tl_task || activeAsset.tl_campaign || activeAsset.tl_comment) && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1 text-[11px]">
                      {activeAsset.tl_campaign && <p className="text-blue-300">🎯 <b>Asset Campaign:</b> {activeAsset.tl_campaign}</p>}
                      {activeAsset.tl_task && <p className="text-emerald-300">📋 <b>Asset Task:</b> {activeAsset.tl_task}</p>}
                      {activeAsset.tl_comment && <p className="text-amber-300">💬 <b>TL Comment:</b> {activeAsset.tl_comment}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  You have no registered Assets yet. Click <b>"+ Register New Asset"</b> in the top bar to register your first social media asset before logging weekly metrics.
                </div>
              )}

              <form onSubmit={handleLogMetrics} autoComplete="off" className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Week Of (Report Date for Asset)</label>
                  <input type="date" required value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2 text-sm text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Asset Impressions" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Asset Engagements" value={engagements} onChange={(e) => setEngagements(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Asset Likes" value={likes} onChange={(e) => setLikes(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Asset Reposts / Shares" value={sharesReposts} onChange={(e) => setSharesReposts(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Asset Comments" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Asset Posts Published" value={postsPublished} onChange={(e) => setPostsPublished(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Followers Gained" value={followersGained} onChange={(e) => setFollowersGained(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Followers Lost" value={followersLost} onChange={(e) => setFollowersLost(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Total Asset Followers" value={totalFollowers} onChange={(e) => setTotalFollowers(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Top Post Impr." value={topPostImpr} onChange={(e) => setTopPostImpr(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                </div>
                <button type="submit" disabled={profile.is_locked || !activeAsset} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-lg text-sm transition-all">
                  {profile.is_locked ? "🔒 Asset Input Locked by Team Leader" : "Submit Weekly Asset Report"}
                </button>
              </form>
            </div>

            {/* Historical Weekly Reports Table for the Selected Asset */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-1">Weekly Asset Performance Ledger</h2>
              <p className="text-xs text-zinc-400 mb-4">{activeAsset ? `Showing weekly history for Asset: [${activeAsset.platform.toUpperCase()}] ${activeAsset.account_id}` : "Select an Asset to view its weekly history"}</p>
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 uppercase border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Week Of</th>
                    <th className="p-3">Impr.</th>
                    <th className="p-3">Eng.</th>
                    <th className="p-3">Eng %</th>
                    <th className="p-3">Likes / Reposts</th>
                    <th className="p-3">Net Followers</th>
                    <th className="p-3">Total Fol.</th>
                    <th className="p-3">Posts (Posts/Day)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metricsHistory.map(m => {
                    const engRate = m.impressions > 0 ? ((m.engagements / m.impressions) * 100).toFixed(2) : "0.00";
                    const netFol = (m.followers_gained || 0) - (m.followers_lost || 0);
                    const postsPerDay = ((m.posts_published || 0) / 7).toFixed(1);
                    return (
                      <tr key={m.id} className="hover:bg-zinc-900/50 font-mono">
                        <td className="p-3 font-bold text-white">{m.week_of}</td>
                        <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                        <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                        <td className="p-3 text-emerald-400">{engRate}%</td>
                        <td className="p-3">{m.likes} / {m.shares_reposts}</td>
                        <td className={`p-3 font-bold ${netFol >= 0 ? "text-emerald-400" : "text-red-400"}`}>{netFol >= 0 ? `+${netFol}` : netFol}</td>
                        <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                        <td className="p-3">{m.posts_published} ({postsPerDay}/d)</td>
                      </tr>
                    );
                  })}
                  {metricsHistory.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-zinc-500">No weekly metrics logged for this Asset yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER NEW ASSET (STRICTLY LABELED FOR THE ASSET & ANTI-AUTOFILL) */}
        {activeTab === "register" && (
          <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-1">2.1 Register New Asset Details</h2>
            <p className="text-xs text-emerald-400 mb-6">Enter credentials strictly for the Social Media Asset you are handling (NOT your personal portal login).</p>
            
            <form onSubmit={handleRegisterAsset} autoComplete="off" className="space-y-4">
              {/* Hidden trap inputs to prevent Chrome/Edge from autofilling the handler's login email/password */}
              <input type="text" name="prevent_autofill_user" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
              <input type="password" name="prevent_autofill_pass" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Platform</label>
                  <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white uppercase">
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Team Leader</label>
                  <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white">
                    {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Project / Campaign</label>
                  <input type="text" name="asset_project" autoComplete="off" required value={regProject} onChange={(e) => setRegProject(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Asset Profile Link</label>
                <input type="url" name="asset_profile_url" autoComplete="off" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="https://x.com/your_asset_handle" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">2. Asset Bio</label>
                <input type="text" name="asset_bio_text" autoComplete="off" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio written on the Asset profile" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">3. Asset ID (Username / @Handle of Asset)</label>
                  <input type="text" name="asset_handle_id" autoComplete="off" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="e.g. @SaharaVoiceX" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">4. Asset Password (Login Password of Asset)</label>
                  <input type="text" name="asset_login_secret" autoComplete="off" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Asset's Social Media Password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">5. Asset Email (Email Attached to Asset)</label>
                  <input type="email" name="asset_recovery_mail" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="asset_email@domain.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">6. Asset Email Password</label>
                  <input type="text" name="asset_mail_secret" autoComplete="off" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Password for the Asset's Email" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">7. Asset 2FA Code</label>
                  <input type="text" name="asset_2fa_secret" autoComplete="off" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="Asset 2FA / Backup Key" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">8. Asset Country</label>
                  <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white">
                    {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">9. Asset Phone Number</label>
                  <input type="text" name="asset_phone_num" autoComplete="off" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone linked to Asset" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm transition-all mt-2">
                Save & Register Asset
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: MY REGISTERED ASSETS */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="group bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 rounded-2xl p-5 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(168,85,247,0.3)]">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase">ASSET: {asset.platform}</span>
                  <button onClick={() => handleToggleAssetStatus(asset)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"}`}>
                    {asset.status === "active" ? "● Asset Active (Tap to Suspend)" : "⚠ Asset Suspended (Tap to Activate)"}
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Asset ID: {asset.account_id}</h3>
                  <a href={asset.profile_link} target="_blank" className="text-xs text-blue-400 underline truncate block">{asset.profile_link}</a>
                  <p className="text-xs text-zinc-400 mt-1 italic">Bio: "{asset.bio}"</p>
                </div>
                <div className="text-[11px] bg-zinc-900 p-3 rounded-lg space-y-1 font-mono text-zinc-300">
                  <div><b>Asset Project:</b> {asset.project_name}</div>
                  <div><b>Asset Country:</b> {asset.country_language}</div>
                  <div><b>Asset Email:</b> {asset.email}</div>
                  <div><b>Asset Phone:</b> {asset.phone_number || "N/A"}</div>
                </div>
                <button
                  onClick={() => { setSelectedAssetId(asset.id); loadMetrics(asset.id); setActiveTab("log"); }}
                  className="w-full py-2 bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                >
                  📊 Log Weekly Metrics for This Asset →
                </button>
              </div>
            ))}
            {filteredAssets.length === 0 && <div className="col-span-3 text-center text-zinc-500 py-12">No Assets registered under this filter yet.</div>}
          </div>
        )}

      </div>
    </div>
  );
}
```
### ./app/team-leader/page.tsx
```
"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function TeamLeaderPortal() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tlName, setTlName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string | null>(null);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignProject, setAssignProject] = useState("General Campaign");

  useEffect(() => {
    verifyTeamLeaderSession();
  }, []);

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsCheckingAuth(false);
      return;
    }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      setAuthMsg("Unauthorized: Only verified Team Leaders can access this portal.");
      setIsCheckingAuth(false);
      return;
    }

    setTlProfile(prof);
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
  };

  const handleTLAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating Team Leader...");

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setAuthMsg(error.message);

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      if (!prof || prof.role !== "team_leader") {
        await supabase.auth.signOut();
        return setAuthMsg("Security Block: SMMs and non-TL accounts are strictly forbidden from the Team Leader portal.");
      }

      setTlProfile(prof);
      await loadSquadData(prof.id);
    } else {
      if (selectedCountries.length === 0) return setAuthMsg("Select at least one Country.");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: "team_leader",
          full_name: tlName,
          country: selectedCountries.join(", ")
        })
      });
      const data = await res.json();
      if (res.ok) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
        await verifyTeamLeaderSession();
      } else {
        setAuthMsg(data.error || "Failed to register Team Leader.");
      }
    }
  };

  const loadSquadData = async (tlId: string) => {
    const { data: mySmms } = await supabase.from("profiles").select("*").eq("role", "smm");
    const filteredSmms = (mySmms || []).filter(s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId)));
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);

    const { data: assets } = await supabase.from("social_assets").select("*").order("created_at", { ascending: false });
    setSquadAssets(assets || []);

    const { data: metrics } = await supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false });
    setSquadMetrics(metrics || []);
  };

  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name}'s weekly Asset metric input is now ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
    await loadSquadData(tlProfile.id);
  };

  const handleUpdateAssetDirectives = async (assetId: string, tl_campaign: string, tl_task: string, tl_comment: string) => {
    await supabase.from("social_assets").update({ tl_campaign, tl_task, tl_comment }).eq("id", assetId);
    setStatusMsg("Directives & comments saved to Asset!");
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this Asset from the manager?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    setStatusMsg("Asset removed.");
    await loadSquadData(tlProfile.id);
  };

  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("social_assets").insert([{
      smm_id: assignSmmId,
      team_leader_id: tlProfile.id,
      platform: assignPlatform,
      account_id: assignAccountId,
      profile_link: assignLink,
      account_password: assignPass,
      project_name: assignProject,
      status: "active"
    }]);
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignLink(""); setAssignPass("");
    setStatusMsg("New Asset assigned to manager!");
    await loadSquadData(tlProfile.id);
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Verifying Team Leader Clearance...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold shadow-[0_0_15px_rgba(59,130,246,0.25)]">Tier 2 — Squad Command</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
            <p className="text-xs text-zinc-500 mt-1">Restricted strictly to verified Agency Team Leaders</p>
          </div>

          <form onSubmit={handleTLAuth} className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/40 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500"></div>
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Name</label>
                  <input type="text" required value={tlName} onChange={(e) => setTlName(e.target.value)} placeholder="e.g. Josiah, Jeff, Ali" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border truncate transition-all ${selectedCountries.includes(c) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="josiah@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
            </div>

            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-3 rounded-lg text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.35)]">
              {isLoginMode ? "Authenticate Team Leader" : "Complete Team Leader Creation"}
            </button>

            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthMsg(""); }} className="text-xs text-zinc-400 hover:text-white underline">
                {isLoginMode ? "Create New Team Leader Account" : "Return to Team Leader Login"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400 transition-colors">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSmmObj = squadMembers.find(m => m.id === selectedSmm);
  const filteredAssets = selectedSmm ? squadAssets.filter(a => a.smm_id === selectedSmm) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
              Tier 2 — Team Leader Command
            </span>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {tlProfile.country} • Squad SMMs: {squadMembers.length} • Total Squad Assets: {squadAssets.length}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowGiveModal(!showGiveModal)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 hover:-translate-y-0.5 active:scale-95 text-black font-bold rounded-lg text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              + Give Asset to Manager
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-lg text-xs text-zinc-400 hover:text-red-400 transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* Animated Give Asset Modal Drawer */}
        <div className={`grid transition-all duration-500 ease-in-out ${showGiveModal ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            <form onSubmit={handleGiveAsset} autoComplete="off" className="bg-zinc-950 border border-emerald-500/40 p-6 rounded-2xl space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-emerald-400 uppercase">Give / Assign Asset to Squad Manager</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white">
                  {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white uppercase">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset ID / @Handle" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                <input type="url" required value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Asset Profile Link" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              </div>
              <button type="submit" className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">Confirm Assignment</button>
            </form>
          </div>
        </div>

        {/* 1. Squad Managers Grid */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
              1. Squad Managers Signed Under You (Click Manager Card to Unfold Their Assets)
            </h2>
            {selectedSmm && (
              <button onClick={() => setSelectedSmm(null)} className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800 transition-all">
                ✕ Collapse Asset Drawer
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadMembers.map(smm => {
              const isSelected = selectedSmm === smm.id;
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmAssetIds = smmAssets.map(a => a.id);
              const smmLogs = squadMetrics.filter(m => smmAssetIds.includes(m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => setSelectedSmm(isSelected ? null : smm.id)}
                  className={`group cursor-pointer rounded-2xl p-5 border transition-all duration-300 transform ${
                    isSelected
                      ? "bg-gradient-to-b from-blue-950/40 to-zinc-950 border-blue-500 -translate-y-1.5 shadow-[0_12px_35px_-10px_rgba(59,130,246,0.45)] ring-1 ring-blue-400/50"
                      : "bg-zinc-950 border-zinc-800 hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-xl"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Assets</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                        smm.is_locked
                          ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                      }`}
                    >
                      {smm.is_locked ? "🔒 Locked (Tap to Unlock)" : "🔓 Open (Tap to Lock)"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-[11px] text-zinc-400 group-hover:text-blue-300">
                    <span>{isSelected ? "Asset Drawer Open Below" : `Click to Inspect ${smmAssets.length} Assets`}</span>
                    <span className={`transition-transform duration-300 ${isSelected ? "rotate-180 text-blue-400" : "group-hover:translate-x-1"}`}>
                      {isSelected ? "▲" : "→"}
                    </span>
                  </div>
                </div>
              );
            })}
            {squadMembers.length === 0 && <div className="col-span-3 text-zinc-500 text-sm p-6 bg-zinc-950 border border-zinc-800 rounded-xl">No SMMs have registered under your Team Leader profile yet.</div>}
          </div>
        </div>

        {/* 2. Animated Expandable Drawer for Selected Manager's Assets */}
        <div className={`grid transition-all duration-500 ease-in-out ${selectedSmm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            {activeSmmObj && (
              <div className="bg-zinc-950/95 border border-blue-500/40 rounded-2xl p-6 space-y-5 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      Unfolded Manager Asset Vault
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      {activeSmmObj.full_name}&apos;s Managed Assets ({filteredAssets.length})
                    </h2>
                    <p className="text-xs text-zinc-400">Assign weekly campaigns, tasks, and comments or inspect credentials</p>
                  </div>
                  <button onClick={() => setSelectedSmm(null)} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                    Collapse Drawer ▲
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAssets.map(asset => {
                    const latest = squadMetrics.filter(m => m.asset_id === asset.id)[0];
                    return (
                      <AssetDirectiveCard
                        key={asset.id}
                        asset={asset}
                        ownerName={activeSmmObj.full_name}
                        latestMetric={latest}
                        onSave={handleUpdateAssetDirectives}
                        onRemove={handleRemoveAsset}
                      />
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                      {activeSmmObj.full_name} has not registered any Social Media Assets yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function AssetDirectiveCard({ asset, ownerName, latestMetric, onSave, onRemove }: any) {
  const [campaign, setCampaign] = useState(asset.tl_campaign || "");
  const [task, setTask] = useState(asset.tl_task || "");
  const [comment, setComment] = useState(asset.tl_comment || "");
  const [showVault, setShowVault] = useState(false);

  return (
    <div className="bg-black border border-zinc-800 hover:border-blue-500/40 rounded-xl p-5 space-y-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">ASSET: {asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-zinc-500 ml-2">({ownerName})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVault(!showVault)} className="text-[10px] px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 transition-all">
            {showVault ? "🙈 Hide Vault" : "👁 View Vault"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 hover:underline ml-1">Remove</button>
        </div>
      </div>

      {/* Animated Vault Slide-Down */}
      <div className={`grid transition-all duration-300 ease-in-out ${showVault ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
        <div className="overflow-hidden">
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 space-y-1">
            <div><b>Asset Profile:</b> <a href={asset.profile_link} target="_blank" className="text-blue-400 underline">{asset.profile_link}</a></div>
            <div><b>Asset Pass:</b> <span className="text-emerald-400">{asset.account_password}</span></div>
            <div><b>Asset Email:</b> {asset.email} (<b>Pass:</b> {asset.email_password})</div>
            <div><b>Asset 2FA:</b> {asset.two_fa_code || "None"} • <b>Phone:</b> {asset.phone_number || "N/A"}</div>
          </div>
        </div>
      </div>

      {latestMetric ? (
        <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 p-3 rounded-lg text-xs font-mono">
          <div><span className="text-[10px] text-zinc-500 block">WEEK</span>{latestMetric.week_of}</div>
          <div><span className="text-[10px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold">{latestMetric.impressions.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">ENG</span><span className="text-purple-400 font-bold">{latestMetric.engagements.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">FOLLOWERS</span><span className="text-emerald-400 font-bold">{latestMetric.total_followers.toLocaleString()}</span></div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">No weekly metrics logged for this Asset yet.</div>
      )}

      <div className="space-y-2 pt-1">
        <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Assign Campaign to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Assign Weekly Task to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave Comment on Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <button onClick={() => onSave(asset.id, campaign, task, comment)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-lg text-xs transition-all">
          Save Directives & Comments
        </button>
      </div>
    </div>
  );
}
```
### ./app/log/page.tsx
```
"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountPlatform, setAccountPlatform] = useState("facebook");
  
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [motd, setMotd] = useState("");

  const [url, setUrl] = useState("");
  const [linkPlatform, setLinkPlatform] = useState("facebook");
  const [reach, setReach] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [groupsJoined, setGroupsJoined] = useState("");
  const [followers, setFollowers] = useState("");
  const [postCount, setPostCount] = useState("");
  const [totalEngagement, setTotalEngagement] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) { fetchMyLogs(session.user.email.split("@")[0]); fetchSettings(); }
      setIsCheckingAuth(false);
    });
    const channel = supabase.channel('my-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => { if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => fetchSettings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.email]);

  const fetchMyLogs = async (handlerId: string) => {
    const { data } = await supabase.from("campaign_links").select("*").eq("handler_name", handlerId).order("created_at", { ascending: false }).limit(50);
    if (data) setMyLogs(data);
  };
  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("daily_target, motd").eq("id", 1).single();
    if (data) { setDailyTarget(data.daily_target); setMotd(data.motd); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedEmail = `${username.toLowerCase().trim()}@executive-command.com`;
    if (isLoginMode) {
      await supabase.auth.signInWithPassword({ email: formattedEmail, password });
    } else {
      await supabase.auth.signUp({ email: formattedEmail, password, options: { data: { platform: accountPlatform } } });
      alert("Account Created!");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Submitting to MEL..." });
    if (!url.trim()) return setStatus({ type: "error", msg: "Please enter a valid URL." });

    const userPlatform = session?.user?.user_metadata?.platform || "facebook";
    const finalPlatform = userPlatform === "both" ? linkPlatform : userPlatform;

    try {
      const res = await fetch("/api/log", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          url, handler_name: session.user.email.split("@")[0], platform: finalPlatform,
          reach, views, likes, comments, shares, 
          groups_joined: finalPlatform === 'twitter' ? 0 : groupsJoined, 
          followers, post_count: postCount, total_engagement: totalEngagement 
        }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "MEL Data Logged Successfully!" });
        setUrl(""); setReach(""); setViews(""); setLikes(""); setComments(""); setShares(""); setGroupsJoined(""); setFollowers(""); setPostCount(""); setTotalEngagement("");
      } else setStatus({ type: "error", msg: "Failed to submit." });
    } catch { setStatus({ type: "error", msg: "Network Error" }); }
  };

  let todaysValidCount = myLogs.filter(log => new Date(log.created_at).toDateString() === new Date().toDateString()).length;
  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Initializing...</div>;

  const userPlatform = session?.user?.user_metadata?.platform || "facebook";
  const displayPlatform = userPlatform === "both" ? linkPlatform : userPlatform;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-md space-y-6 mt-10 mb-10">
        {session && motd && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 flex items-start gap-3"><span className="text-blue-500 mt-0.5 font-bold">INFO</span><p>{motd}</p></div>
        )}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative">
          {session && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>}
          {!session ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <h1 className="text-2xl font-bold text-center">Fleet Authentication</h1>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Handler ID" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passcode" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
              {!isLoginMode && (
                <select value={accountPlatform} onChange={(e) => setAccountPlatform(e.target.value)} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm text-zinc-300 outline-none"><option value="facebook">Facebook Only</option><option value="twitter">Twitter / X Only</option><option value="both">Both Platforms</option></select>
              )}
              <button type="submit" className="w-full bg-white text-black p-3 rounded-lg font-bold hover:bg-zinc-200">{isLoginMode ? "Login" : "Create Account"}</button>
              <div className="text-center"><button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs text-zinc-500 hover:text-white">{isLoginMode ? "Need an account? Sign Up" : "Already have an account? Login"}</button></div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center"><h1 className="text-xl font-bold">MEL Submission</h1><p className="text-sm text-zinc-400">ID: {session.user.email.split("@")[0]}</p></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {userPlatform === "both" && (
                  <select value={linkPlatform} onChange={(e) => setLinkPlatform(e.target.value)} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none text-zinc-300 mb-2">
                    <option value="facebook">Submitting a Facebook Post</option>
                    <option value="twitter">Submitting Twitter / X Account Stats</option>
                  </select>
                )}

                <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder={displayPlatform === 'twitter' ? "Twitter Account URL (e.g. x.com/user)" : "Facebook Post URL"} className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm focus:border-blue-500 outline-none" />
                
                <div className="grid grid-cols-2 gap-3 relative">
                  {displayPlatform === 'twitter' ? (
                     <>
                        <input type="number" min="0" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Total Followers" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={postCount} onChange={(e) => setPostCount(e.target.value)} placeholder="Post Number (This Week)" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} placeholder="Total Views" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={totalEngagement} onChange={(e) => setTotalEngagement(e.target.value)} placeholder="Total Engagement" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="Total Likes" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Total Comments" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                     </>
                  ) : (
                     <>
                        <input type="number" min="0" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Followers" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={groupsJoined} onChange={(e) => setGroupsJoined(e.target.value)} placeholder="Groups Joined" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={reach} onChange={(e) => setReach(e.target.value)} placeholder="Reach" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="Likes" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" min="0" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares" className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm focus:border-blue-500 outline-none col-span-2" />
                     </>
                  )}
                </div>
                {status.type !== "idle" && <div className={`text-sm text-center ${status.type === "error" ? "text-red-400" : "text-emerald-400"}`}>{status.msg}</div>}
                <button type="submit" disabled={status.type === "loading"} className="w-full bg-emerald-500 text-white p-3 rounded-lg font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50">Submit MEL Data</button>
              </form>
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-2"><div className="text-xs text-zinc-400">Target Progress: <span className="font-bold text-emerald-400">{todaysValidCount} / {dailyTarget}</span></div><button onClick={() => supabase.auth.signOut()} className="text-xs text-zinc-500 hover:text-white">Sign Out</button></div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (todaysValidCount / dailyTarget) * 100)}%` }}></div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```
### ./app/page.tsx
```
"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function SMMGatekeeper() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  useEffect(() => {
    initSMMPortal();
  }, []);

  const initSMMPortal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role === "smm") {
        router.push("/smm");
        return;
      }
    }
    setIsCheckingAuth(false);
    await fetchSanitizedTeamLeaders();
  };

  const fetchSanitizedTeamLeaders = async () => {
    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    if (!json.teamLeaders || json.teamLeaders.length < 9) {
      await fetch("/api/seed", { method: "POST" });
      const retry = await fetch("/api/team-leaders");
      const retryJson = await retry.json();
      setTeamLeaders(retryJson.teamLeaders || []);
      if (retryJson.teamLeaders?.length > 0) setSelectedTlIds([retryJson.teamLeaders[0].id]);
    } else {
      setTeamLeaders(json.teamLeaders);
      setSelectedTlIds([json.teamLeaders[0].id]);
    }
  };

  const toggleItem = (item: string, list: string[], setList: any) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const handleSMMAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Verifying SMM Credentials..." });

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setStatus({ type: "error", msg: error.message });

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      if (profile?.role !== "smm") {
        await supabase.auth.signOut();
        return setStatus({ type: "error", msg: "Access Denied: This portal is strictly for SMM Handlers. Team Leaders & Admins must use their dedicated portals." });
      }
      router.push("/smm");
    } else {
      if (selectedCountries.length === 0) return setStatus({ type: "error", msg: "Select at least one Country." });
      if (selectedTlIds.length === 0) return setStatus({ type: "error", msg: "Select at least one Team Leader." });
      if (selectedPlatforms.length === 0) return setStatus({ type: "error", msg: "Select at least one Platform." });
      
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(),
          password,
          role: "smm",
          full_name: fullName, 
          country: selectedCountries.join(", "), 
          team_leader_id: selectedTlIds[0],
          team_leader_ids: selectedTlIds,
          platforms: selectedPlatforms
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
        router.push("/smm");
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to create SMM account." });
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse">Verifying SMM Clearance...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
      <div className="w-full max-w-md my-8">
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold">Tier 3 — Handler Access</span>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-3">SMM Handler Portal</h1>
          <p className="text-xs text-zinc-500 mt-1">Isolated Social Media Asset & Weekly Metrics Terminal</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-600"></div>
          
          <form onSubmit={handleSMMAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">1. Handler Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter Full Name" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">2. Choose Platform(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {PLATFORMS.map(p => (
                      <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2 px-2 rounded-lg text-xs font-bold uppercase border transition-all ${selectedPlatforms.includes(p) ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">3. Choose Team Leader(s)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {teamLeaders.map(tl => (
                      <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-left truncate transition-all ${selectedTlIds.includes(tl.id) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        ✓ {tl.full_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">4. Choose Country</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => toggleItem(c, selectedCountries, setSelectedCountries)} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all truncate ${selectedCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">SMM Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="handler@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm focus:border-purple-500 outline-none text-white" />
            </div>
            
            {status.type !== "idle" && (
              <div className={`text-xs text-center p-2.5 rounded-lg border ${status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={status.type === "loading"} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-500 transition-colors disabled:opacity-50">
              {status.type === "loading" ? "Verifying..." : isLoginMode ? "Sign In to SMM Workspace" : "Complete SMM Registration"}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setStatus({ type: "idle", msg: "" }); }} className="text-xs text-zinc-400 hover:text-white transition-colors underline">
                {isLoginMode ? "New SMM Handler? Create Account" : "Already registered? Sign In"}
              </button>
            </div>
          </form>
        </div>

        {/* Separated Role Portal Links */}
        <div className="mt-6 flex justify-between items-center text-xs text-zinc-500 border-t border-zinc-900 pt-4 px-2">
          <Link href="/team-leader" className="hover:text-blue-400 transition-colors">🛡 Team Leader Portal →</Link>
          <Link href="/admin" className="hover:text-emerald-400 transition-colors">👑 Admin Command Vault →</Link>
        </div>
      </div>
    </div>
  );
}
```
### ./lib/supabase.ts
```
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ADMIN CLIENT: Uses a dedicated storage key so it never mixes with managers
export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "command-center-admin-auth",
  }
});

// MANAGER CLIENT: Uses a separate storage key
export const managerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "fleet-manager-auth",
  }
});```
### ./lib/utils.ts
```
export { cn } from "cn"
```
### ./next.config.ts
```
import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

export default nextConfig
```
### ./create-users.js
```
```
### ./next-env.d.ts
```
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```
