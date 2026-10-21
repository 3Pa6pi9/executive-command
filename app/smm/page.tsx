"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import {
  PLATFORMS, ALL_COUNTRIES, ASSET_LANGUAGES, TimeHorizon,
  fetchAllRows, parseBulkRows, exportHorizonCSV, computeAchievements, getAssetAccountName,
} from "@/lib/constants";
import { exportMultiTabWorkbook } from "@/lib/excelExport";
import {
  ActionButton, usePortalTheme, GroupedMetricsTab, AssetGrowthModal,
  UniversalAssetEditModal, FancyMultiSelect, FancyEntityMultiSelect,
  ExecutiveAnalyticsGraphs, PasswordVaultBadge,
} from "@/components/EnterpriseUI";
import { ProfoundWorkspaceShell, useWorkspaceParadigm } from "@/components/ProfoundWorkspaces";

export default function SMMDashboard() {
  const { themeId, changeTheme } = usePortalTheme();
  const { paradigm, changeParadigm } = useWorkspaceParadigm("studio");

  const [profile, setProfile] = useState<any>(null);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [allMyMetrics, setAllMyMetrics] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"reports" | "assets" | "register" | "graphs" | "achievements" | "bulk">("reports");
  const [statusMsg, setStatusMsg] = useState("");
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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/"; return; }
      await refreshProfileAndAssets(session.user.id, true);
    })();
  }, []);

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
    const [tlRes, crudRes, assetList] = await Promise.all([
      fetch("/api/team-leaders").then((r) => r.json()).catch(() => ({ teamLeaders: [] })),
      fetch("/api/crud", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ reports: [] })),
      fetchAllRows(supabase, "social_assets", "created_at", "smm_id", userId),
    ]);
    const tls = tlRes.teamLeaders || [];
    setTeamLeaders(tls);
    if (tls.length > 0 && isInitial) setRegTlId(prof.team_leader_id || tls[0].id);
    setReports((crudRes.reports || []).filter((r: any) => r.author_id === userId));
    setAssets(assetList);
    const assetIds = assetList.map((a: any) => a.id);
    setAllMyMetrics(assetIds.length > 0 ? await fetchAllRows(supabase, "weekly_metrics", "week_of", "asset_id", assetIds) : []);
  };

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-black text-purple-400 font-mono text-sm">Loading SMM Portal...</div>;

  const myAchievements = computeAchievements(assets, allMyMetrics);
  const myViews = allMyMetrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);

  return (
    <ProfoundWorkspaceShell
      portalTitle={profile.full_name}
      roleLabel={profile.is_locked ? "🔒 SMM Locked" : "🟢 SMM Open"}
      userName={profile.full_name}
      navItems={[
        { id: "reports", code: "01", label: "Reports", count: reports.length },
        { id: "assets", code: "02", label: "My Accounts", count: assets.length },
        { id: "register", code: "03", label: "+ Add Account" },
        { id: "graphs", code: "04", label: "Leaderboards" },
        { id: "achievements", code: "05", label: "Milestones", count: myAchievements.length },
        { id: "bulk", code: "06", label: "Bulk Import" },
      ]}
      activeNav={activeTab}
      onSelectNav={(id: any) => setActiveTab(id)}
      telemetry={[
        { label: "My Accounts", value: assets.length },
        { label: "Submitted Reports", value: reports.length },
        { label: "Total Views", value: myViews.toLocaleString() },
      ]}
      paradigm={paradigm}
      onParadigmChange={changeParadigm}
      themeId={themeId}
      onThemeChange={changeTheme}
      statusMsg={statusMsg}
      onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
      headerActions={
        <>
          <ActionButton onClick={() => exportMultiTabWorkbook({ horizon: csvHorizon, metrics: allMyMetrics, assets, profiles: [profile, ...teamLeaders], scopeLabel: `SMM_${profile.full_name}` })} loadingText="..." className="px-3 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs">Export .XLS</ActionButton>
          <ActionButton onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics: allMyMetrics, assets, profiles: [profile, ...teamLeaders], scopeLabel: `SMM_${profile.full_name}` })} loadingText="..." className="px-3 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs">Export CSV</ActionButton>
          <button type="button" onClick={() => setShowSettings(true)} className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold rounded-xl text-xs">Settings</button>
        </>
      }
    >
      {activeTab === "reports" && (
        <GroupedMetricsTab
          actorId={profile.id}
          actorName={profile.full_name}
          tlId={profile.team_leader_id}
          assets={assets}
          allMetrics={allMyMetrics}
          reports={reports}
          isLocked={profile.is_locked}
          onSaved={async (msg: string) => { setStatusMsg(msg); await refreshProfileAndAssets(profile.id); }}
          onInspectAsset={(a: any) => setInspectingAsset(a)}
        />
      )}

      {activeTab === "assets" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset: any) => (
            <div key={asset.id} onClick={() => setInspectingAsset(asset)} className="cursor-pointer bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                <span className="text-[10px] font-bold text-emerald-300">{asset.status === "suspended" ? "🔒 SUSPENDED" : "🟢 ACTIVE"}</span>
              </div>
              <h3 className="text-lg font-bold text-white truncate">{getAssetAccountName(asset)}</h3>
              <p className="text-xs text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
              <PasswordVaultBadge password={asset.account_password} label="Acct PW" />
              <div className="grid grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setInspectingAsset(asset)} className="py-2 bg-purple-600/20 text-purple-300 font-bold rounded-xl text-xs">View Details</button>
                <button type="button" onClick={() => setEditingAsset(asset)} className="py-2 bg-zinc-900 text-emerald-400 font-bold rounded-xl text-xs">Edit Account</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "graphs" && <ExecutiveAnalyticsGraphs assets={assets} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onSelectAsset={(a: any) => setInspectingAsset(a)} />}
      {activeTab === "achievements" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {myAchievements.map((ach: any) => (
            <div key={ach.id} className="rounded-2xl p-5 border bg-zinc-950 border-zinc-800">
              <div className="flex justify-between items-center"><span className="text-2xl">{ach.icon}</span><span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300">{ach.unlocked ? "COMPLETED" : `${ach.progress}%`}</span></div>
              <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-3 text-xs font-mono text-yellow-300">{ach.stat}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "register" && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "create", payload: { smm_id: profile.id, team_leader_id: regTlId || profile.team_leader_id, platform: regPlatform, account_name: accountName.trim() || accountId.trim(), project_name: accountName.trim() || accountId.trim(), status: "active", profile_link: profileLink.trim(), bio: bio.trim(), account_id: accountId.trim(), account_password: accountPassword, email: email.trim(), email_password: emailPassword, two_fa_code: twoFaCode.trim(), country_language: countryLanguage, language: assetLang, phone_number: regPlatform === "facebook" ? email.trim() : phoneNumber.trim() } }) });
          if (res.ok) { setStatusMsg("Account registered."); setAccountName(""); setAccountId(""); await refreshProfileAndAssets(profile.id); setActiveTab("assets"); }
        }} className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Add Social Media Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={regPlatform} onChange={(e) => setRegPlatform(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white uppercase">{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select value={regTlId} onChange={(e) => setRegTlId(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{teamLeaders.map((tl: any) => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}</select>
            <input type="text" required value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account Name" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={countryLanguage} onChange={(e) => setCountryLanguage(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white">{ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}</select>
            <input type="text" required value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder={regPlatform === "twitter" ? "Username (@handle)" : "Username / Handle"} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="text" required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Account Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={regPlatform === "facebook" ? "Email / Phone Number" : "Email"} className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Email Password" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="url" required value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="Profile Link" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
          </div>
          <ActionButton type="submit" loadingText="Saving..." className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Account</ActionButton>
        </form>
      )}

      {activeTab === "bulk" && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const items = parseBulkRows(bulkRawText).map((r: any) => ({ smm_id: profile.id, team_leader_id: regTlId || profile.team_leader_id, account_name: r[0] || "Account", project_name: r[0] || "Account", account_id: r[1] || "Pending", account_password: r[2] || "", email: r[3] || "", email_password: r[4] || "", profile_link: r[5] || "", bio: r[6] || "", two_fa_code: r[7] || "", phone_number: r[8] || "", country_language: r[9] || countryLanguage, language: r[10] || assetLang, platform: (r[11] || regPlatform).toLowerCase(), status: "active" }));
          await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "bulk_create", payload: { items } }) });
          setBulkRawText(""); setActiveTab("assets"); await refreshProfileAndAssets(profile.id);
        }} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Bulk Account Import</h2>
          <textarea rows={6} required value={bulkRawText} onChange={(e) => setBulkRawText(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white" />
          <ActionButton type="submit" loadingText="Importing..." className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl text-xs">Execute Bulk Import</ActionButton>
        </form>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: profile.id, entity: "profile", action: "update", payload: { targetId: profile.id, full_name: setFullName, country: setCountries.join(", "), platforms: setPlatforms, team_leader_ids: setTlIds, newPassword } }) });
            setNewPassword(""); setShowSettings(false); await refreshProfileAndAssets(profile.id);
          }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border-l border-purple-500/40 h-full overflow-y-auto p-6 space-y-5">
            <h2 className="text-xl font-bold text-white">SMM Settings</h2>
            <input type="text" required value={setFullName} onChange={(e) => setSetFullName(e.target.value)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={setPlatforms} onChange={setSetPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={setCountries} onChange={setSetCountries} />
            <FancyEntityMultiSelect label="Assigned Team Leaders" items={teamLeaders.map((tl: any) => ({ id: tl.id, label: tl.full_name }))} selectedIds={setTlIds} onChange={setSetTlIds} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (optional)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <ActionButton type="submit" loadingText="Saving..." className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl text-xs">Save Settings</ActionButton>
          </form>
        </div>
      )}

      {inspectingAsset && <AssetGrowthModal asset={inspectingAsset} metrics={allMyMetrics} profiles={[profile, ...teamLeaders]} onClose={() => setInspectingAsset(null)} onEdit={(a: any) => setEditingAsset(a)} />}
      {editingAsset && <UniversalAssetEditModal asset={editingAsset} teamLeaders={teamLeaders} canReassignSmm={false} onClose={() => setEditingAsset(null)} onSave={async (updated: any) => { await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: profile.id, entity: "asset", action: "update", payload: updated }) }); setEditingAsset(null); await refreshProfileAndAssets(profile.id); }} />}
    </ProfoundWorkspaceShell>
  );
}
