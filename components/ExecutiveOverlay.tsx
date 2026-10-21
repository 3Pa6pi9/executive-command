"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TimeHorizon } from "@/lib/constants";
import { adminSupabase, tlSupabase, managerSupabase } from "@/lib/supabase";
import { GroupedMetricsTab } from "@/components/GroupedMetricsTab";

export { GroupedMetricsTab };

export function PasswordVaultBadge({ userId, profileId, employeeId, id, fallback = "Welcome@2026!" }: any) {
  const [show, setShow] = useState(false);
  const targetId = userId || profileId || employeeId || id || "";
  const pw = (typeof window !== "undefined" && (window as any).__pwMap?.[targetId]) || fallback;
  const em = (typeof window !== "undefined" && (window as any).__emailMap?.[targetId]) || "";

  return (
    <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between text-xs my-1.5">
      <div className="space-y-0.5">
        {em && (
          <div className="text-[11px] text-zinc-400">
            Username: <b className="text-white font-mono">{em}</b>
          </div>
        )}
        <div className="text-zinc-400 font-bold">
          Current Password:{" "}
          <code className="text-emerald-400 font-mono ml-1" style={{ filter: show ? "none" : "blur(4px)" }}>
            {pw}
          </code>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-purple-300 font-bold text-[11px] hover:text-white"
      >
        👁 {show ? "Hide" : "Show"} Password
      </button>
    </div>
  );
}

