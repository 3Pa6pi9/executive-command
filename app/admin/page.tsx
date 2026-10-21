"use client";

import { useState, useEffect, useCallback } from "react";
import { adminSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  PLATFORMS, ALL_COUNTRIES, TimeHorizon,
  normalizeAuthUsername, fetchAllRows, exportHorizonCSV, exportSubmittedReportsCSV, computeAchievements,
  getAssetAccountName, mergeArchiveEvents,
} from "@/lib/constants";
import { exportMultiTabWorkbook } from "@/lib/excelExport";
import {
  ActionButton, usePortalTheme, useRealtimePresence, LiveOnlineRosterPill,
  GlobalCommandPalette, AssetGrowthModal, UniversalAssetEditModal,
  TeamLeaderSpotlightModal, SMMSpotlightModal, FancyMultiSelect,
  FancyEntityMultiSelect, CampaignDispatchWizard, ExecutiveAnalyticsGraphs,
  ForensicArchiveVault, PasswordVaultBadge, HierarchicalReportsHub,
} from "@/components/EnterpriseUI";
import { ProfoundWorkspaceShell, useWorkspaceParadigm } from "@/components/ProfoundWorkspaces";

export default function AdminControlCenter() {
  const { themeId, changeTheme } = usePortalTheme();
  const { paradigm, changeParadigm } = useWorkspaceParadigm("studio");

  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [profiles, setProfiles] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [pwMap, setPwMap] = useState<Record<string, string>>({});
  const [customMilestones, setCustomMilestones] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const { onlineUsers } = useRealtimePresence(supabase, adminProfile);
  const [activeTab, setActiveTab] = useState<"reports" | "tls" | "smms" | "assets" | "campaign" | "graphs" | "archives" | "achievements">("reports");
  const [csvHorizon] = useState<TimeHorizon>("weekly");

  const [spotlightTl, setSpotlightTl] = useState<any>(null);
  const [spotlightSmm, setSpotlightSmm] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "team_leader" | "smm">("smm");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newCountries, setNewCountries] = useState<string[]>(["Kenya"]);
  const [newPlatforms, setNewPlatforms] = useState<string[]>(["twitter"]);
  const [newTlIds, setNewTlIds] = useState<string[]>([]);

  const loadAllEnterpriseData = useCallback(async () => {
    const [pList, aList, mList, auditRes] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
      fetch("/api/crud", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ logs: [], milestones: [], reports: [], pwMap: {} })),
    ]);
    setProfiles(pList);
    setAssets(aList);
    setMetrics(mList);
    setAuditLogs(mergeArchiveEvents(auditRes.logs || []));
    setCustomMilestones(auditRes.milestones || []);
    setReports(auditRes.reports || []);
    setPwMap(auditRes.pwMap || {});
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsCheckingAuth(false); return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!prof || prof.role !== "admin") { await supabase.auth.signOut(); setIsCheckingAuth(false); return; }
      setAdminProfile(prof);
      setIsCheckingAuth(false);
      await loadAllEnterpriseData();
    })();
  }, [loadAllEnterpriseData]);

  const handleToggleSmmLock = async (smm: any) => {
    await fetch("/api/crud", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "update", payload: { targetId: smm.id, is_locked: !smm.is_locked } }),
    });
    setStatusMsg(`${smm.full_name} is now ${!smm.is_locked ? "🔒 LOCKED" : "🟢 OPEN"}.`);
    await loadAllEnterpriseData();
  };

  const handleGlobalBatchLock = async (lockState: boolean) => {
    await fetch("/api/crud", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "batch_lock", payload: { is_locked: lockState } }),
    });
    setStatusMsg(lockState ? "🔒 All SMMs Locked." : "🟢 All SMMs Unlocked.");
    await loadAllEnterpriseData();
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono text-sm">Loading Admin Control Center...</div>;

  if (!adminProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
        <form onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/seed", { method: "POST" });
          const raw = email.trim();
          const norm = raw.includes("@") ? raw : normalizeAuthUsername(raw, "admin");
          const { data, error } = await supabase.auth.signInWithPassword({ email: norm, password });
          if (error) return setAuthMsg(error.message);
          const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (!prof || prof.role !== "admin") { await supabase.auth.signOut(); return setAuthMsg("Admin access required."); }
          setAdminProfile(prof);
          await loadAllEnterpriseData();
        }} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4">
          <h1 className="text-2xl font-bold text-white text-center">Admin Control Center</h1>
          <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@executive.com" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passcode" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
          {authMsg && <div className="text-red-400 text-xs text-center">{authMsg}</div>}
          <ActionButton type="submit" loadingText="Signing In..." className="w-full bg-emerald-500 text-black font-bold py-3.5 rounded-xl text-sm">Sign In</ActionButton>
          <div className="text-center"><Link href="/" className="text-xs text-zinc-500">← Return to Login</Link></div>
        </form>
      </div>
    );
  }

  const teamLeaders = profiles.filter((p: any) => p.role === "team_leader");
  const allSmms = profiles.filter((p: any) => p.role === "smm");
  const globalAchievements = computeAchievements(assets, metrics, customMilestones);
  const totalViews = metrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);

  return (
    <ProfoundWorkspaceShell
      portalTitle="Admin Control Center"
      roleLabel="Master Admin"
      userName={adminProfile.full_name}
      isAdmin={true}
      onlineCount={onlineUsers.length}
      navItems={[
        { id: "reports", code: "01", label: "Reports", count: reports.length },
        { id: "tls", code: "02", label: "Team Leaders", count: teamLeaders.length },
        { id: "smms", code: "03", label: "SMM Handlers", count: allSmms.length },
        { id: "assets", code: "04", label: "All Accounts", count: assets.length },
        { id: "campaign", code: "05", label: "Assign Campaign" },
        { id: "graphs", code: "06", label: "Leaderboards" },
        { id: "archives", code: "07", label: "Archives", count: auditLogs.length },
        { id: "achievements", code: "08", label: "Milestones", count: globalAchievements.length },
      ]}
      activeNav={activeTab}
      onSelectNav={(id: any) => setActiveTab(id)}
      telemetry={[
        { label: "Team Leaders", value: teamLeaders.length },
        { label: "SMM Handlers", value: allSmms.length },
        { label: "Total Accounts", value: assets.length },
        { label: "Total Views", value: totalViews.toLocaleString() },
      ]}
      paradigm={paradigm}
      onParadigmChange={changeParadigm}
      themeId={themeId}
      onThemeChange={changeTheme}
      statusMsg={statusMsg}
      onSignOut={async () => { await supabase.auth.signOut(); setAdminProfile(null); }}
      headerActions={
        <>
          <LiveOnlineRosterPill onlineUsers={onlineUsers} />
          <GlobalCommandPalette profiles={profiles} assets={assets} onSelectTl={(tl: any) => setSpotlightTl(tl)} onSelectSmm={(smm: any) => setSpotlightSmm(smm)} onSelectAsset={(a: any) => setInspectingAsset(a)} />
          <button type="button" onClick={() => exportSubmittedReportsCSV({ reports, teamLeaders, smms: allSmms, horizonFilter: "all", scopeLabel: "Master_Admin_Reports_Vault" })} className="px-3.5 py-2 rounded-xl bg-amber-400 text-black text-xs font-bold cursor-pointer">⬇ Reports CSV</button><button type="button" onClick={() => setShowProvisionModal(true)} className="px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold">+ Add Staff</button>
          <ActionButton onClick={() => exportMultiTabWorkbook({ horizon: csvHorizon, metrics, assets, profiles, scopeLabel: "Master_Admin_MEL" })} loadingText="..." className="px-3 py-2 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold">Export .XLS</ActionButton>
          <ActionButton onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics, assets, profiles })} loadingText="..." className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold">Export CSV</ActionButton>
        </>
      }
    >
      {activeTab === "reports" && (<HierarchicalReportsHub />)}

      {activeTab === "tls" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {teamLeaders.map((tl: any) => (
            <div key={tl.id} onClick={() => setSpotlightTl(tl)} className="cursor-pointer rounded-3xl p-6 bg-zinc-950 border border-zinc-800 hover:border-emerald-400 space-y-3">
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Team Leader</span>
              <h3 className="font-bold text-xl text-white">{tl.full_name}</h3>
              <p className="text-xs text-zinc-400">{tl.country}</p>
              <PasswordVaultBadge password={pwMap[tl.id]} label="Login PW" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "smms" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ActionButton onClick={() => handleGlobalBatchLock(true)} loadingText="..." className="px-3.5 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold">🔒 Lock All SMMs</ActionButton>
            <ActionButton onClick={() => handleGlobalBatchLock(false)} loadingText="..." className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">🟢 Unlock All SMMs</ActionButton>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allSmms.map((smm: any) => (
              <div key={smm.id} onClick={() => setSpotlightSmm(smm)} className="cursor-pointer rounded-3xl p-6 bg-zinc-950 border border-zinc-800 hover:border-blue-400 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${smm.is_locked ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>{smm.is_locked ? "🔒 LOCKED" : "🟢 OPEN"}</span>
                    <h3 className="text-xl font-bold text-white mt-2">{smm.full_name}</h3>
                    <p className="text-xs text-zinc-400">{smm.country}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionButton onClick={() => handleToggleSmmLock(smm)} loadingText="..." className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold">{smm.is_locked ? "Unlock" : "Lock"}</ActionButton>
                  </div>
                </div>
                <PasswordVaultBadge password={pwMap[smm.id]} label="Login PW" />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "assets" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset: any) => (
            <div key={asset.id} onClick={() => setInspectingAsset(asset)} className="cursor-pointer bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
              <h3 className="text-lg font-bold text-white truncate">{getAssetAccountName(asset)}</h3>
              <p className="text-xs text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
              <PasswordVaultBadge password={asset.account_password} label="Acct PW" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "campaign" && <CampaignDispatchWizard actorId={adminProfile.id} teamLeaders={teamLeaders} smms={allSmms} assets={assets} onSuccess={(msg: string) => { setStatusMsg(msg); loadAllEnterpriseData(); }} />}
      {activeTab === "graphs" && <ExecutiveAnalyticsGraphs assets={assets} metrics={metrics} profiles={profiles} onSelectAsset={(a: any) => setInspectingAsset(a)} onSelectTl={(tl: any) => setSpotlightTl(tl)} onSelectSmm={(smm: any) => setSpotlightSmm(smm)} />}
      {activeTab === "archives" && <ForensicArchiveVault logs={auditLogs} onRestore={async () => loadAllEnterpriseData()} />}
      {activeTab === "achievements" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {globalAchievements.map((ach: any) => (
            <div key={ach.id} className="rounded-2xl p-5 border bg-zinc-950 border-zinc-800">
              <div className="flex justify-between items-center"><span className="text-2xl">{ach.icon}</span><span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300">{ach.unlocked ? "COMPLETED" : `${ach.progress}%`}</span></div>
              <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-2 text-xs font-mono text-yellow-300">{ach.stat}</div>
            </div>
          ))}
        </div>
      )}

      {spotlightTl && <TeamLeaderSpotlightModal tl={spotlightTl} smms={allSmms} assets={assets} metrics={metrics} onClose={() => setSpotlightTl(null)} onSelectSmm={(smm: any) => setSpotlightSmm(smm)} onEditTl={() => {}} onEditSmm={() => {}} onToggleSmmLock={handleToggleSmmLock} />}
      {spotlightSmm && <SMMSpotlightModal smm={spotlightSmm} assets={assets} metrics={metrics} onClose={() => setSpotlightSmm(null)} onSelectAsset={(a: any) => setInspectingAsset(a)} onEditAsset={(a: any) => setEditingAsset(a)} onToggleAssetStatus={() => {}} onToggleSmmLock={handleToggleSmmLock} />}
      {inspectingAsset && <AssetGrowthModal asset={inspectingAsset} metrics={metrics} profiles={profiles} onClose={() => setInspectingAsset(null)} onEdit={(a: any) => setEditingAsset(a)} />}
      {editingAsset && <UniversalAssetEditModal asset={editingAsset} teamLeaders={teamLeaders} smms={allSmms} canReassignSmm={true} onClose={() => setEditingAsset(null)} onSave={async (updated: any) => { await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: adminProfile.id, entity: "asset", action: "update", payload: updated }) }); setEditingAsset(null); await loadAllEnterpriseData(); }} />}

      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4" onClick={() => setShowProvisionModal(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: adminProfile.id, entity: "profile", action: "create", payload: { role: newRole, full_name: newName, email: newEmail, password: newPass, country: newCountries.join(", "), platforms: newPlatforms, team_leader_ids: newRole === "smm" ? newTlIds : [] } }) });
            if (res.ok) { setShowProvisionModal(false); setNewName(""); setNewEmail(""); setNewPass(""); await loadAllEnterpriseData(); }
          }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Provision Staff Account</h3>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-emerald-400 font-bold"><option value="smm">SMM Handler (@smm)</option><option value="team_leader">Team Leader (@tl)</option><option value="admin">Admin (@admin)</option></select>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
            <input type="text" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Username (e.g. name@smm)" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <input type="text" required value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white font-mono" />
            <FancyMultiSelect label="Platforms" options={PLATFORMS} selected={newPlatforms} onChange={setNewPlatforms} />
            <FancyMultiSelect label="Countries" options={ALL_COUNTRIES} selected={newCountries} onChange={setNewCountries} />
            {newRole === "smm" && <FancyEntityMultiSelect label="Assign Team Leaders" items={teamLeaders.map((tl: any) => ({ id: tl.id, label: tl.full_name }))} selectedIds={newTlIds} onChange={setNewTlIds} />}
            <ActionButton type="submit" loadingText="Creating..." className="w-full py-3.5 bg-emerald-500 text-black font-bold rounded-xl text-xs">Create Staff Account</ActionButton>
          </form>
        </div>
      )}
    </ProfoundWorkspaceShell>
  );
}
