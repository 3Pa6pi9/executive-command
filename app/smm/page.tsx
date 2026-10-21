"use client";
import { GroupedMetricsTab } from "@/components/GroupedMetricsTab";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import {
  PLATFORMS,
  isPhoneInput,
  formatDisplayUsername,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  TimeHorizon,
  fetchAllRows,
  parseBulkRows,
  exportHorizonCSV,
  computeAchievements,
  getAssetAccountName,
  recordLocalArchiveEvent,
} from "@/lib/constants";
import {
  ActionButton,
  usePortalTheme,
  ThemePickerDropdown,
  useRealtimePresence,
  GroupedWeeklyMetricsForm,
  AssetGrowthModal,
  UniversalAssetEditModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  ExecutiveAnalyticsGraphs,
} from "@/components/EnterpriseUI";

export default function SMMDashboard() {
  const { themeId, changeTheme, currentTheme } = usePortalTheme();
  const [profile, setProfile] = useState<any>(null);
  const { onlineUsers } = useRealtimePresence(supabase, profile);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [allMyMetrics, setAllMyMetrics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "assets" | "graphs" | "achievements" | "register" | "bulk">("log");
  const [statusMsg, setStatusMsg] = useState("");
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");

  const [showSettings, setShowSettings] = useState(false);
  const [setFullName, setSetFullName] = useState("");
  const [setCountries, setSetCountries] = useState<string[]>([]);
  const [setPlatforms, setSetPlatforms] = useState<string[]>([]);
  const [setTlIds, setSetTlIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");

  const [regPlatform, setRegPlatform] = useState("twitter");
  const [regTlId, setRegTlId] = useState("");
  const [accountName, setAccountName] = useState("");
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
  const [bulkRawText, setBulkRawText] = useState("");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  useEffect(() => {
    let channel: any;
    initSMM().then((userId) => {
      if (!userId) return;
      channel = supabase
        .channel("smm-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => {
          setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); refreshProfileAndAssets(userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets", filter: `smm_id=eq.${userId}` }, () => {
          setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); refreshProfileAndAssets(userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => {
          setLiveSyncPulse(true); setTimeout(() => setLiveSyncPulse(false), 1200); refreshProfileAndAssets(userId);
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const initSMM = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return null; }
    await refreshProfileAndAssets(session.user.id, true);
    return session.user.id;
  };

  const refreshProfileAndAssets = async (userId: string, isInitial = false) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!prof || prof.role !== "smm") { await supabase.auth.signOut(); window.location.href = "/"; return; }
    setProfile(prof);
    if (isInitial) {
      setSetFullName(prof.full_name || "");
      setSetCountries((prof.country || "Kenya").split(",").map((c: string) => c.trim()).filter(Boolean));
      setSetPlatforms(prof.platforms?.length > 0 ? prof.platforms : ["twitter"]);
      setSetTlIds(prof.team_leader_ids?.length > 0 ? prof.team_leader_ids : prof.team_leader_id ? [prof.team_leader_id] : []);
    }

    fetch("/api/crud").then(r => r.json()).then(j => { if (typeof window !== "undefined") { (window as any).__pwMap = j.passwords || {}; (window as any).__emailMap = j.emails || {}; } });
    const res = await fetch("/api/team-leaders");
    const json = await res.json();
    const tls = json.teamLeaders || [];
    setTeamLeaders(tls);
    if (tls.length > 0 && isInitial) setRegTlId(prof.team_leader_id || tls[0].id);

    const assetList = await fetchAllRows(supabase, "social_assets", "created_at", "smm_id", userId);
    setAssets(assetList);
    const assetIds = assetList.map((a: any) => a.id);
    if (assetIds.length > 0) {
      const mAll = await fetchAllRows(supabase, "weekly_metrics", "week_of", "asset_id", assetIds);
      setAllMyMetrics(mAll);
    } else {
      setAllMyMetrics([]);
    }
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    if (asset.status === newStatus) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "update", payload: { id: asset.id, status: newStatus } }),
    });
    recordLocalArchiveEvent({
      actor_name: profile.full_name,
      actor_role: "smm",
      action: newStatus === "suspended" ? "SUSPENDED" : "ACTIVE",
      entity_type: "ASSET",
      entity_id: asset.id,
      summary: `${newStatus === "suspended" ? "Suspended" : "Activated"} Account: ${getAssetAccountName(asset)} (${asset.account_id})`,
      record_snapshot: { ...asset, status: newStatus },
    });
    setStatusMsg(`Account status updated to ${newStatus.toUpperCase()}.`);
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
        payload: { targetId: profile.id, full_name: setFullName, country: setCountries.join(", "), platforms: setPlatforms, team_leader_ids: setTlIds, newPassword },
      }),
    });
    setNewPassword(""); setShowSettings(false);
    setStatusMsg("Settings saved.");
    await refreshProfileAndAssets(profile.id);
  };

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReg(true);
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
          account_name: accountName.trim() || accountId.trim(),
          project_name: accountName.trim() || accountId.trim(),
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
          phone_number: regPlatform === "facebook" ? email.trim() : phoneNumber.trim(),
        },
      }),
    });
    setIsSubmittingReg(false);
    if (res.ok) {
      recordLocalArchiveEvent({
        actor_name: profile.full_name,
        actor_role: "smm",
        action: "CREATE",
        entity_type: "ASSET",
        summary: `Registered Account: ${accountName.trim() || accountId.trim()} (${accountId.trim()})`,
        record_snapshot: { account_name: accountName, account_id: accountId, platform: regPlatform },
      });
      setStatusMsg("Account registered.");
      setAccountName(""); setProfileLink(""); setBio(""); setAccountId(""); setAccountPassword("");
      setEmail(""); setEmailPassword(""); setTwoFaCode(""); setPhoneNumber("");
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
      account_name: r[0] || "Account",
      project_name: r[0] || "Account",
      account_id: r[1] || r[0] || "Pending",
      account_password: r[2] || "",
      email: r[3] || "",
      email_password: r[4] || "",
      profile_link: r[5] || "",
      bio: r[6] || "",
      two_fa_code: r[7] || "",
      phone_number: r[8] || "",
      country_language: r[9] || countryLanguage,
      language: r[10] || assetLang,
      platform: (r[11] || regPlatform).toLowerCase(),
      status: "active",
    }));
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "bulk_create", payload: { items } }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`Registered ${data.count} accounts.`);
      setBulkRawText(""); setActiveTab("assets");
      await refreshProfileAndAssets(profile.id);
    }
  };

  const handleUpdateExistingAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "update", payload: updatedAsset }),
    });
    setStatusMsg("Account updated.");
    setEditingAsset(null);
    await refreshProfileAndAssets(profile.id);
  };

  const handleDeleteOwnAsset = async (assetId: string) => {
    if (!confirm("Delete this account?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "delete", payload: { id: assetId } }),
    });
    setStatusMsg("Account deleted.");
    setEditingAsset(null);
    await refreshProfileAndAssets(profile.id);
  };

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm animate-pulse">Loading SMM Portal...</div>;
  }

  const myAchievements = computeAchievements(assets, allMyMetrics);
  const isTwitterReg = regPlatform === "twitter";
  const isFacebookReg = regPlatform === "facebook";

  return (
    <div className={`min-h-screen ${currentTheme.shellBg} p-3 sm:p-6 md:p-8 pb-28 md:pb-10 font-sans`}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">SMM Portal</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 text-emerald-400">LIVE ({onlineUsers.length} Online)</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${profile.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>{profile.is_locked ? "LOCKED" : "OPEN"}</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-white mt-1.5">{profile.full_name}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemePickerDropdown themeId={themeId} onChange={changeTheme} />
            <select value={csvHorizon} onChange={(e) => setCsvHorizon(e.target.value as TimeHorizon)} className="bg-zinc-900 border border-zinc-800 text-purple-300 text-xs font-bold px-2.5 py-2 rounded-xl uppercase">
              <option value="weekly">Weekly CSV</option><option value="monthly">Monthly CSV</option><option value="quarterly">Quarterly CSV</option><option value="yearly">Yearly CSV</option>
            </select>
            <ActionButton onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics: allMyMetrics, assets, profiles: [profile, ...teamLeaders], scopeLabel: `SMM_${profile.full_name}` })} loadingText="Exporting..." className="px-3 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs">
              Export CSV
            </ActionButton>
            <button type="button" onClick={() => setShowSettings(true)} className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 text-purple-300 font-bold rounded-xl text-xs">Settings</button>
            <ActionButton onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} loadingText="Signing out..." className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 rounded-xl text-xs">
              Sign Out
            </ActionButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <button type="button" onClick={() => setActiveTab("log")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "log" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>Weekly Metrics ({assets.length})</button>
          <button type="button" onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>My Accounts ({assets.length})</button>
          <button type="button" onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "register" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-emerald-400"}`}>+ Add Account</button>
          <button type="button" onClick={() => setActiveTab("graphs")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "graphs" ? "bg-cyan-400 text-black" : "bg-zinc-900 text-cyan-300"}`}>Summary Graphs</button>
          <button type="button" onClick={() => setActiveTab("achievements")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "achievements" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-yellow-300"}`}>Milestones</button>
          <button type="button" onClick={() => setActiveTab("bulk")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400"}`}>Bulk Import</button>
        </div>

        {statusMsg && <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-200 text-xs text-center font-bold">{statusMsg}</div>}

        {activeTab === "log" && (
          <GroupedWeeklyMetricsForm actorId={profile.id} assets={assets} allMetrics={allMyMetrics} isLocked={profile.is_locked} onSaved={async (msg: any) => { setStatusMsg(msg); await refreshProfileAndAssets(profile.id); }} onInspectAsset={(a: any) => setInspectingAsset(a)} />
        )}

        {activeTab === "assets" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const isSuspended = asset.status === "suspended";
              return (
                <div key={asset.id} onClick={() => setInspectingAsset(asset)} className="cursor-pointer bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3 relative">
                  <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                    <ActionButton onClick={() => handleSetAssetStatus(asset, isSuspended ? "active" : "suspended")} loadingText="..." className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${isSuspended ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                      {isSuspended ? "Suspended" : "Active"}
                    </ActionButton>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-24">{getAssetAccountName(asset)}</h3>
                  <p className="text-xs text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
                  <div className="grid grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-purple-600/20 text-purple-300 font-bold rounded-xl text-xs">View Details</button>
                    <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 text-emerald-400 font-bold rounded-xl text-xs">Edit Account</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "graphs" && <ExecutiveAnalyticsGraphs assets={assets} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onSelectAsset={(a: any) => setInspectingAsset(a)} />}

        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myAchievements.map((ach) => (
              <div key={ach.id} className="rounded-2xl p-5 border bg-zinc-950 border-zinc-800">
                <div className="flex justify-between items-center"><span className="text-2xl">{ach.icon}</span><span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300">{ach.unlocked ? "COMPLETED" : `${ach.progress}%`}</span></div>
                <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "register" && (
          <form onSubmit={handleRegisterAsset} className="max-w-3xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-extrabold text-white">Add New Social Media Asset (Complete Details)</h2>
              <span className="text-[11px] text-emerald-400 font-bold">All 12 Asset Fields</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Platform</label>
                <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">{PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">2. Supervising Team Leader</label>
                <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}</select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">3. Target Country</label>
                <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">4. Operating Language</label>
                <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{ASSET_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">5. Account Display Name / Bio</label>
                <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Account Display Name" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">6. Username / @Handle / ID</label>
                <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder={regPlatform === "twitter" ? "Twitter @Username" : "Account Username / ID"} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">7. Account Login Password</label>
                <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Account Login Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">8. {regPlatform === "facebook" ? "Facebook Email or Phone Number" : "Linked Recovery Email"}</label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={regPlatform === "facebook" ? "Facebook Email or Phone" : "Recovery Email Address"} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
              </div>
              {!(regPlatform === "facebook" && isPhoneInput(email)) ? (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">9. Recovery Email Password</label>
                  <input type="text" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Email Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
                </div>
              ) : (
                <div className="flex items-center px-3 py-2 mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">✓ Phone number entered — no email password needed</div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">10. Profile URL</label>
                <input type="url" value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="https://..." className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">11. 2FA Secret / Backup Code</label>
                <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="2FA Secret / Code (Optional)" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
              </div>
            </div>
            <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs">✓ Add Complete Asset</button>
          </form>
        )}

        {activeTab === "bulk" && (
          <form onSubmit={handleSmmBulkAssets} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Bulk Account Import</h2>
            <textarea rows={7} required value={bulkRawText} onChange={(e) => setBulkRawText(e.target.value)} placeholder="Account_Name, Username, Password, Email, Email_Password, Profile_Link, Bio, 2FA, Phone, Country, Language, Platform" className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white" />
            <ActionButton type="submit" loadingText="Importing..." className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl text-xs">Execute Bulk Import</ActionButton>
          </form>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveSMMSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 space-y-5">
            <h2 className="text-xl font-bold text-white">SMM Settings</h2>
            <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={setPlatforms} onChange={setSetPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={setCountries} onChange={setSetCountries} />
            <FancyEntityMultiSelect label="Assigned Team Leaders" items={teamLeaders.map((tl: any) => ({ id: tl.id, label: tl.full_name, sub: tl.country }))} selectedIds={setTlIds} onChange={setSetTlIds} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <ActionButton type="submit" loadingText="Saving..." className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl text-xs">Save Settings</ActionButton>
          </form>
        </div>
      )}

      {inspectingAsset && <AssetGrowthModal asset={inspectingAsset} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onClose={() => setInspectingAsset(null)} onEdit={(a: any) => setEditingAsset(a)} onToggleStatus={handleSetAssetStatus} />}
      {editingAsset && <UniversalAssetEditModal asset={editingAsset} teamLeaders={teamLeaders} canReassignSmm={false} onClose={() => setEditingAsset(null)} onSave={handleUpdateExistingAsset} onDelete={handleDeleteOwnAsset} />}
    </div>
  );
}