export function HierarchicalReportsHub(_props: any) {
  const [path, setPath] = useState("");
  const [uid, setUid] = useState("");
  const [horizon, setHorizon] = useState<TimeHorizon>("weekly");
  const [period, setPeriod] = useState<string>("");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [vault, setVault] = useState<any>({
    logs: [],
    reportRecords: [],
    passwords: {},
    emails: {},
    profiles: [],
    assets: [],
    metrics: []
  });

  const msg = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4000);
  };

  const load = async () => {
    try {
      const j = await fetch("/api/crud", { cache: "no-store" }).then((r) => r.json());
      if (j) {
        (window as any).__pwMap = j.passwords || {};
        (window as any).__emailMap = j.emails || {};
        (window as any).__auditLogsCache = j.logs || [];
        setVault({
          logs: j.logs || [],
          reportRecords: j.reportRecords || [],
          passwords: j.passwords || {},
          emails: j.emails || {},
          profiles: j.profiles || [],
          assets: j.assets || [],
          metrics: j.metrics || []
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = window.location.pathname;
    setPath(p);
    const sb = p.startsWith("/admin") ? adminSupabase : p.startsWith("/team-leader") ? tlSupabase : managerSupabase;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session?.user?.id) setUid(data.session.user.id);
      })
      .catch(() => {});
    load();
  }, []);

  const isAdm = path.startsWith("/admin");
  const isTl = path.startsWith("/team-leader");
  const isSmm = path.startsWith("/smm");

  const tls = vault.profiles.filter((p: any) => p.role === "team_leader");
  const smms = vault.profiles.filter((p: any) => p.role === "smm");

  const horizonReports = useMemo(() => {
    return (vault.reportRecords || []).filter((r: any) => r.horizon === horizon);
  }, [vault.reportRecords, horizon]);

  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    horizonReports.forEach((r: any) => {
      if (r.period) set.add(r.period);
    });
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const q = Math.ceil((now.getMonth() + 1) / 3);
    if (horizon === "weekly") set.add(now.toISOString().split("T")[0]);
    else if (horizon === "monthly") set.add(`${y}-${m}`);
    else if (horizon === "quarterly") set.add(`${y}-Q${q}`);
    else set.add(`${y}`);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [horizonReports, horizon]);

  const activePeriod = period && availablePeriods.includes(period) ? period : availablePeriods[0] || "";

  const periodReports = useMemo(() => {
    return horizonReports.filter((r: any) => !activePeriod || r.period === activePeriod);
  }, [horizonReports, activePeriod]);

  const mySquadSmms = useMemo(() => {
    if (!isTl || !uid) return smms;
    const sq = smms.filter((s: any) => s.team_leader_id === uid || (s.team_leader_ids || []).includes(uid));
    return sq.length > 0 ? sq : smms;
  }, [smms, isTl, uid]);

  const handleLockAll = async (lockState: boolean, scope: "all" | "squad" = "all") => {
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: uid || "admin", entity: "profile", action: "lock_all", payload: { is_locked: lockState, scope } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to update lock status");
      await load();
      msg(lockState ? `🔒 Locked report submissions for ${j.count || ""} SMMs!` : `🔓 Unlocked report submissions for ${j.count || ""} SMMs!`);
    } catch (e: any) {
      msg(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSingleLock = async (smm: any) => {
    const nextLock = !smm.is_locked;
    setBusy(true);
    try {
      await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: uid || "admin", entity: "profile", action: "toggle_lock", payload: { targetId: smm.id, is_locked: nextLock } })
      });
      await load();
      msg(nextLock ? `🔒 Locked ${smm.full_name}'s report submissions!` : `🔓 Unlocked ${smm.full_name}'s report submissions!`);
    } catch {} finally {
      setBusy(false);
    }
  };

  const handleForwardSquadToAdmin = async (repIds: string[]) => {
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: uid,
          entity: "report_record",
          action: "forward_tl_reports",
          payload: { horizon, period: activePeriod, reportIds: repIds }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to forward reports");
      await load();
      msg(`✓ Submitted ${j.forwardedCount || repIds.length} collected ${horizon.toUpperCase()} reports (${activePeriod}) to Master Admin!`);
    } catch (e: any) {
      msg(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadReportsCSV = (recordsToExport: any[], filenameTag = "All_Reports") => {
    const headers = [
      "Report Horizon",
      "Period",
      "Team Leader",
      "SMM Handler",
      "Country",
      "Platform",
      "Account Name",
      "Account Handle",
      "Posts Published (Post Rate)",
      "Total Views",
      "Likes",
      "Comments",
      "Shares",
      "Total Followers",
      "Followers Gained",
      "Followers Lost",
      "Net Follower Growth",
      "Report Status",
      "Submitted At"
    ];

    const csvRows: string[][] = [];
    for (const rep of recordsToExport) {
      const rows = Array.isArray(rep.rows) && rep.rows.length > 0 ? rep.rows : [{}];
      for (const r of rows) {
        const gained = Number(r.followers_gained || 0);
        const lost = Number(r.followers_lost || 0);
        csvRows.push([
          (rep.horizon || "weekly").toUpperCase(),
          rep.period || "",
          rep.tl_name || "Unassigned TL",
          rep.smm_name || "",
          r.country || rep.smm_country || "",
          (r.platform || "").toUpperCase(),
          r.account_name || "",
          r.account_handle || "",
          String(r.posts_published ?? rep.totals?.posts ?? 0),
          String(r.impressions ?? rep.totals?.views ?? 0),
          String(r.likes ?? rep.totals?.likes ?? 0),
          String(r.comments ?? rep.totals?.comments ?? 0),
          String(r.shares_reposts ?? rep.totals?.shares ?? 0),
          String(r.total_followers ?? rep.totals?.followers ?? 0),
          String(gained),
          String(lost),
          String(gained - lost),
          rep.status || "Submitted",
          rep.submitted_at ? new Date(rep.submitted_at).toISOString() : ""
        ]);
      }
    }

    const escapeCsv = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const content = [headers.map(escapeCsv).join(","), ...csvRows.map((row) => row.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Executive_Report_Records_${filenameTag}_${horizon.toUpperCase()}_${activePeriod || "ALL"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    msg("📥 Downloaded Report Records (.CSV)!");
  };

  if (isSmm) {
    const myAssets = (vault.assets || []).filter((a: any) => !uid || a.smm_id === uid);
    const me = vault.profiles.find((p: any) => p.id === uid);
    return (
      <GroupedMetricsTab
        assets={myAssets}
        metrics={vault.metrics || []}
        isLocked={Boolean(me?.is_locked)}
        actorId={uid}
        onSaved={load}
      />
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-[200] px-5 py-3 rounded-2xl bg-emerald-500 text-black font-extrabold text-xs shadow-2xl">
          {toast}
        </div>
      )}

      {/* TOP CONTROLS: WEEKLY / MONTHLY / QUARTERLY / YEARLY TOGGLE + LOCK + CSV EXPORT */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400">
              {isAdm ? "Master Admin · SMM Reports Grouped by Team Leader" : "Team Leader · Squad Report Collection & Compliance"}
            </span>
            <h2 className="text-xl font-black text-white mt-0.5">
              📊 {horizon.toUpperCase()} REPORTS ({activePeriod || "All Periods"})
            </h2>
          </div>

          <div className="flex bg-black p-1 rounded-2xl border border-zinc-800">
            {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setHorizon(h);
                  setPeriod("");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all ${
                  horizon === h ? "bg-emerald-500 text-black shadow" : "text-zinc-400 hover:text-white"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-zinc-400">Period:</span>
            <select
              value={activePeriod}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {isAdm && (
              <select
                value={tlFilter}
                onChange={(e) => setTlFilter(e.target.value)}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-bold"
              >
                <option value="all">All Team Leader Groups ({tls.length} TLs)</option>
                {tls.map((tl: any) => (
                  <option key={tl.id} value={tl.id}>TL: {tl.full_name} ({tl.country})</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleLockAll(true, isTl ? "squad" : "all")}
              className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-extrabold text-xs"
            >
              🔒 {isTl ? "Lock Squad Submissions" : "Lock All Submissions"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleLockAll(false, isTl ? "squad" : "all")}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs"
            >
              🔓 {isTl ? "Unlock Squad Submissions" : "Unlock All Submissions"}
            </button>
            <button
              type="button"
              onClick={() => downloadReportsCSV(periodReports, `${horizon}_${activePeriod}`)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg"
            >
              📥 Download {horizon.toUpperCase()} Reports (.CSV)
            </button>
            {isAdm && (
              <button
                type="button"
                onClick={() => downloadReportsCSV(vault.reportRecords || [], "All_Stored_Reports")}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg"
              >
                📥 Export All Stored Reports (.CSV)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TEAM LEADER VIEW: WHO SUBMITTED VS WHO DID NOT + LOCK + FORWARD TO ADMIN */}
      {isTl && (() => {
        const squadReportsThisPeriod = periodReports.filter((r: any) =>
          mySquadSmms.some((s: any) => s.id === r.smm_id)
        );
        const submittedSmmIds = new Set(squadReportsThisPeriod.map((r: any) => r.smm_id));
        const submittedMembers = mySquadSmms.filter((s: any) => submittedSmmIds.has(s.id));
        const missingMembers = mySquadSmms.filter((s: any) => !submittedSmmIds.has(s.id));

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-zinc-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-emerald-400">
                    ✅ Submitted This {horizon} ({submittedMembers.length} / {mySquadSmms.length})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">{activePeriod}</span>
                </div>
                {submittedMembers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black text-xs text-zinc-500">No squad members have submitted for {activePeriod} yet.</div>
                ) : (
                  <div className="space-y-2">
                    {submittedMembers.map((s: any) => {
                      const rep = squadReportsThisPeriod.find((r: any) => r.smm_id === s.id);
                      return (
                        <div key={s.id} className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-white">{s.full_name}</span>
                            <span className="ml-2 text-[11px] text-emerald-400">
                              ✓ {rep?.totals?.posts || 0} Posts · {(rep?.totals?.views || 0).toLocaleString()} Views
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSingleLock(s)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                              s.is_locked ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-zinc-900 text-zinc-300"
                            }`}
                          >
                            {s.is_locked ? "🔒 Locked (Unlock)" : "🔓 Open (Lock)"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-5 rounded-3xl bg-zinc-950 border border-red-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-red-400">
                    ⏳ Did Not Submit Yet ({missingMembers.length} / {mySquadSmms.length})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">{activePeriod}</span>
                </div>
                {missingMembers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-bold">
                    🎉 All squad members have submitted their {horizon} report!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {missingMembers.map((s: any) => (
                      <div key={s.id} className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-extrabold text-white">{s.full_name}</span>
                          <span className="ml-2 px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">Missing {activePeriod}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleSingleLock(s)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                            s.is_locked ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-zinc-900 text-zinc-300"
                          }`}
                        >
                          {s.is_locked ? "🔒 Locked (Unlock)" : "🔓 Open (Lock)"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    📋 Squad Member {horizon} Report History ({squadReportsThisPeriod.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400">Collect your squad's submitted metric reports and forward them to Master Admin</p>
                </div>
                <button
                  type="button"
                  disabled={busy || squadReportsThisPeriod.length === 0}
                  onClick={() => handleForwardSquadToAdmin(squadReportsThisPeriod.map((x: any) => x.id))}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-lg"
                >
                  📤 Submit Collected Squad Reports to Admin ({squadReportsThisPeriod.length})
                </button>
              </div>

              {squadReportsThisPeriod.map((rep: any) => (
                <div key={rep.id} className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-extrabold text-white">{rep.smm_name}</span>
                      <span className="ml-2 text-[11px] text-emerald-400 font-mono">
                        {rep.horizon?.toUpperCase()} · {rep.period} ({rep.account_count || (rep.rows || []).length} Accounts)
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${rep.forwarded_to_admin ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
                      {rep.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-zinc-950 p-3 rounded-xl">
                    <div>Posts: <b className="text-emerald-400">{(rep.totals?.posts || 0).toLocaleString()}</b></div>
                    <div>Views: <b className="text-purple-300">{(rep.totals?.views || 0).toLocaleString()}</b></div>
                    <div>Likes: <b className="text-pink-300">{(rep.totals?.likes || 0).toLocaleString()}</b></div>
                    <div>Followers: <b className="text-blue-300">{(rep.totals?.followers || 0).toLocaleString()}</b></div>
                    <div>Net Growth: <b className="text-amber-300">{((rep.totals?.gained || 0) - (rep.totals?.lost || 0)).toLocaleString()}</b></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ADMIN VIEW: ALL SMM REPORTS GROUPED BY THEIR TEAM LEADER (TL) */}
      {isAdm && (
        <div className="space-y-6">
          {tls
            .filter((tl: any) => tlFilter === "all" || tl.id === tlFilter)
            .map((tl: any) => {
              const smmsUnderTl = smms.filter(
                (s: any) => s.team_leader_id === tl.id || (s.team_leader_ids || []).includes(tl.id)
              );
              const smmIdsUnderTl = new Set(smmsUnderTl.map((s: any) => s.id));
              const groupReports = periodReports.filter((r: any) => {
    if (r.tl_id === tl.id || smmIdsUnderTl.has(r.smm_id)) return true;
    if ((!r.tl_id || r.tl_id === "unassigned") && smmsUnderTl.length === 0) return true;
    return false;
  });
              const submittedIds = new Set(groupReports.map((r: any) => r.smm_id));
              const submittedSmms = smmsUnderTl.filter((s: any) => submittedIds.has(s.id));

              const groupTotals = groupReports.reduce(
                (acc: any, r: any) => {
                  acc.posts += Number(r.totals?.posts || 0);
                  acc.views += Number(r.totals?.views || 0);
                  acc.likes += Number(r.totals?.likes || 0);
                  acc.net += Number(r.totals?.gained || 0) - Number(r.totals?.lost || 0);
                  return acc;
                },
                { posts: 0, views: 0, likes: 0, net: 0 }
              );

              return (
                <div key={tl.id} className="bg-zinc-950 border border-purple-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold uppercase">
                          🛡️ Team Leader Group
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">{tl.country}</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-1">
                        {tl.full_name} — Squad SMM Reports ({submittedSmms.length}/{smmsUnderTl.length} Submitted)
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="px-3 py-1.5 rounded-xl bg-black border border-zinc-800">
                        Squad Posts: <b className="text-emerald-400">{groupTotals.posts.toLocaleString()}</b> · Views: <b className="text-purple-300">{groupTotals.views.toLocaleString()}</b>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadReportsCSV(groupReports, `TL_${(tl.full_name || "Squad").replace(/\s+/g, "_")}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs"
                      >
                        📥 Export {tl.full_name}'s Group (.CSV)
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Squad Members (Click to Lock/Unlock):</span>
                    {smmsUnderTl.map((s: any) => {
                      const hasSub = submittedIds.has(s.id);
                      return (
                        <span
                          key={s.id}
                          onClick={() => handleToggleSingleLock(s)}
                          className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 border ${
                            hasSub
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-red-500/15 border-red-500/40 text-red-300"
                          }`}
                        >
                          <span>{hasSub ? "✅" : "⏳"}</span>
                          <span>{s.full_name}</span>
                          <span className="text-[10px] opacity-80">{s.is_locked ? "🔒" : "🔓"}</span>
                        </span>
                      );
                    })}
                  </div>

                  {groupReports.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-black border border-zinc-900 text-xs text-zinc-500">
                      No {horizon} reports submitted under {tl.full_name} for {activePeriod} yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupReports.map((rep: any) => (
                        <div key={rep.id} className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-white">👤 SMM: {rep.smm_name}</span>
                              <span className="px-2 py-0.5 rounded bg-zinc-900 text-emerald-400 font-mono text-[10px]">
                                {rep.horizon?.toUpperCase()} · {rep.period}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rep.forwarded_to_admin ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
                                {rep.status}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              Submitted: {rep.submitted_at ? new Date(rep.submitted_at).toLocaleString() : ""}
                            </span>
                          </div>

                          {Array.isArray(rep.rows) && rep.rows.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="text-[10px] uppercase text-zinc-500 border-b border-zinc-900">
                                    <th className="p-2">Platform</th>
                                    <th className="p-2">Account</th>
                                    <th className="p-2">Posts (Rate)</th>
                                    <th className="p-2">Views</th>
                                    <th className="p-2">Likes</th>
                                    <th className="p-2">Comments</th>
                                    <th className="p-2">Shares</th>
                                    <th className="p-2">Followers</th>
                                    <th className="p-2">+Gained / -Lost</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900/60">
                                  {rep.rows.map((r: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="p-2 uppercase font-bold text-purple-300">{r.platform}</td>
                                      <td className="p-2 font-bold text-white">{r.account_name || r.account_handle}</td>
                                      <td className="p-2 font-mono text-emerald-400 font-bold">{r.posts_published || 0}</td>
                                      <td className="p-2 font-mono text-zinc-200">{Number(r.impressions || 0).toLocaleString()}</td>
                                      <td className="p-2 font-mono text-pink-300">{Number(r.likes || 0).toLocaleString()}</td>
                                      <td className="p-2 font-mono text-zinc-300">{Number(r.comments || 0).toLocaleString()}</td>
                                      <td className="p-2 font-mono text-zinc-300">{Number(r.shares_reposts || 0).toLocaleString()}</td>
                                      <td className="p-2 font-mono text-blue-300">{Number(r.total_followers || 0).toLocaleString()}</td>
                                      <td className="p-2 font-mono text-amber-300">
                                        +{r.followers_gained || 0} / -{r.followers_lost || 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function ExecutiveOverlay() {
  const [briefLog, setBriefLog] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const iv = setInterval(() => {
      // Fix any "open" button typo back to "🔒 Lock"
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent || "").trim().toLowerCase() === "open" && !b.dataset.fixedLock) {
          b.dataset.fixedLock = "1";
          b.textContent = "🔒 Lock";
        }
      });

      // Clickable Activity Archive rows -> Brief Professional Info Card
      if (window.location.pathname.startsWith("/admin")) {
        document.querySelectorAll("tr").forEach((row: any) => {
          const txt = row.textContent || "";
          if (
            (txt.includes("CREATE") || txt.includes("UPDATE") || txt.includes("DELETE") || txt.includes("UPSERT") || txt.includes("LOCK") || txt.includes("2026")) &&
            !row.dataset.briefBound &&
            !row.querySelector("th")
          ) {
            row.dataset.briefBound = "1";
            row.style.cursor = "pointer";
            row.title = "Click for brief professional summary";
            row.addEventListener("click", (e: any) => {
              if (e.target?.tagName === "BUTTON") return;
              const logs = (window as any).__auditLogsCache || [];
              const found =
                logs.find((l: any) => l.summary && txt.includes(l.summary.slice(0, 18))) ||
                logs.find((l: any) => l.actor_name && txt.includes(l.actor_name)) ||
                logs[0];
              if (found) setBriefLog(found);
            });
          }
        });
      }
    }, 700);
    return () => clearInterval(iv);
  }, []);

  if (!briefLog) return null;

  return (
    <div className="fixed inset-0 z-[155] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBriefLog(null)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-950 border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl text-left text-xs"
      >
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-extrabold text-[10px] uppercase">
                {briefLog.action || "EVENT"}
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px] uppercase">
                {briefLog.entity_type || "RECORD"}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-white mt-1.5">{briefLog.summary}</h3>
          </div>
          <button type="button" onClick={() => setBriefLog(null)} className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-black border border-zinc-800 space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Performed By:</span>
            <span className="font-bold text-white">{briefLog.actor_name || "Administrator"} ({briefLog.actor_role || "admin"})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Timestamp:</span>
            <span className="font-mono text-zinc-300">{briefLog.created_at ? new Date(briefLog.created_at).toLocaleString() : "Recorded"}</span>
          </div>
          {briefLog.record_snapshot?.platform && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Platform & Country:</span>
              <span className="font-bold text-purple-300 uppercase">{briefLog.record_snapshot.platform} · {briefLog.record_snapshot.country_language || "Global"}</span>
            </div>
          )}
          {(briefLog.record_snapshot?.bio || briefLog.record_snapshot?.account_id || briefLog.record_snapshot?.full_name) && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Target Record:</span>
              <span className="font-bold text-emerald-400">{briefLog.record_snapshot.bio || briefLog.record_snapshot.full_name || briefLog.record_snapshot.account_id}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setBriefLog(null)} className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
