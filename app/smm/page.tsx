"use client";

import { useState, useEffect, useCallback } from "react";
import { smmSupabase as supabase, broadcastRealtimeSync } from "@/lib/supabase";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const COUNTRY_OPTIONS = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France",
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany",
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function SMMDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [allTeamLeaders, setAllTeamLeaders] = useState<any[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [selectedTl, setSelectedTl] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "register" | "assets" | "settings">("log");
  const [statusMsg, setStatusMsg] = useState("");
  const [motd, setMotd] = useState("");
  const [lastSync, setLastSync] = useState("Live");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

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

  // Handler Settings Tab State
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [setPlatforms, setSetPlatforms] = useState<string[]>([]);
  const [setTlIds, setSetTlIds] = useState<string[]>([]);
  const [setNewPass, setSetNewPass] = useState("");

  const refreshSMMWorkspace = useCallback(async (userId: string, currentAssetId?: string) => {
    const [profRes, assetRes, sysRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("social_assets").select("*").eq("smm_id", userId).order("created_at", { ascending: false }),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (profRes.data) {
      setProfile(profRes.data);
      const assignedIds = profRes.data.team_leader_ids?.length > 0
        ? profRes.data.team_leader_ids
        : (profRes.data.team_leader_id ? [profRes.data.team_leader_id] : []);
      const myTls = allTeamLeaders.filter((t: any) => assignedIds.includes(t.id));
      setTeamLeaders(myTls.length > 0 ? myTls : allTeamLeaders);
    }

    if (assetRes.data) {
      setAssets(assetRes.data);
      const targetAsset = currentAssetId || selectedAssetId || assetRes.data[0]?.id || "";
      if (targetAsset) {
        if (!selectedAssetId) setSelectedAssetId(targetAsset);
        const { data: mData } = await supabase
          .from("weekly_metrics")
          .select("*")
          .eq("asset_id", targetAsset)
          .order("week_of", { ascending: false });
        if (mData) setMetricsHistory(mData);
      }
    }

    if (sysRes.data?.motd) setMotd(sysRes.data.motd);
    setLastSync(new Date().toLocaleTimeString());
  }, [allTeamLeaders, selectedAssetId]);

  useEffect(() => {
    initSMM();
  }, []);

  // Live Realtime Sync Subscription
  useEffect(() => {
    if (!profile?.id) return;

    const pgChannel = supabase
      .channel("smm-postgres-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refreshSMMWorkspace(profile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => refreshSMMWorkspace(profile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => refreshSMMWorkspace(profile.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => refreshSMMWorkspace(profile.id))
      .subscribe();

    const broadcastChannel = supabase
      .channel("executive-live-sync")
      .on("broadcast", { event: "db-sync" }, () => refreshSMMWorkspace(profile.id))
      .subscribe();

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [profile?.id, refreshSMMWorkspace]);

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
    setSetFullName(prof.full_name || "");
    setSetCountries((prof.country || "Africa").split(",").map((c: string) => c.trim()).filter(Boolean));
    setSetPlatforms(prof.platforms?.length > 0 ? prof.platforms : ["twitter"]);

    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    const tls = json.teamLeaders || [];
    setAllTeamLeaders(tls);

    const assignedIds = prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : (prof.team_leader_id ? [prof.team_leader_id] : []);
    setSetTlIds(assignedIds);
    const myTls = tls.filter((t: any) => assignedIds.includes(t.id));
    const finalTls = myTls.length > 0 ? myTls : tls;
    setTeamLeaders(finalTls);
    if (finalTls.length > 0) {
      setSelectedTl("all");
      setRegTlId(finalTls[0].id);
    }

    await refreshSMMWorkspace(session.user.id);
  };

  const notifyAndReload = async (msg: string, assetIdOverride?: string) => {
    setStatusMsg(msg);
    if (profile?.id) await refreshSMMWorkspace(profile.id, assetIdOverride);
    await broadcastRealtimeSync("smm");
    setTimeout(() => setStatusMsg(""), 4000);
  };

  const loadMetrics = async (assetId: string) => {
    if (!assetId) return;
    const { data } = await supabase.from("weekly_metrics").select("*").eq("asset_id", assetId).order("week_of", { ascending: false });
    if (data) setMetricsHistory(data);
  };

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Registering new Asset into vault...");
    const { data, error } = await supabase.from("social_assets").insert([{
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
    }]).select().single();

    if (error) {
      setStatusMsg("Error: " + error.message);
    } else {
      setProfileLink(""); setBio(""); setAccountId(""); setAccountPassword("");
      setEmail(""); setEmailPassword(""); setTwoFaCode(""); setPhoneNumber("");
      if (data?.id) setSelectedAssetId(data.id);
      await notifyAndReload("✅ Asset Registered & Synced Live!", data?.id);
      setActiveTab("assets");
    }
  };

  const handleToggleAssetStatus = async (asset: any) => {
    const newStatus = asset.status === "active" ? "suspended" : "active";
    await supabase.from("social_assets").update({ status: newStatus }).eq("id", asset.id);
    await notifyAndReload(`Asset ${asset.account_id} is now ${newStatus.toUpperCase()}`);
  };

  const handleUpdateAssetDetails = async (assetId: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("social_assets").update(updates).eq("id", assetId);
    if (!error) {
      setEditingAssetId(null);
      await notifyAndReload("✅ Asset details updated & synced live!");
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset and its metrics?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    if (selectedAssetId === assetId) setSelectedAssetId("");
    await notifyAndReload("🗑 Asset deleted.");
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
      setImpressions(""); setEngagements(""); setLikes(""); setSharesReposts(""); setComments("");
      setFollowersGained(""); setFollowersLost(""); setTotalFollowers(""); setPostsPublished(""); setTopPostImpr("");
      await notifyAndReload("✅ Weekly Metrics Logged & Synced Live!", selectedAssetId);
    }
  };

  const handleSaveHandlerSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setCountries.length === 0) return setStatusMsg("Select at least one country.");
    if (setTlIds.length === 0) return setStatusMsg("Select at least one Team Leader.");

    const countryStr = setCountries.join(", ");
    await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_profile",
        id: profile.id,
        full_name: setFullName,
        country: countryStr,
        platforms: setPlatforms,
        team_leader_id: setTlIds[0],
        team_leader_ids: setTlIds,
      }),
    });

    if (setNewPass && setNewPass.length >= 6) {
      await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_auth", id: profile.id, password: setNewPass }),
      });
      setSetNewPass("");
    }

    await notifyAndReload("✅ Handler profile, Team Leaders & security settings updated live!");
  };

  const toggleItem = (item: string, list: string[], setList: any) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
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
        
        {motd && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-2.5 text-xs text-purple-300 flex items-center gap-2">
            <span className="font-bold uppercase bg-purple-500 text-black px-2 py-0.5 rounded text-[10px]">HQ Broadcast</span>
            <span>{motd}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">SMM Asset Handler Portal</span>
              <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-purple-400 px-2.5 py-1 rounded-full">
                ⚡ LIVE ASSET SYNC ({lastSync})
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">{profile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {profile.country} • Metric Input: {profile.is_locked ? <span className="text-red-400 font-bold">🔒 LOCKED BY TEAM LEADER</span> : <span className="text-emerald-400 font-bold">🔓 OPEN</span>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab("log")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "log" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>📊 Log Asset Metrics</button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>🗂 My Registered Assets ({assets.length})</button>
            <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "register" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-emerald-400 border border-emerald-500/30"}`}>+ Register New Asset</button>
            <button onClick={() => setActiveTab("settings")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "settings" ? "bg-purple-600 text-white" : "bg-zinc-900 text-purple-300 border border-purple-500/30"}`}>⚙ Handler Settings</button>
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
              {filteredAssets.length === 0 ? <option value="">No Assets Registered — Click &quot;+ Register New Asset&quot;</option> : filteredAssets.map(a => (
                <option key={a.id} value={a.id}>ASSET: [{a.platform.toUpperCase()}] {a.account_id} ({a.status.toUpperCase()})</option>
              ))}
            </select>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* TAB 1: LOG WEEKLY METRICS */}
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
                  You have no registered Assets yet. Click <b>&quot;+ Register New Asset&quot;</b> above first.
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
                  {profile.is_locked ? "🔒 Asset Input Locked by Team Leader" : "Submit Weekly Asset Report Live"}
                </button>
              </form>
            </div>

            {/* Historical Weekly Reports Table */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-1">Weekly Asset Performance Ledger</h2>
              <p className="text-xs text-zinc-400 mb-4">Click any row below to load its numbers into the form for instant editing.</p>
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
                    <th className="p-3">Posts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {metricsHistory.map(m => {
                    const engRate = m.impressions > 0 ? ((m.engagements / m.impressions) * 100).toFixed(2) : "0.00";
                    const netFol = (m.followers_gained || 0) - (m.followers_lost || 0);
                    return (
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
                        className="hover:bg-zinc-900/60 cursor-pointer font-mono"
                      >
                        <td className="p-3 font-bold text-white">{m.week_of} ✎</td>
                        <td className="p-3 text-blue-400">{m.impressions.toLocaleString()}</td>
                        <td className="p-3 text-purple-400">{m.engagements.toLocaleString()}</td>
                        <td className="p-3 text-emerald-400">{engRate}%</td>
                        <td className="p-3">{m.likes} / {m.shares_reposts}</td>
                        <td className={`p-3 font-bold ${netFol >= 0 ? "text-emerald-400" : "text-red-400"}`}>{netFol >= 0 ? `+${netFol}` : netFol}</td>
                        <td className="p-3 text-white">{m.total_followers.toLocaleString()}</td>
                        <td className="p-3">{m.posts_published}</td>
                      </tr>
                    );
                  })}
                  {metricsHistory.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-zinc-500">No weekly metrics logged for this Asset yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER NEW ASSET */}
        {activeTab === "register" && (
          <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-1">2.1 Register New Asset Details</h2>
            <p className="text-xs text-emerald-400 mb-6">Enter credentials strictly for the Social Media Asset you are handling.</p>
            
            <form onSubmit={handleRegisterAsset} autoComplete="off" className="space-y-4">
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
                  <input type="text" required value={regProject} onChange={(e) => setRegProject(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Asset Profile Link</label>
                <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="https://x.com/your_asset_handle" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">2. Asset Bio</label>
                <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio written on the Asset profile" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">3. Asset ID (Username / @Handle)</label>
                  <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="e.g. @SaharaVoiceX" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">4. Asset Password</label>
                  <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Asset's Social Media Password" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">5. Asset Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="asset_email@domain.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">6. Asset Email Password</label>
                  <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Password for the Asset's Email" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">7. Asset 2FA Code</label>
                  <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="Asset 2FA / Backup Key" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">8. Asset Country</label>
                  <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white">
                    {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">9. Asset Phone Number</label>
                  <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone linked to Asset" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm transition-all mt-2">
                Save & Register Asset Live
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: MY REGISTERED ASSETS (WITH INLINE EDITING) */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => (
              <SMMAssetCard
                key={asset.id}
                asset={asset}
                teamLeaders={teamLeaders}
                isEditing={editingAssetId === asset.id}
                onToggleEdit={() => setEditingAssetId(editingAssetId === asset.id ? null : asset.id)}
                onToggleStatus={() => handleToggleAssetStatus(asset)}
                onSave={(updates: any) => handleUpdateAssetDetails(asset.id, updates)}
                onDelete={() => handleDeleteAsset(asset.id)}
                onSelectForLog={() => { setSelectedAssetId(asset.id); loadMetrics(asset.id); setActiveTab("log"); }}
              />
            ))}
            {filteredAssets.length === 0 && <div className="col-span-3 text-center text-zinc-500 py-12">No Assets registered under this filter yet.</div>}
          </div>
        )}

        {/* TAB 4: HANDLER SETTINGS */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-2xl p-8 space-y-6 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-white">⚙ SMM Handler Profile & Workspace Settings</h2>
              <p className="text-xs text-zinc-400 mt-1">Changes sync live to your Team Leader and Admin Command Center immediately.</p>
            </div>

            <form onSubmit={handleSaveHandlerSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Handler Full Name</label>
                  <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">New Portal Password (Optional)</label>
                  <input type="password" value={setNewPass} onChange={(e) => setSetNewPass(e.target.value)} placeholder="Leave blank to keep current" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Team Leader(s)</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {allTeamLeaders.map(tl => (
                    <button
                      type="button"
                      key={tl.id}
                      onClick={() => toggleItem(tl.id, setTlIds, setSetTlIds)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border text-left truncate ${setTlIds.includes(tl.id) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}
                    >
                      ✓ {tl.full_name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Active Platforms</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {PLATFORMS.map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => toggleItem(p, setPlatforms, setSetPlatforms)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase border ${setPlatforms.includes(p) ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-black border-zinc-800 text-zinc-500"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {COUNTRY_OPTIONS.map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => toggleItem(c, setCountries, setSetCountries)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border truncate ${setCountries.includes(c) ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-black border-zinc-800 text-zinc-500"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-sm transition-all">
                Save Handler Settings Live
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

function SMMAssetCard({ asset, teamLeaders, isEditing, onToggleEdit, onToggleStatus, onSave, onDelete, onSelectForLog }: any) {
  const [accountId, setAccountId] = useState(asset.account_id || "");
  const [profileLink, setProfileLink] = useState(asset.profile_link || "");
  const [bio, setBio] = useState(asset.bio || "");
  const [accountPassword, setAccountPassword] = useState(asset.account_password || "");
  const [email, setEmail] = useState(asset.email || "");
  const [emailPassword, setEmailPassword] = useState(asset.email_password || "");
  const [twoFaCode, setTwoFaCode] = useState(asset.two_fa_code || "");
  const [phoneNumber, setPhoneNumber] = useState(asset.phone_number || "");
  const [projectName, setProjectName] = useState(asset.project_name || "General Campaign");
  const [tlId, setTlId] = useState(asset.team_leader_id || "");

  return (
    <div className="bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 rounded-2xl p-5 space-y-3 transition-all">
      <div className="flex justify-between items-center">
        <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase">
          {asset.platform}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={onToggleEdit} className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white">
            {isEditing ? "Cancel" : "✎ Edit"}
          </button>
          <button onClick={onToggleStatus} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {asset.status === "active" ? "● Active" : "⚠ Suspended"}
          </button>
          <button onClick={onDelete} className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs">✕</button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2 pt-2 text-xs">
          <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Asset Handle" className="w-full rounded bg-black border border-zinc-800 p-2 text-white" />
          <input type="url" value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="Profile Link" className="w-full rounded bg-black border border-zinc-800 p-2 text-white" />
          <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Asset Bio" className="w-full rounded bg-black border border-zinc-800 p-2 text-white" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Asset Password" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Asset Email" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Email Pass" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="2FA Code" className="rounded bg-black border border-zinc-800 p-2 text-white" />
            <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone" className="rounded bg-black border border-zinc-800 p-2 text-white" />
          </div>
          <select value={tlId} onChange={(e) => setTlId(e.target.value)} className="w-full rounded bg-black border border-zinc-800 p-2 text-white">
            {teamLeaders.map((t: any) => <option key={t.id} value={t.id}>TL: {t.full_name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => onSave({
              account_id: accountId, profile_link: profileLink, bio, account_password: accountPassword,
              email, email_password: emailPassword, two_fa_code: twoFaCode, phone_number: phoneNumber,
              project_name: projectName, team_leader_id: tlId
            })}
            className="w-full py-2 bg-emerald-500 text-black font-bold rounded-lg"
          >
            Save Asset Credentials Live
          </button>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-bold text-white">{asset.account_id}</h3>
            <a href={asset.profile_link} target="_blank" className="text-xs text-blue-400 underline truncate block">{asset.profile_link}</a>
            <p className="text-xs text-zinc-400 mt-1 italic">Bio: &quot;{asset.bio}&quot;</p>
          </div>
          <div className="text-[11px] bg-zinc-900 p-3 rounded-lg space-y-1 font-mono text-zinc-300">
            <div><b>Project:</b> {asset.project_name}</div>
            <div><b>Country:</b> {asset.country_language}</div>
            <div><b>Email:</b> {asset.email}</div>
            <div><b>Phone:</b> {asset.phone_number || "N/A"}</div>
          </div>
          <button
            onClick={onSelectForLog}
            className="w-full py-2 bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition-all"
          >
            📊 Log Weekly Metrics for This Asset →
          </button>
        </>
      )}
    </div>
  );
}
