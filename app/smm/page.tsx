"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  TimeHorizon,
  parseBulkRows,
  aggregateMetricsByHorizon,
  exportHorizonCSV,
  computeAchievements
} from "@/lib/constants";

export default function SMMDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [allTeamLeaders, setAllTeamLeaders] = useState<any[]>([]);
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [allMyMetrics, setAllMyMetrics] = useState<any[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "graphs" | "achievements" | "assets" | "register" | "bulk">("log");
  const [statusMsg, setStatusMsg] = useState("");
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  // Settings Drawer State
  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [setPlatforms, setSetPlatforms] = useState<string[]>([]);
  const [setTlIds, setSetTlIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [autoMaskVault, setAutoMaskVault] = useState(true);

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
  const [countryLanguage, setCountryLanguage] = useState("Ethiopia");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Weekly Metrics CRUD State
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
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

  const [bulkRawText, setBulkRawText] = useState("");

  useEffect(() => {
    let channel: any;
    initSMM().then((userId) => {
      if (!userId) return;
      channel = supabase
        .channel("smm-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { triggerPulse(); refreshProfileAndAssets(userId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { triggerPulse(); refreshProfileAndAssets(userId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { triggerPulse(); refreshProfileAndAssets(userId); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const triggerPulse = () => {
    setLiveSyncPulse(true);
    setTimeout(() => setLiveSyncPulse(false), 1200);
  };

  const initSMM = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return null; }
    await refreshProfileAndAssets(session.user.id, true);
    return session.user.id;
  };

  const refreshProfileAndAssets = async (userId: string, isInitial = false) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!prof || prof.role !== "smm") {
      await supabase.auth.signOut();
      window.location.href = "/";
      return;
    }
    setProfile(prof);
    if (isInitial) {
      setSetFullName(prof.full_name || "");
      setSetCountries((prof.country || "Ethiopia").split(",").map((c: string) => c.trim()).filter(Boolean));
      setSetPlatforms(prof.platforms?.length > 0 ? prof.platforms : ["twitter"]);
    }

    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    const tls = json.teamLeaders || [];
    setAllTeamLeaders(tls);
    if (tls.length > 0) {
      const assignedIds = prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : (prof.team_leader_id ? [prof.team_leader_id] : []);
      if (isInitial) setSetTlIds(assignedIds);
      const myTls = tls.filter((t: any) => assignedIds.includes(t.id));
      const finalTls = myTls.length > 0 ? myTls : tls;
      setTeamLeaders(finalTls);
      if (isInitial && finalTls.length > 0) setRegTlId(finalTls[0].id);
    }

    const { data: assetList } = await supabase.from("social_assets").select("*").eq("smm_id", userId).order("created_at", { ascending: false });
    if (assetList) {
      setAssets(assetList);
      const assetIds = assetList.map(a => a.id);
      if (assetIds.length > 0) {
        const { data: mAll } = await supabase.from("weekly_metrics").select("*").in("asset_id", assetIds).order("week_of", { ascending: false });
        setAllMyMetrics(mAll || []);
        const targetId = selectedAssetId || assetList[0].id;
        if (!selectedAssetId) setSelectedAssetId(targetId);
        setMetricsHistory((mAll || []).filter(m => m.asset_id === targetId));
      }
    }
  };

  const loadMetrics = async (assetId: string) => {
    if (!assetId) return;
    const { data } = await supabase.from("weekly_metrics").select("*").eq("asset_id", assetId).order("week_of", { ascending: false });
    if (data) setMetricsHistory(data);
  };

  const handleSaveSMMSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: profile.id,
        entity: "profile",
        action: "update",
        payload: {
          targetId: profile.id,
          full_name: setFullName,
          country: setCountries.join(", "),
          platforms: setPlatforms,
          team_leader_ids: setTlIds,
          newPassword
        }
      })
    });
    setNewPassword("");
    setShowSettings(false);
    setStatusMsg("✓ SMM Workspace Settings Synced Live!");
    await refreshProfileAndAssets(profile.id);
  };

  // SMM ASSET CRUD
  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: profile.id,
        entity: "asset",
        action: "create",
        payload: {
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
        }
      })
    });
    if (res.ok) {
      setStatusMsg("✓ Asset Created & Synced Live!");
      setProfileLink(""); setBio(""); setAccountId(""); setAccountPassword("");
      setEmail(""); setEmailPassword(""); setTwoFaCode(""); setPhoneNumber("");
      await refreshProfileAndAssets(profile.id);
      setActiveTab("assets");
    }
  };

  const handleSmmBulkAssets = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkRawText);
    if (rows.length === 0) return;
    const items = rows.map(r => ({
      smm_id: profile.id,
      team_leader_id: regTlId || profile.team_leader_id,
      account_id: r[0] || "Pending_Handle",
      account_password: r[1] || "",
      email: r[2] || "",
      email_password: r[3] || "",
      profile_link: r[4] || "",
      bio: r[5] || "",
      two_fa_code: r[6] || "",
      phone_number: r[7] || "",
      country_language: r[8] || countryLanguage,
      platform: (r[9] || regPlatform).toLowerCase(),
      project_name: r[10] || regProject,
      status: "active"
    }));
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "bulk_create", payload: { items } })
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`⚡ Bulk registered ${data.count} Assets live!`);
      setBulkRawText("");
      setActiveTab("assets");
      await refreshProfileAndAssets(profile.id);
    }
  };

  const handleUpdateExistingAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "update", payload: editingAsset })
    });
    setStatusMsg("✓ Asset Updated Live!");
    setEditingAsset(null);
    await refreshProfileAndAssets(profile.id);
  };

  const handleDeleteOwnAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "delete", payload: { id: assetId } })
    });
    setStatusMsg("🗑 Asset Deleted.");
    await refreshProfileAndAssets(profile.id);
  };

  // SMM METRIC CRUD
  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.is_locked) return alert("Your Team Leader has locked weekly Asset metric submissions.");
    if (!selectedAssetId) return alert("Select an Asset first.");

    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: profile.id,
        entity: "metric",
        action: "upsert",
        payload: {
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
        }
      })
    });
    if (res.ok) {
      setStatusMsg("✓ Weekly Metrics Synced Live!");
      setEditingMetricId(null);
      setImpressions(""); setEngagements(""); setLikes(""); setSharesReposts(""); setComments("");
      setFollowersGained(""); setFollowersLost(""); setTotalFollowers(""); setPostsPublished(""); setTopPostImpr("");
      await refreshProfileAndAssets(profile.id);
    }
  };

  const handleDeleteMetricRow = async (metricId: string) => {
    if (profile?.is_locked) return alert("Locked by Team Leader.");
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "metric", action: "delete", payload: { id: metricId } })
    });
    await refreshProfileAndAssets(profile.id);
  };

  const activeAsset = assets.find(a => a.id === selectedAssetId) || assets[0];
  const myHorizonRows = aggregateMetricsByHorizon(allMyMetrics, csvHorizon);
  const myAchievements = computeAchievements(assets, allMyMetrics);

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono">Connecting Live SMM Asset Stream...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header with Multi-Horizon CSV & Settings */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
                Tier 3 — SMM Asset & Metric CRUD
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">{profile.full_name}</h1>
            <p className="text-xs text-zinc-400">
              Countries: {profile.country} • Metric Input: {profile.is_locked ? <span className="text-red-400 font-bold">🔒 LOCKED</span> : <span className="text-emerald-400 font-bold">🔓 UNLOCKED</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-zinc-950 border border-purple-500/40 rounded-lg p-1 gap-1">
              <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="bg-black text-purple-300 text-xs font-bold px-2 py-1.5 rounded outline-none uppercase">
                <option value="weekly">📅 Weekly CSV</option>
                <option value="monthly">📆 Monthly CSV</option>
                <option value="quarterly">📊 Quarterly CSV</option>
                <option value="yearly">📈 Yearly CSV</option>
              </select>
              <button
                onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics: allMyMetrics, assets, profiles: [profile, ...teamLeaders], scopeLabel: `SMM_${profile.full_name}` })}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs"
              >
                ⬇ Export {csvHorizon.toUpperCase()}
              </button>
            </div>
            <button onClick={() => setShowSettings(true)} className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-purple-300 font-bold rounded-lg text-xs">
              ⚙ Settings
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {/* 6-Tab Navigation */}
        <div className="flex flex-wrap gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <button onClick={() => setActiveTab("log")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "log" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>📊 Weekly Metrics CRUD</button>
          <button onClick={() => setActiveTab("graphs")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300 border border-cyan-500/30"}`}>📈 Summary Graphs</button>
          <button onClick={() => setActiveTab("achievements")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300 border border-yellow-500/30"}`}>🏆 My Achievements</button>
          <button onClick={() => setActiveTab("assets")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>🗂 My Assets ({assets.length})</button>
          <button onClick={() => setActiveTab("register")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "register" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-emerald-400 border border-emerald-500/30"}`}>+ Create Single Asset</button>
          <button onClick={() => setActiveTab("bulk")} className={`px-3.5 py-2 rounded-xl text-xs font-bold ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400 border border-amber-500/30"}`}>⚡ Bulk Register Assets</button>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* TAB 1: LOG WEEKLY METRICS */}
        {activeTab === "log" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4">
              <select value={selectedAssetId} onChange={(e) => { setSelectedAssetId(e.target.value); loadMetrics(e.target.value); }} className="w-full rounded-lg bg-zinc-900 border border-purple-500/40 p-2.5 text-sm text-white">
                {assets.map(a => <option key={a.id} value={a.id}>[{a.platform.toUpperCase()}] {a.account_id}</option>)}
              </select>

              <form onSubmit={handleLogMetrics} className="space-y-3">
                <input type="date" required value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className="w-full rounded-lg bg-black border border-zinc-800 p-2 text-sm text-white" />
                <div className="grid grid-cols-2 gap-2.5">
                  <input type="number" placeholder="Impressions" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Engagements" value={engagements} onChange={(e) => setEngagements(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Likes" value={likes} onChange={(e) => setLikes(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Reposts" value={sharesReposts} onChange={(e) => setSharesReposts(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Posts Published" value={postsPublished} onChange={(e) => setPostsPublished(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Fol. Gained" value={followersGained} onChange={(e) => setFollowersGained(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Fol. Lost" value={followersLost} onChange={(e) => setFollowersLost(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Total Followers" value={totalFollowers} onChange={(e) => setTotalFollowers(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                  <input type="number" placeholder="Top Post Impr." value={topPostImpr} onChange={(e) => setTopPostImpr(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
                </div>
                <button type="submit" disabled={profile.is_locked || !activeAsset} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-lg text-xs">
                  {profile.is_locked ? "🔒 Locked by Team Leader" : "Save Weekly Asset Report"}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-3">Weekly Performance Ledger</h2>
              <table className="w-full text-left text-xs text-zinc-300 font-mono">
                <thead className="bg-zinc-900 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Week</th>
                    <th className="p-3">Impr</th>
                    <th className="p-3">Eng</th>
                    <th className="p-3">Total Fol</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metricsHistory.map(m => (
                    <tr key={m.id}>
                      <td className="p-3 font-bold text-white">{m.week_of}</td>
                      <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                      <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                      <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                      <td className="p-3 text-right space-x-2 font-sans">
                        <button disabled={profile.is_locked} onClick={() => { setEditingMetricId(m.id); setWeekOf(m.week_of); setImpressions(String(m.impressions)); setEngagements(String(m.engagements)); setTotalFollowers(String(m.total_followers)); }} className="text-emerald-400 hover:underline">Edit</button>
                        <button disabled={profile.is_locked} onClick={() => handleDeleteMetricRow(m.id)} className="text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-zinc-950 border border-cyan-500/30 p-4 rounded-2xl">
              <h2 className="text-lg font-bold text-white">📈 My Asset Performance Graphs ({csvHorizon.toUpperCase()})</h2>
              <div className="flex gap-2">
                {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map(h => (
                  <button key={h} onClick={() => setCsvHorizon(h)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${csvHorizon === h ? "bg-cyan-400 text-black" : "bg-black text-zinc-400"}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
              {assets.map(a => {
                const aImpr = allMyMetrics.filter(m => m.asset_id === a.id).reduce((s, x) => s + Number(x.impressions || 0), 0);
                const maxA = Math.max(1000, ...assets.map(x => allMyMetrics.filter(m => m.asset_id === x.id).reduce((s, y) => s + Number(y.impressions || 0), 0)));
                const w = Math.min(100, Math.max(5, Math.round((aImpr / maxA) * 100)));
                return (
                  <div key={a.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-white font-bold">[{a.platform.toUpperCase()}] {a.account_id}</span>
                      <span className="text-cyan-300">{aImpr.toLocaleString()} Impr</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style={{ width: `${w}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PERSONAL ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myAchievements.map(ach => (
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

        {/* TAB 4: MY ASSETS CRUD */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assets.map(asset => (
              <div key={asset.id} className="bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 rounded-2xl p-5 space-y-3 transition-all">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 text-xs font-bold uppercase">{asset.platform}</span>
                  <span className="text-xs text-emerald-400 font-bold">{asset.country_language}</span>
                </div>
                <h3 className="text-lg font-bold text-white">{asset.account_id}</h3>
                <div className="text-[11px] font-mono text-zinc-400">
                  Pass: {autoMaskVault ? "••••••••" : (asset.account_password || "N/A")}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button onClick={() => setEditingAsset({ ...asset })} className="py-2 bg-zinc-900 border border-zinc-700 text-emerald-400 rounded-lg text-xs font-bold">✎ Edit</button>
                  <button onClick={() => handleDeleteOwnAsset(asset.id)} className="py-2 bg-zinc-900 border border-zinc-700 text-red-400 rounded-lg text-xs font-bold">🗑 Delete</button>
                  <button onClick={() => { setSelectedAssetId(asset.id); loadMetrics(asset.id); setActiveTab("log"); }} className="py-2 bg-purple-600/20 text-purple-300 rounded-lg text-xs font-bold">📊 Logs</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: REGISTER SINGLE ASSET */}
        {activeTab === "register" && (
          <form onSubmit={handleRegisterAsset} autoComplete="off" className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">2.1 Create & Register New Asset</h2>
            <div className="grid grid-cols-3 gap-3">
              <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white">
                {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
              </select>
              <input type="text" required value={regProject} onChange={(e) => setRegProject(e.target.value)} placeholder="Campaign" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="1. Asset Profile Link" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="2. Asset Bio" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="3. Asset ID (@Handle)" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="4. Asset Password" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="5. Asset Email" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="6. Asset Email Password" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="7. Asset 2FA Code" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
              <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white">
                {ALL_COUNTRIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="9. Asset Phone Number" className="rounded-lg bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <button type="submit" className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg text-xs">Create & Save Asset</button>
          </form>
        )}

        {/* TAB 6: BULK REGISTER ASSETS */}
        {activeTab === "bulk" && (
          <form onSubmit={handleSmmBulkAssets} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">⚡ Bulk Asset Registration (Paste from Excel / Sheets / CSV)</h2>
            <textarea rows={7} required value={bulkRawText} onChange={(e) => setBulkRawText(e.target.value)} placeholder="Asset_ID, Asset_Password, Email, Email_Password, Profile_Link, Bio, 2FA_Code, Phone, Country, Platform, Project" className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white" />
            <button type="submit" className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl text-xs">
              ⚡ Bulk Register Assets ({parseBulkRows(bulkRawText).length} Rows)
            </button>
          </form>
        )}

      </div>

      {/* SLIDE-OVER SMM SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveSMMSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-400">Handler Configuration</span>
                <h2 className="text-xl font-bold text-white">SMM Workspace Settings</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-zinc-900 text-xs text-zinc-400">✕ Close</button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Handler Display Name</label>
              <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Team Leaders</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {allTeamLeaders.map(tl => (
                  <button type="button" key={tl.id} onClick={() => setSetTlIds(prev => prev.includes(tl.id) ? prev.filter(x => x !== tl.id) : [...prev, tl.id])} className={`py-1.5 px-2 rounded text-xs font-bold border truncate ${setTlIds.includes(tl.id) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                    ✓ {tl.full_name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Active Platforms</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {PLATFORMS.map(p => (
                  <button type="button" key={p} onClick={() => setSetPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={`py-1.5 px-2 rounded text-xs font-bold uppercase border ${setPlatforms.includes(p) ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Operational Countries ({setCountries.length})</label>
              <div className="grid grid-cols-4 gap-1.5 mt-1 max-h-40 overflow-y-auto p-1 bg-black rounded-xl border border-zinc-900">
                {ALL_COUNTRIES.map(c => (
                  <button type="button" key={c} onClick={() => setSetCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1 px-2 rounded text-[11px] font-bold border truncate ${setCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-black border border-zinc-800 rounded-xl">
              <span className="text-xs text-zinc-300 font-bold">Auto-Mask Passwords on Asset Cards</span>
              <button type="button" onClick={() => setAutoMaskVault(!autoMaskVault)} className={`px-3 py-1 rounded text-xs font-bold ${autoMaskVault ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                {autoMaskVault ? "ON" : "OFF"}
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Update Password (Optional)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            </div>

            <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl text-xs">
              Save & Sync SMM Settings
            </button>
          </form>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingAsset(null)}>
          <form onSubmit={handleUpdateExistingAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-3">
            <h3 className="text-base font-bold text-white">Update Asset Credentials</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={editingAsset.account_id || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_id: e.target.value })} placeholder="Asset ID" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" value={editingAsset.account_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, account_password: e.target.value })} placeholder="Asset Password" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="email" value={editingAsset.email || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email: e.target.value })} placeholder="Email" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              <input type="text" value={editingAsset.email_password || ""} onChange={(e) => setEditingAsset({ ...editingAsset, email_password: e.target.value })} placeholder="Email Password" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            </div>
            <select value={editingAsset.country_language || "Ethiopia"} onChange={(e) => setEditingAsset({ ...editingAsset, country_language: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white">
              {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Asset Changes</button>
          </form>
        </div>
      )}
    </div>
  );
}
