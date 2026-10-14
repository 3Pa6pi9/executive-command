"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const COUNTRY_LANG_OPTIONS = ["UK", "Malaysia", "Russia", "Belurus", "Romania", "France", "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", "Kosavo", "Greece", "Hungary", "Africa"];

export default function SMMDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [selectedTl, setSelectedTl] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "register" | "assets">("log");
  const [statusMsg, setStatusMsg] = useState("");

  // 9 Ordered Asset Registration Fields (From Josiah's Blueprint)
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
  const [countryLanguage, setCountryLanguage] = useState(COUNTRY_LANG_OPTIONS[0]);
  const [phoneNumber, setPhoneNumber] = useState("");

  // Weekly Metrics Form State (From Google Sheet)
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
    if (!prof) return;
    setProfile(prof);

    const { data: tls } = await supabase.from("profiles").select("id, full_name").eq("role", "team_leader");
    if (tls) {
      const assignedIds = prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : (prof.team_leader_id ? [prof.team_leader_id] : []);
      const myTls = tls.filter(t => assignedIds.includes(t.id));
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

  // Step 2.1: Register New Social Media Account in Exact Order
  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Registering social media asset...");
    const { error } = await supabase.from("social_assets").insert([{
      smm_id: profile.id,
      team_leader_id: regTlId || profile.team_leader_id,
      platform: regPlatform,
      project_name: regProject,
      status: "active",
      profile_link: profileLink,
      bio,
      account_id: accountId,
      account_password: accountPassword,
      email,
      email_password: emailPassword,
      two_fa_code: twoFaCode,
      country_language: countryLanguage,
      phone_number: phoneNumber
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

  // Toggle Suspended / Active Status
  const handleToggleAssetStatus = async (asset: any) => {
    const newStatus = asset.status === "active" ? "suspended" : "active";
    await supabase.from("social_assets").update({ status: newStatus }).eq("id", asset.id);
    await loadAssets(profile.id);
  };

  // Submit Weekly Report Metrics
  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.is_locked) return alert("Your Team Leader has locked weekly metric submissions.");
    if (!selectedAssetId) return alert("Please select an account/asset first.");

    setStatusMsg("Saving Weekly Report...");
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
      setStatusMsg("Weekly Metrics Logged Successfully!");
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

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono">Loading SMM Workspace...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">SMM Handler Portal</span>
            <h1 className="text-3xl font-bold text-white mt-2">{profile.full_name}</h1>
            <p className="text-xs text-zinc-400">Country: {profile.country} • Status: {profile.is_locked ? <span className="text-red-400 font-bold">🔒 INPUT LOCKED BY TL</span> : <span className="text-emerald-400 font-bold">🔓 ACTIVE</span>}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("log")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "log" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>📊 Log Weekly Metrics</button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>🗂 My Accounts ({assets.length})</button>
            <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "register" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-emerald-400 border border-emerald-500/30"}`}>+ Register New Account</button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">Sign Out</button>
          </div>
        </div>

        {/* Filters: Team Leader & Platform Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">1. Filter by Team Leader</label>
            <select value={selectedTl} onChange={(e) => setSelectedTl(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white outline-none">
              <option value="all">All My Team Leaders</option>
              {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">2. Filter by Social Network</label>
            <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} className="w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white uppercase outline-none">
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">3. Select Account (Asset) to Log</label>
            <select value={selectedAssetId} onChange={(e) => { setSelectedAssetId(e.target.value); loadMetrics(e.target.value); }} className="w-full mt-1 rounded-lg bg-zinc-900 border border-purple-500/40 p-2.5 text-sm text-white outline-none">
              {filteredAssets.length === 0 ? <option value="">No Accounts Found — Register One!</option> : filteredAssets.map(a => (
                <option key={a.id} value={a.id}>[{a.platform.toUpperCase()}] {a.account_id} ({a.status.toUpperCase()})</option>
              ))}
            </select>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* TAB 1: LOG WEEKLY METRICS */}
        {activeTab === "log" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Log Weekly Report</h2>
              {activeAsset && (
                <div className="p-3 bg-zinc-900/70 rounded-lg border border-zinc-800 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-400 uppercase">{activeAsset.platform} — {activeAsset.account_id}</span>
                    <button onClick={() => handleToggleAssetStatus(activeAsset)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeAsset.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                      {activeAsset.status === "active" ? "● ACTIVE (Click to Suspend)" : "⚠ SUSPENDED (Click to Activate)"}
                    </button>
                  </div>
                  <p className="text-zinc-400 truncate">Link: <a href={activeAsset.profile_link} target="_blank" className="text-blue-400 underline">{activeAsset.profile_link}</a></p>
                  {(activeAsset.tl_task || activeAsset.tl_campaign || activeAsset.tl_comment) && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1 text-[11px]">
                      {activeAsset.tl_campaign && <p className="text-blue-300">🎯 <b>Campaign:</b> {activeAsset.tl_campaign}</p>}
                      {activeAsset.tl_task && <p className="text-emerald-300">📋 <b>Task:</b> {activeAsset.tl_task}</p>}
                      {activeAsset.tl_comment && <p className="text-amber-300">💬 <b>TL Note:</b> {activeAsset.tl_comment}</p>}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleLogMetrics} className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Week Of (Date)</label>
                  <input type="date" required value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-2 text-sm text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Impressions / Views" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Engagements" value={engagements} onChange={(e) => setEngagements(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Likes" value={likes} onChange={(e) => setLikes(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Reposts / Shares" value={sharesReposts} onChange={(e) => setSharesReposts(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Comments / Replies" value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Posts Published" value={postsPublished} onChange={(e) => setPostsPublished(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Followers Gained" value={followersGained} onChange={(e) => setFollowersGained(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Followers Lost" value={followersLost} onChange={(e) => setFollowersLost(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Total Followers" value={totalFollowers} onChange={(e) => setTotalFollowers(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                  <input type="number" placeholder="Top Post Impr." value={topPostImpr} onChange={(e) => setTopPostImpr(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                </div>
                <button type="submit" disabled={profile.is_locked} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-lg text-sm transition-all">
                  {profile.is_locked ? "🔒 Locked by Team Leader" : "Submit Weekly Report"}
                </button>
              </form>
            </div>

            {/* Historical Weekly Reports Table */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-4">Weekly Performance Ledger (Auto-Calculated)</h2>
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
                  {metricsHistory.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-zinc-500">No weekly metrics logged for this account yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER NEW SOCIAL MEDIA ASSET (EXACT ORDER FROM BLUEPRINT) */}
        {activeTab === "register" && (
          <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-1">2.1 Add Social Media Account Details</h2>
            <p className="text-xs text-zinc-400 mb-6">Ordered strictly per agency onboarding protocol</p>
            <form onSubmit={handleRegisterAsset} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Platform</label>
                  <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white uppercase">
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader</label>
                  <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white">
                    {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Project / Campaign</label>
                  <input type="text" required value={regProject} onChange={(e) => setRegProject(e.target.value)} className="w-full mt-1 rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                </div>
              </div>

              {/* Exact 9-Field Sequence from Handwritten Note */}
              <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="1. Profile Link (e.g. https://x.com/account)" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="2. Bio" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="3. ID (Username / @Handle)" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="4. Account Password" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="5. Recovery / Login Email" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="6. Email Password" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="7. 2FA Code / Backup Key" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
                <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white">
                  {COUNTRY_LANG_OPTIONS.map(opt => <option key={opt} value={opt}>8. {opt}</option>)}
                </select>
                <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="9. Phone Number" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm transition-all">Save & Register Account Asset</button>
            </form>
          </div>
        )}

        {/* TAB 3: MY REGISTERED ASSETS & STATUS BUTTONS */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase">{asset.platform}</span>
                  <button onClick={() => handleToggleAssetStatus(asset)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"}`}>
                    {asset.status === "active" ? "● Active (Tap to Suspend)" : "⚠ Suspended (Tap to Activate)"}
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{asset.account_id}</h3>
                  <a href={asset.profile_link} target="_blank" className="text-xs text-blue-400 underline truncate block">{asset.profile_link}</a>
                  <p className="text-xs text-zinc-400 mt-1 italic">"{asset.bio}"</p>
                </div>
                <div className="text-[11px] bg-zinc-900 p-3 rounded-lg space-y-1 font-mono text-zinc-300">
                  <div><b>Project:</b> {asset.project_name}</div>
                  <div><b>Country/Lang:</b> {asset.country_language}</div>
                  <div><b>Email:</b> {asset.email}</div>
                  <div><b>Phone:</b> {asset.phone_number || "N/A"}</div>
                </div>
                {(asset.tl_campaign || asset.tl_task || asset.tl_comment) && (
                  <div className="text-xs bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg space-y-1">
                    {asset.tl_campaign && <p>🎯 <b>Campaign:</b> {asset.tl_campaign}</p>}
                    {asset.tl_task && <p>📋 <b>Task:</b> {asset.tl_task}</p>}
                    {asset.tl_comment && <p>💬 <b>Comment:</b> {asset.tl_comment}</p>}
                  </div>
                )}
              </div>
            ))}
            {filteredAssets.length === 0 && <div className="col-span-3 text-center text-zinc-500 py-12">No social media accounts registered under this filter.</div>}
          </div>
        )}

      </div>
    </div>
  );
}
