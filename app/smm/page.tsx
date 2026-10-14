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
