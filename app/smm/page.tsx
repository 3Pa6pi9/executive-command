"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  TimeHorizon,
  fetchAllRows,
  computeLive2FACode,
  parseBulkRows,
  exportHorizonCSV,
  computeAchievements,
} from "@/lib/constants";
import {
  AssetGrowthModal,
  UniversalAssetEditModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  ExecutiveAnalyticsGraphs,
} from "@/components/EnterpriseUI";

export default function SMMDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [allMyMetrics, setAllMyMetrics] = useState<any[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "assets" | "graphs" | "achievements" | "register" | "bulk">("log");
  const [statusMsg, setStatusMsg] = useState("");
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpSeconds, setTotpSeconds] = useState<number>(30);

  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [setPlatforms, setSetPlatforms] = useState<string[]>([]);
  const [setTlIds, setSetTlIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [autoMaskVault, setAutoMaskVault] = useState(true);

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
  const [countryLanguage, setCountryLanguage] = useState("Kenya");
  const [assetLang, setAssetLang] = useState("English");
  const [phoneNumber, setPhoneNumber] = useState("");

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
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          refreshProfileAndAssets(userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          refreshProfileAndAssets(userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => {
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          refreshProfileAndAssets(userId);
        })
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const updateCodes = async () => {
      setTotpSeconds(30 - (Math.floor(Date.now() / 1000) % 30));
      const map: Record<string, string> = {};
      for (const a of assets) {
        if (a.two_fa_code) map[a.id] = await computeLive2FACode(a.two_fa_code);
      }
      setTotpCodes(map);
    };
    updateCodes();
    const t = setInterval(updateCodes, 1000);
    return () => clearInterval(t);
  }, [assets]);

  const initSMM = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/";
      return null;
    }
    await refreshProfileAndAssets(session.user.id, true);
    return session.user.id;
  };

  const loadMetrics = (assetId: string, metricsPool?: any[]) => {
    const source = metricsPool || allMyMetrics;
    setMetricsHistory(source.filter((m) => m.asset_id === assetId));
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
      setSetCountries(
        (prof.country || "Kenya")
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean)
      );
      setSetPlatforms(prof.platforms?.length > 0 ? prof.platforms : ["twitter"]);
      setSetTlIds(prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : prof.team_leader_id ? [prof.team_leader_id] : []);
    }

    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    const tls = json.teamLeaders || [];
    setTeamLeaders(tls);
    if (tls.length > 0 && isInitial) setRegTlId(prof.team_leader_id || tls[0].id);

    const assetList = await fetchAllRows(supabase, "social_assets", "created_at", "smm_id", userId);
    setAssets(assetList);
    const assetIds = assetList.map((a) => a.id);
    if (assetIds.length > 0) {
      const mAll = await fetchAllRows(supabase, "weekly_metrics", "week_of", "asset_id", assetIds);
      setAllMyMetrics(mAll);
      const targetId = selectedAssetId || assetList[0].id;
      if (!selectedAssetId) setSelectedAssetId(targetId);
      setMetricsHistory(mAll.filter((m) => m.asset_id === targetId));
    } else {
      setAllMyMetrics([]);
      setMetricsHistory([]);
    }
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: profile.id,
        entity: "asset",
        action: "update",
        payload: { id: asset.id, status: newStatus },
      }),
    });
    setStatusMsg(`Asset marked ${newStatus.toUpperCase()}`);
    await refreshProfileAndAssets(profile.id);
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
          newPassword,
        },
      }),
    });
    setNewPassword("");
    setShowSettings(false);
    setStatusMsg("✓ SMM Settings Synced Live!");
    await refreshProfileAndAssets(profile.id);
  };

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
          language: assetLang,
          phone_number: phoneNumber.trim(),
        },
      }),
    });
    if (res.ok) {
      setStatusMsg("✓ Asset Created Live!");
      setProfileLink("");
      setBio("");
      setAccountId("");
      setAccountPassword("");
      setEmail("");
      setEmailPassword("");
      setTwoFaCode("");
      setPhoneNumber("");
      await refreshProfileAndAssets(profile.id);
      setActiveTab("assets");
    }
  };

  const handleSmmBulkAssets = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkRawText);
    if (!rows.length) return;
    const items = rows.map((r) => ({
      smm_id: profile.id,
      team_leader_id: regTlId || profile.team_leader_id,
      account_id: r[0] || "Pending",
      account_password: r[1] || "",
      email: r[2] || "",
      email_password: r[3] || "",
      profile_link: r[4] || "",
      bio: r[5] || "",
      two_fa_code: r[6] || "",
      phone_number: r[7] || "",
      country_language: r[8] || countryLanguage,
      language: r[9] || assetLang,
      platform: (r[10] || regPlatform).toLowerCase(),
      project_name: r[11] || regProject,
      status: "active",
    }));
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "bulk_create", payload: { items } }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`⚡ Bulk registered ${data.count} Assets!`);
      setBulkRawText("");
      setActiveTab("assets");
      await refreshProfileAndAssets(profile.id);
    }
  };

  const handleUpdateExistingAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "update", payload: updatedAsset }),
    });
    setStatusMsg("✓ All 15 Asset Fields Updated Live!");
    setEditingAsset(null);
    await refreshProfileAndAssets(profile.id);
  };

  const handleDeleteOwnAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "delete", payload: { id: assetId } }),
    });
    setStatusMsg("🗑 Asset Deleted.");
    setEditingAsset(null);
    await refreshProfileAndAssets(profile.id);
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.is_locked) return alert("Locked by Team Leader.");
    if (!selectedAssetId) return alert("Select an Asset.");
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
          top_post_impressions: parseInt(topPostImpr) || 0,
        },
      }),
    });
    if (res.ok) {
      setStatusMsg("✓ Weekly Metrics Saved!");
      setImpressions("");
      setEngagements("");
      setLikes("");
      setSharesReposts("");
      setComments("");
      setFollowersGained("");
      setFollowersLost("");
      setTotalFollowers("");
      setPostsPublished("");
      setTopPostImpr("");
      await refreshProfileAndAssets(profile.id);
    }
  };

  const handleDeleteMetricRow = async (metricId: string) => {
    if (profile?.is_locked) return alert("Locked by Team Leader.");
    if (!confirm("Delete this weekly metric entry?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "metric", action: "delete", payload: { id: metricId } }),
    });
    setStatusMsg("🗑 Weekly metric entry deleted.");
    await refreshProfileAndAssets(profile.id);
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse">
        Loading SMM Workspace...
      </div>
    );
  }

  const activeAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const myAchievements = computeAchievements(assets, allMyMetrics);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 sm:p-6 md:p-8 pb-28 md:pb-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                @smm Portal
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  liveSyncPulse ? "bg-emerald-500/30 text-emerald-300" : "text-emerald-400 border-zinc-800"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>LIVE
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  profile.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {profile.is_locked ? "🔒 LOCKED" : "🔓 OPEN"}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">{profile.full_name}</h1>
            <p className="text-xs text-zinc-400">
              Countries: {profile.country} • Platforms: {(profile.platforms || ["twitter"]).join(", ").toUpperCase()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={csvHorizon}
              onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)}
              className="bg-zinc-900 border border-zinc-800 text-purple-300 text-xs font-bold px-2.5 py-2 rounded-xl uppercase"
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
                  metrics: allMyMetrics,
                  assets,
                  profiles: [profile, ...teamLeaders],
                  scopeLabel: `SMM_${profile.full_name}`,
                })
              }
              className="px-3 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs"
            >
              ⬇ CSV
            </button>
            <button onClick={() => setShowSettings(true)} className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 text-purple-300 font-bold rounded-xl text-xs">
              ⚙ Settings
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 rounded-xl text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex flex-wrap gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <button onClick={() => setActiveTab("log")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "log" ? "bg-purple-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400"}`}>
            📊 Weekly Metrics
          </button>
          <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400"}`}>
            🗂 My Assets ({assets.length})
          </button>
          <button onClick={() => setActiveTab("graphs")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "graphs" ? "bg-cyan-400 text-black shadow-md" : "bg-zinc-900 text-cyan-300"}`}>
            📈 Summary Graphs
          </button>
          <button onClick={() => setActiveTab("achievements")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "achievements" ? "bg-yellow-400 text-black shadow-md" : "bg-zinc-900 text-yellow-300"}`}>
            🏆 Achievements
          </button>
          <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "register" ? "bg-emerald-600 text-white shadow-md" : "bg-zinc-900 text-emerald-400"}`}>
            + Create Asset
          </button>
          <button onClick={() => setActiveTab("bulk")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "bulk" ? "bg-amber-500 text-black shadow-md" : "bg-zinc-900 text-amber-400"}`}>
            ⚡ Bulk Register
          </button>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-200 text-xs text-center font-bold animate-pulse">
            {statusMsg}
          </div>
        )}

        {/* TAB 1: WEEKLY METRICS */}
        {activeTab === "log" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-purple-300">Target Social Media Asset</span>
                {activeAsset && (
                  <button
                    type="button"
                    onClick={() => setInspectingAsset(activeAsset)}
                    className="text-[11px] text-blue-400 underline font-bold"
                  >
                    🔍 Full Details & Growth
                  </button>
                )}
              </div>

              <select
                value={selectedAssetId}
                onChange={(e) => {
                  setSelectedAssetId(e.target.value);
                  loadMetrics(e.target.value);
                }}
                className="w-full rounded-xl bg-zinc-900 border border-purple-500/40 p-3 text-sm text-white"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.platform.toUpperCase()}] {a.account_id} ({a.country_language} • {a.language || "English"})
                  </option>
                ))}
              </select>

              {activeAsset && (activeAsset.tl_campaign || activeAsset.tl_task) && (
                <div className="p-3 bg-purple-950/25 border border-purple-500/40 rounded-xl space-y-1 text-xs">
                  {activeAsset.tl_campaign && <div className="text-purple-200 font-bold">🎯 Campaign: {activeAsset.tl_campaign}</div>}
                  {activeAsset.tl_task && <div className="text-emerald-300">📋 Direction: {activeAsset.tl_task}</div>}
                </div>
              )}

              <form onSubmit={handleLogMetrics} className="space-y-3">
                <input
                  type="date"
                  required
                  value={weekOf}
                  onChange={(e) => setWeekOf(e.target.value)}
                  className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-sm text-white"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <input type="number" inputMode="numeric" placeholder="Impressions" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Engagements" value={engagements} onChange={(e) => setEngagements(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Likes" value={likes} onChange={(e) => setLikes(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Reposts / Shares" value={sharesReposts} onChange={(e) => setSharesReposts(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Posts Published" value={postsPublished} onChange={(e) => setPostsPublished(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Followers Gained" value={followersGained} onChange={(e) => setFollowersGained(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Followers Lost" value={followersLost} onChange={(e) => setFollowersLost(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Total Followers" value={totalFollowers} onChange={(e) => setTotalFollowers(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                  <input type="number" inputMode="numeric" placeholder="Top Post Impr." value={topPostImpr} onChange={(e) => setTopPostImpr(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
                </div>
                <button
                  type="submit"
                  disabled={profile.is_locked || !activeAsset}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs"
                >
                  Save Weekly Report
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 overflow-x-auto">
              <h2 className="text-base font-bold text-white mb-3">Weekly Performance Ledger (Tap Row to Edit)</h2>
              <table className="w-full text-left text-xs text-zinc-300 font-mono">
                <thead className="bg-zinc-900 text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Week</th>
                    <th className="p-3">Impr</th>
                    <th className="p-3">Eng</th>
                    <th className="p-3">Followers</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metricsHistory.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => {
                        setWeekOf(m.week_of);
                        setImpressions(String(m.impressions || 0));
                        setEngagements(String(m.engagements || 0));
                        setLikes(String(m.likes || 0));
                        setSharesReposts(String(m.shares_reposts || 0));
                        setComments(String(m.comments || 0));
                        setFollowersGained(String(m.followers_gained || 0));
                        setFollowersLost(String(m.followers_lost || 0));
                        setTotalFollowers(String(m.total_followers || 0));
                        setPostsPublished(String(m.posts_published || 0));
                        setTopPostImpr(String(m.top_post_impressions || 0));
                      }}
                      className="hover:bg-zinc-900/60 cursor-pointer"
                    >
                      <td className="p-3 font-bold text-white">{m.week_of}</td>
                      <td className="p-3 text-blue-400">{(m.impressions || 0).toLocaleString()}</td>
                      <td className="p-3 text-purple-400">{(m.engagements || 0).toLocaleString()}</td>
                      <td className="p-3 text-white">{(m.total_followers || 0).toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMetricRow(m.id);
                          }}
                          className="text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {metricsHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-500">
                        No weekly logs recorded for this Asset yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MY ASSETS */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const isSuspended = asset.status === "suspended";
              const aLogs = allMyMetrics.filter((m) => m.asset_id === asset.id);
              const totalImpr = aLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
              const latestFol = aLogs[0]?.total_followers || 0;

              return (
                <div
                  key={asset.id}
                  onClick={() => setInspectingAsset(asset)}
                  className={`cursor-pointer bg-zinc-950 border rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-purple-500/60 ${
                    isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetAssetStatus(asset, isSuspended ? "active" : "suspended");
                    }}
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 transition-all ${
                      isSuspended
                        ? "bg-red-500/20 border-red-500/40 text-red-300"
                        : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    }`}
                  >
                    <span>{isSuspended ? "⚠ SUSP" : "● ACTV"}</span>
                    <span>⇄</span>
                  </button>

                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-bold uppercase">
                      {asset.platform}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-20">{asset.account_id}</h3>
                    <p className="text-[11px] text-zinc-400">
                      🌍 {asset.country_language || "Global"} • 🗣 {asset.language || "English"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-black border border-zinc-900 rounded-xl text-[11px] font-mono">
                    <div>
                      <span className="text-zinc-500 block text-[9px]">TOTAL IMPR</span>
                      <span className="text-blue-400 font-bold">{totalImpr.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[9px]">FOLLOWERS</span>
                      <span className="text-emerald-400 font-bold">{latestFol.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-black/70 border border-zinc-900 rounded-xl text-[11px] font-mono space-y-1">
                    <div>
                      Pass:{" "}
                      <span className={autoMaskVault ? "blur-[4px]" : "text-emerald-400"}>
                        {asset.account_password || "N/A"}
                      </span>
                    </div>
                    {asset.two_fa_code && (
                      <div className="text-amber-300">
                        🔐 2FA: {totpCodes[asset.id] || "------"} ({totpSeconds}s)
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setInspectingAsset(asset)}
                      className="py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold rounded-xl text-xs"
                    >
                      📈 Full Details & Growth
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAsset(asset)}
                      className="py-2 bg-zinc-900 border border-zinc-800 text-emerald-400 font-bold rounded-xl text-xs"
                    >
                      ✎ Edit All 15 Fields
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: DEEP SUMMARY GRAPHS */}
        {activeTab === "graphs" && (
          <ExecutiveAnalyticsGraphs
            assets={assets}
            metrics={allMyMetrics}
            profiles={[profile, ...teamLeaders]}
            onSelectAsset={(a) => setInspectingAsset(a)}
            titlePrefix={`${profile.full_name} Personal`}
          />
        )}

        {/* TAB 4: ACHIEVEMENTS */}
        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myAchievements.map((ach) => (
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

        {/* TAB 5: REGISTER NEW ASSET */}
        {activeTab === "register" && (
          <form onSubmit={handleRegisterAsset} autoComplete="off" className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">Create & Register New Social Media Asset</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Platform (SM Type)</label>
                <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader</label>
                <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>{tl.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Campaign / Project</label>
                <input type="text" required value={regProject} onChange={(e) => setRegProject(e.target.value)} placeholder="Campaign" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Country</label>
                <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                  {ALL_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Asset Operating Language</label>
                <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                  {ASSET_LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="1. Profile URL (https://...)" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="2. Profile Bio" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="3. Asset ID / @Handle" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="4. Asset Login Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="5. Recovery Email" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="6. Recovery Email Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="7. 2FA Secret / Backup Code" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="8. Linked Phone Number" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>

            <button type="submit" className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">
              Save & Register Asset Live
            </button>
          </form>
        )}

        {/* TAB 6: BULK REGISTER */}
        {activeTab === "bulk" && (
          <form onSubmit={handleSmmBulkAssets} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">⚡ Bulk Asset Registration (Includes Country & Language)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>Default SM: {p}</option>
                ))}
              </select>
              <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>Default Country: {c}</option>
                ))}
              </select>
              <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ASSET_LANGUAGES.map((l) => (
                  <option key={l} value={l}>Default Language: {l}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={7}
              required
              value={bulkRawText}
              onChange={(e) => setBulkRawText(e.target.value)}
              placeholder="Asset_ID, Password, Email, Email_Pass, Link, Bio, 2FA, Phone, Country, Language, Platform, Project"
              className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white"
            />
            <button type="submit" className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl text-xs">
              ⚡ Execute Bulk Import
            </button>
          </form>
        )}
      </div>

      {/* MOBILE STICKY BOTTOM DOCK */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-1.5 py-1.5 flex justify-around items-center">
        {[
          { id: "log", icon: "📊", label: "Metrics" },
          { id: "assets", icon: "🗂", label: `Assets (${assets.length})` },
          { id: "register", icon: "➕", label: "Add" },
          { id: "graphs", icon: "📈", label: "Graphs" },
          { id: "achievements", icon: "🏆", label: "Badges" },
          { id: "bulk", icon: "⚡", label: "Bulk" },
        ].map((t: any) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center py-1 px-2 rounded-xl ${
              activeTab === t.id ? "text-purple-400 font-bold bg-purple-500/10" : "text-zinc-500"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>

      {/* SMM SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form
            onSubmit={handleSaveSMMSettings}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 space-y-5"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">⚙ SMM Profile & Workspace Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Handler Display Name</label>
              <input
                type="text"
                required
                value={setFullName}
                onChange={(e) => setSetFullName(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white"
              />
            </div>

            <FancyMultiSelect label="Managed Platforms (Social Media)" options={PLATFORMS} selected={setPlatforms} onChange={setSetPlatforms} />

            <FancyMultiSelect label="Assigned Countries" options={ALL_COUNTRIES} selected={setCountries} onChange={setSetCountries} />

            <FancyEntityMultiSelect
              label="Assigned Team Leaders"
              items={teamLeaders.map((tl) => ({ id: tl.id, label: tl.full_name, sub: tl.country }))}
              selectedIds={setTlIds}
              onChange={setSetTlIds}
            />

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">New Portal Password (Optional)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black border border-zinc-900 rounded-xl text-xs">
              <span>Auto-mask passwords on Asset cards</span>
              <input type="checkbox" checked={autoMaskVault} onChange={(e) => setAutoMaskVault(e.target.checked)} />
            </div>

            <button type="submit" className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl text-xs">
              Save SMM Settings Live
            </button>
          </form>
        </div>
      )}

      {/* FULL ASSET INSPECTOR MODAL */}
      {inspectingAsset && (
        <AssetGrowthModal
          asset={inspectingAsset}
          metrics={allMyMetrics}
          profiles={[profile, ...teamLeaders]}
          onClose={() => setInspectingAsset(null)}
          onEdit={(a) => setEditingAsset(a)}
          onToggleStatus={handleSetAssetStatus}
        />
      )}

      {/* UNIVERSAL 15-FIELD ASSET EDITOR MODAL */}
      {editingAsset && (
        <UniversalAssetEditModal
          asset={editingAsset}
          teamLeaders={teamLeaders}
          canReassignSmm={false}
          onClose={() => setEditingAsset(null)}
          onSave={handleUpdateExistingAsset}
          onDelete={handleDeleteOwnAsset}
        />
      )}
    </div>
  );
}
