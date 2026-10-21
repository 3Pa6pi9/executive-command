"use client";

import { useState, useEffect, useCallback } from "react";
import { tlSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  TimeHorizon, normalizeAuthUsername, fetchAllRows,
  exportHorizonCSV, computeAchievements, getAssetAccountName, mergeArchiveEvents,
} from "@/lib/constants";
import { exportMultiTabWorkbook } from "@/lib/excelExport";
import {
  ActionButton, usePortalTheme, AssetGrowthModal, UniversalAssetEditModal,
  SMMSpotlightModal, CampaignDispatchWizard, ExecutiveAnalyticsGraphs,
  ForensicArchiveVault, PasswordVaultBadge, HierarchicalReportsHub,
} from "@/components/EnterpriseUI";
import { ProfoundWorkspaceShell, useWorkspaceParadigm } from "@/components/ProfoundWorkspaces";

export default function TeamLeaderPortal() {
  const { themeId, changeTheme } = usePortalTheme();
  const { paradigm, changeParadigm } = useWorkspaceParadigm("studio");

  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [smms, setSmms] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [pwMap, setPwMap] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState("");

  const [activeTab, setActiveTab] = useState<"reports" | "smms" | "assets" | "campaign" | "graphs" | "archives" | "achievements">("reports");
  const [csvHorizon, setCsvHorizon] = useState<TimeHorizon>("weekly");
  const [spotlightSmm, setSpotlightSmm] = useState<any>(null);
  const [inspectingAsset, setInspectingAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const loadTlData = useCallback(async (tlId: string) => {
    const [allProfiles, allAssets, allMetrics, crudRes] = await Promise.all([
      fetchAllRows(supabase, "profiles", "created_at"),
      fetchAllRows(supabase, "social_assets", "created_at"),
      fetchAllRows(supabase, "weekly_metrics", "week_of"),
      fetch("/api/crud", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ logs: [], reports: [], pwMap: {} })),
    ]);

    const mySmms = allProfiles.filter(
      (p: any) => p.role === "smm" && (p.team_leader_id === tlId || (p.team_leader_ids && p.team_leader_ids.includes(tlId)))
    );
    const mySmmIds = new Set(mySmms.map((s: any) => s.id));
    const myAssets = allAssets.filter((a: any) => a.team_leader_id === tlId || mySmmIds.has(a.smm_id));
    const myAssetIds = new Set(myAssets.map((a: any) => a.id));
    const myMetrics = allMetrics.filter((m: any) => myAssetIds.has(m.asset_id));

    setSmms(mySmms);
    setAssets(myAssets);
    setMetrics(myMetrics);
    setReports(crudRes.reports || []);
    setAuditLogs(mergeArchiveEvents(crudRes.logs || []));
    setPwMap(crudRes.pwMap || {});
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsCheckingAuth(false); return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!prof || prof.role !== "team_leader") { await supabase.auth.signOut(); setIsCheckingAuth(false); return; }
      setTlProfile(prof);
      setIsCheckingAuth(false);
      await loadTlData(prof.id);
    })();
  }, [loadTlData]);

  const handleTlLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating...");
    const raw = email.trim();
    const norm = raw.includes("@") ? raw : normalizeAuthUsername(raw, "tl");
    const { data, error } = await supabase.auth.signInWithPassword({ email: norm, password });
    if (error) return setAuthMsg(error.message);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "team_leader") { await supabase.auth.signOut(); return setAuthMsg("Team Leader authorization required."); }
    setTlProfile(prof);
    await loadTlData(prof.id);
  };

  const handleToggleSmmLock = async (smm: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "update", payload: { targetId: smm.id, is_locked: !smm.is_locked } }),
    });
    setStatusMsg(`${smm.full_name} report submissions ${!smm.is_locked ? "🔒 LOCKED" : "🟢 UNLOCKED"}.`);
    await loadTlData(tlProfile.id);
  };

  const handleSquadBatchLock = async (lockState: boolean) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "batch_lock", payload: { is_locked: lockState, tlId: tlProfile.id } }),
    });
    setStatusMsg(lockState ? "🔒 Locked report submissions for all squad SMMs." : "🟢 Unlocked report submissions for all squad SMMs.");
    await loadTlData(tlProfile.id);
  };

  const handleSetAssetStatus = async (asset: any, newStatus: "active" | "suspended") => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: { id: asset.id, status: newStatus } }),
    });
    await loadTlData(tlProfile.id);
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm">Loading Team Leader Portal...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100">
        <form onSubmit={handleTlLogin} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4">
          <h1 className="text-2xl font-bold text-white text-center">Team Leader Command</h1>
          <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leader@tl" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-sm text-white" />
          {authMsg && <div className="text-red-400 text-xs text-center">{authMsg}</div>}
          <ActionButton type="submit" loadingText="Signing In..." className="w-full bg-blue-500 text-black font-bold py-3.5 rounded-xl text-sm">Sign In</ActionButton>
          <div className="text-center"><Link href="/" className="text-xs text-zinc-500">← Return to SMM Login</Link></div>
        </form>
      </div>
    );
  }

  const achievements = computeAchievements(assets, metrics);
  const totalViews = metrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);

  return (
    <ProfoundWorkspaceShell
      portalTitle={tlProfile.full_name}
      roleLabel="Team Leader"
      userName={tlProfile.full_name}
      userSub={tlProfile.country}
      isAdmin={false}
      navItems={[
        { id: "reports", code: "01", label: "Reports", count: smms.length },
        { id: "smms", code: "02", label: "My SMM Squad", count: smms.length },
        { id: "assets", code: "03", label: "Squad Accounts", count: assets.length },
        { id: "campaign", code: "04", label: "Assign Campaign" },
        { id: "graphs", code: "05", label: "Leaderboards" },
        { id: "archives", code: "06", label: "Archives", count: auditLogs.length },
        { id: "achievements", code: "07", label: "Milestones", count: achievements.length },
      ]}
      activeNav={activeTab}
      onSelectNav={(id: any) => setActiveTab(id)}
      telemetry={[
        { label: "Squad SMMs", value: smms.length, tone: "blue" },
        { label: "Squad Accounts", value: assets.length, tone: "purple" },
        { label: "Total Views", value: totalViews.toLocaleString(), tone: "emerald" },
      ]}
      paradigm={paradigm}
      onParadigmChange={changeParadigm}
      themeId={themeId}
      onThemeChange={changeTheme}
      statusMsg={statusMsg}
      onSignOut={async () => { await supabase.auth.signOut(); setTlProfile(null); }}
      headerActions={
        <>
          <ActionButton onClick={() => exportMultiTabWorkbook({ horizon: csvHorizon, metrics, assets, profiles: [tlProfile, ...smms], scopeLabel: `TL_${tlProfile.full_name}` })} loadingText="..." className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold">
            Export .XLS
          </ActionButton>
          <ActionButton onClick={() => exportHorizonCSV({ horizon: csvHorizon, metrics, assets, profiles: [tlProfile, ...smms], scopeLabel: `TL_${tlProfile.full_name}` })} loadingText="..." className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold">
            Export CSV
          </ActionButton>
        </>
      }
    >
      {activeTab === "reports" && (
        <HierarchicalReportsHub
          actor={tlProfile}
          role="team_leader"
          smms={smms}
          assets={assets}
          metrics={metrics}
          reports={reports}
          onToggleSmmLock={handleToggleSmmLock}
          onBatchLock={handleSquadBatchLock}
          onRefresh={() => loadTlData(tlProfile.id)}
        />
      )}

      {activeTab === "smms" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ActionButton onClick={() => handleSquadBatchLock(true)} loadingText="..." className="px-3.5 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold">🔒 Lock All Submissions</ActionButton>
            <ActionButton onClick={() => handleSquadBatchLock(false)} loadingText="..." className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">🟢 Unlock All Submissions</ActionButton>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {smms.map((smm: any) => (
              <div key={smm.id} onClick={() => setSpotlightSmm(smm)} className="cursor-pointer rounded-3xl p-5 bg-zinc-950 border border-zinc-800 hover:border-blue-400 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${smm.is_locked ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                      {smm.is_locked ? "🔒 LOCKED" : "🟢 OPEN"}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">{smm.full_name}</h3>
                    <p className="text-xs text-zinc-400">{smm.country}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionButton onClick={() => handleToggleSmmLock(smm)} loadingText="..." className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold">
                      {smm.is_locked ? "Unlock" : "Lock"}
                    </ActionButton>
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
          {assets.map((asset: any) => {
            const isSuspended = asset.status === "suspended";
            return (
              <div key={asset.id} onClick={() => setInspectingAsset(asset)} className="cursor-pointer bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isSuspended ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                    {isSuspended ? "🔒 SUSPENDED" : "🟢 ACTIVE"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white truncate">{getAssetAccountName(asset)}</h3>
                <p className="text-xs text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
                <PasswordVaultBadge password={asset.account_password} label="Acct PW" />
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "campaign" && (
        <CampaignDispatchWizard actorId={tlProfile.id} teamLeaders={[tlProfile]} smms={smms} assets={assets} defaultTlId={tlProfile.id} onSuccess={(msg: string) => { setStatusMsg(msg); loadTlData(tlProfile.id); }} />
      )}

      {activeTab === "graphs" && <ExecutiveAnalyticsGraphs assets={assets} metrics={metrics} profiles={[tlProfile, ...smms]} onSelectAsset={(a: any) => setInspectingAsset(a)} onSelectSmm={(smm: any) => setSpotlightSmm(smm)} />}
      {activeTab === "archives" && <ForensicArchiveVault logs={auditLogs} onRestore={async () => loadTlData(tlProfile.id)} />}
      {activeTab === "achievements" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {achievements.map((ach: any) => (
            <div key={ach.id} className="rounded-2xl p-5 border bg-zinc-950 border-zinc-800">
              <div className="flex justify-between items-center"><span className="text-2xl">{ach.icon}</span><span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300">{ach.unlocked ? "COMPLETED" : `${ach.progress}%`}</span></div>
              <h3 className="text-base font-bold text-white mt-3">{ach.title}</h3><p className="text-xs text-zinc-400 mt-1">{ach.desc}</p><div className="mt-2 text-xs font-mono text-yellow-300">{ach.stat}</div>
            </div>
          ))}
        </div>
      )}

      {spotlightSmm && <SMMSpotlightModal smm={spotlightSmm} assets={assets} metrics={metrics} onClose={() => setSpotlightSmm(null)} onSelectAsset={(a: any) => setInspectingAsset(a)} onEditAsset={(a: any) => setEditingAsset(a)} onToggleAssetStatus={handleSetAssetStatus} onToggleSmmLock={handleToggleSmmLock} />}
      {inspectingAsset && <AssetGrowthModal asset={inspectingAsset} metrics={metrics} profiles={[tlProfile, ...smms]} onClose={() => setInspectingAsset(null)} onEdit={(a: any) => setEditingAsset(a)} onToggleStatus={handleSetAssetStatus} />}
      {editingAsset && <UniversalAssetEditModal asset={editingAsset} teamLeaders={[tlProfile]} smms={smms} canReassignSmm={true} onClose={() => setEditingAsset(null)} onSave={async (updated: any) => { await fetch("/api/crud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: updated }) }); setEditingAsset(null); await loadTlData(tlProfile.id); }} />}
    </ProfoundWorkspaceShell>
  );
}
