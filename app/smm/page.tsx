"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import {
  PLATFORMS,
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
  useRealtimePresence,
  GroupedWeeklyMetricsForm,
  AssetGrowthModal,
  UniversalAssetEditModal,
  FancyMultiSelect,
  FancyEntityMultiSelect,
  ExecutiveAnalyticsGraphs,
} from "@/components/EnterpriseUI";
import {
  ProfoundWorkspaceShell,
  useWorkspaceParadigm,
} from "@/components/ProfoundWorkspaces";

export default function SMMDashboard() {
  const { themeId, changeTheme } = usePortalTheme();
  const { paradigm, changeParadigm } = useWorkspaceParadigm("studio");

  const [profile, setProfile] = useState<any>(null);
  const { onlineUsers } = useRealtimePresence(supabase, profile);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [allMyMetrics, setAllMyMetrics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "assets" | "register" | "graphs" | "achievements" | "bulk">("log");
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
          setLiveSyncPulse(true);
          setTimeout(() => setLiveSyncPulse(false), 1200);
          refreshProfileAndAssets(userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets", filter: `smm_id=eq.${userId}` }, () => {
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
        summary: `Registered Account: ${accountName.trim() || accountId.trim()} (${accountId.trim()}) on ${regPlatform.toUpperCase()}`,
        record_snapshot: { account_name: accountName, account_id: accountId, platform: regPlatform, country_language: countryLanguage },
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
  const myViews = allMyMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const myLikes = allMyMetrics.reduce((s, m) => s + Number(m.likes || 0), 0);
  const myPosts = allMyMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);

  return (
    <ProfoundWorkspaceShell
      portalTitle={profile.full_name}
      roleLabel={profile.is_locked ? "SMM Handler (Locked)" : "SMM Handler"}
      userName={profile.full_name}
      userSub={profile.country}
      navItems={[
        { id: "log", code: "01", label: "Weekly Metrics", count: assets.length },
        { id: "assets", code: "02", label: "My Accounts", count: assets.length },
        { id: "register", code: "03", label: "Add Account" },
        { id: "graphs", code: "04", label: "Summary Graphs" },
        { id: "achievements", code: "05", label: "Milestones", count: myAchievements.length },
        { id: "bulk", code: "06", label: "Bulk Import" },
      ]}
      activeNav={activeTab}
      onSelectNav={(id: any) => setActiveTab(id)}
      telemetry={[
        { label: "Total Accounts", value: assets.length, tone: "purple" },
        { label: "Total Posts", value: myPosts.toLocaleString(), tone: "amber" },
        { label: "Total Views", value: myViews.toLocaleString(), tone: "blue" },
        { label: "Total Likes", value: myLikes.toLocaleString(), tone: "emerald" },
      ]}
      paradigm={paradigm}
      onParadigmChange={changeParadigm}
      themeId={themeId}
      onThemeChange={changeTheme}
      onlineCount={onlineUsers.length}
      livePulse={liveSyncPulse}
      statusMsg={statusMsg}
      onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
      headerActions={
        <>
          <ActionButton
            onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics: allMyMetrics, assets, profiles: [profile, ...teamLeaders], scopeLabel: `SMM_${profile.full_name}` })}
            loadingText="Exporting..."
            className="px-3.5 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs"
          >
            Export CSV
          </ActionButton>
          <button type="button" onClick={() => setShowSettings(true)} className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 text-purple-300 font-bold rounded-xl text-xs">
            Settings
          </button>
        </>
      }
    >
      {activeTab === "log" && (
        <GroupedWeeklyMetricsForm
          actorId={profile.id}
          assets={assets}
          allMetrics={allMyMetrics}
          isLocked={profile.is_locked}
          onSaved={async (msg) => { setStatusMsg(msg); await refreshProfileAndAssets(profile.id); }}
          onInspectAsset={(a) => setInspectingAsset(a)}
        />
      )}

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
                className={`cursor-pointer bg-zinc-950 border rounded-2xl p-4 sm:p-5 space-y-3 relative transition-all hover:-translate-y-0.5 ${
                  isSuspended ? "border-red-500/50 bg-red-950/10" : "border-zinc-800 hover:border-purple-500/60"
                }`}
              >
                <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                  <ActionButton
                    onClick={() => handleSetAssetStatus(asset, isSuspended ? "active" : "suspended")}
                    loadingText="..."
                    className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                      isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    }`}
                  >
                    {isSuspended ? "Suspended" : "Active"}
                  </ActionButton>
                </div>

                <div>
                  <span className="px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <h3 className="text-lg font-bold text-white mt-1.5 truncate pr-24">{getAssetAccountName(asset)}</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-black border border-zinc-900 rounded-xl text-[11px] font-mono">
                  <div><span className="text-zinc-500 block text-[9px]">TOTAL VIEWS</span><span className="text-blue-400 font-bold">{totalImpr.toLocaleString()}</span></div>
                  <div><span className="text-zinc-500 block text-[9px]">FOLLOWERS</span><span className="text-emerald-400 font-bold">{latestFol.toLocaleString()}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold rounded-xl text-xs">
                    View Details
                  </button>
                  <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 border border-zinc-800 text-emerald-400 font-bold rounded-xl text-xs">
                    Edit Account
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "graphs" && (
        <ExecutiveAnalyticsGraphs assets={assets} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onSelectAsset={(a) => setInspectingAsset(a)} titlePrefix={profile.full_name} />
      )}

      {activeTab === "achievements" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {myAchievements.map((ach) => (
            <div key={ach.id} className={`rounded-2xl p-5 border ${ach.unlocked ? "bg-gradient-to-b from-yellow-950/30 to-zinc-950 border-yellow-500/60" : "bg-zinc-950 border-zinc-800"}`}>
              <div className="flex justify-between items-center"><span className="text-2xl">{ach.icon}</span><span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300">{ach.unlocked ? "COMPLETED" : `${ach.progress}%`}</span></div>
              <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "register" && (
        <form onSubmit={handleRegisterAsset} autoComplete="off" className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold text-white">Add Social Media Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Platform</label>
              <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader</label>
              <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {teamLeaders.map((tl) => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Account Name</label>
              <input type="text" required value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Sahara Voice X" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Country</label>
              <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Language</label>
              <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">
                {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">
                {isTwitterReg ? "Username" : "Username / Handle"}
              </label>
              <input
                type="text"
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder={isTwitterReg ? "@username" : "Username"}
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Account Password</label>
              <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Account Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">
                {isFacebookReg ? "Email / Phone Number" : "Email"}
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isFacebookReg ? "Email or Phone Number" : "Email address"}
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Email Password</label>
              <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Email Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Profile Link</label>
              <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="https://..." className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Bio</label>
              <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Profile Bio" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">2FA Code</label>
              <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="2FA Key (optional)" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            </div>
            {!isFacebookReg && (
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">Phone Number</label>
                <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone Number" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
              </div>
            )}
          </div>

          <ActionButton
            type="submit"
            loading={isSubmittingReg}
            loadingText="Saving Account..."
            className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs"
          >
            Save Account
          </ActionButton>
        </form>
      )}

      {activeTab === "bulk" && (
        <form onSubmit={handleSmmBulkAssets} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Bulk Account Import</h2>
          <textarea
            rows={7}
            required
            value={bulkRawText}
            onChange={(e) => setBulkRawText(e.target.value)}
            placeholder="Account_Name, Username, Password, Email, Email_Password, Profile_Link, Bio, 2FA, Phone, Country, Language, Platform"
            className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white"
          />
          <ActionButton type="submit" loadingText="Importing..." className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl text-xs">
            Execute Bulk Import
          </ActionButton>
        </form>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={handleSaveSMMSettings} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">SMM Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-300 rounded-xl">Close</button>
            </div>
            <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={setPlatforms} onChange={setSetPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={setCountries} onChange={setSetCountries} />
            <FancyEntityMultiSelect label="Assigned Team Leaders" items={teamLeaders.map((tl) => ({ id: tl.id, label: tl.full_name, sub: tl.country }))} selectedIds={setTlIds} onChange={setSetTlIds} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <ActionButton type="submit" loadingText="Saving..." className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl text-xs">
              Save Settings
            </ActionButton>
          </form>
        </div>
      )}

      {inspectingAsset && (
        <AssetGrowthModal asset={inspectingAsset} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onClose={() => setInspectingAsset(null)} onEdit={(a) => setEditingAsset(a)} onToggleStatus={handleSetAssetStatus} />
      )}

      {editingAsset && (
        <UniversalAssetEditModal asset={editingAsset} teamLeaders={teamLeaders} canReassignSmm={false} onClose={() => setEditingAsset(null)} onSave={handleUpdateExistingAsset} onDelete={handleDeleteOwnAsset} />
      )}
    </ProfoundWorkspaceShell>
  );
}
