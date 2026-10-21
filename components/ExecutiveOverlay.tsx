"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PLATFORMS, ALL_COUNTRIES, ASSET_LANGUAGES, isPhoneInput, aggregateMetricsByHorizon, exportHorizonCSV, TimeHorizon } from "@/lib/constants";
import { adminSupabase, tlSupabase, managerSupabase } from "@/lib/supabase";

export function ExecutiveOverlay() {
  const [path, setPath] = useState("");
  const [uid, setUid] = useState("");
  const [showReportsTab, setShowReportsTab] = useState(false);
  const [horizon, setHorizon] = useState<TimeHorizon>("weekly");
  const [period, setPeriod] = useState(() => new Date().toISOString().split("T")[0]);
  const [briefLog, setBriefLog] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [vault, setVault] = useState<any>({ logs: [], reports: [], passwords: {}, emails: {}, profiles: [], assets: [], metrics: [] });

  // SMM Report Form State
  const [smmTlId, setSmmTlId] = useState("");
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [evidenceLink, setEvidenceLink] = useState("");

  // TL Consolidated Report Form State
  const [execSummary, setExecSummary] = useState("");
  const [learnings, setLearnings] = useState("");
  const [escalations, setEscalations] = useState("");
  const [selectedSmmRepIds, setSelectedSmmRepIds] = useState<string[]>([]);

  // Full Add Asset Modal State (for SMM, TL, and Admin)
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assignMode, setAssignMode] = useState<"full" | "email_only">("full");
  const [af, setAf] = useState<any>({
    platform: "twitter", tlId: "", smmId: "", country: "Kenya", lang: "English",
    project: "General Campaign", name: "", handle: "", pass: "", email: "",
    emailPass: "", url: "", twoFa: "", showPw: false
  });

  const msg = (s: string) => { setToast(s); setTimeout(() => setToast(""), 4000); };

  const load = async () => {
    try {
      const j = await fetch("/api/crud", { cache: "no-store" }).then(r => r.json());
      if (j) {
        (window as any).__pwMap = j.passwords || {};
        (window as any).__emailMap = j.emails || {};
        (window as any).__auditLogsCache = j.logs || [];
        const tls = (j.profiles || []).filter((p: any) => p.role === "team_leader");
        const smms = (j.profiles || []).filter((p: any) => p.role === "smm");
        if (!smmTlId && tls[0]?.id) setSmmTlId(tls[0].id);
        setAf((p: any) => ({ ...p, tlId: p.tlId || tls[0]?.id || "", smmId: p.smmId || smms[0]?.id || "" }));
        setVault({
          logs: j.logs || [],
          reports: j.reports || [],
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
    sb.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setUid(data.session.user.id);
    }).catch(() => {});
    load();
  }, []);

  // Update default period format when horizon changes
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const q = Math.ceil((now.getMonth() + 1) / 3);
    if (horizon === "weekly") setPeriod(now.toISOString().split("T")[0]);
    else if (horizon === "monthly") setPeriod(`${y}-${m}`);
    else if (horizon === "quarterly") setPeriod(`${y}-Q${q}`);
    else setPeriod(`${y}`);
  }, [horizon]);

  // DOM Enhancer:
  // 1. Makes clicking any Activity Archive record open a clean, brief professional summary card
  // 2. Injects 👁 Show / Hide Password above any Reset Password input
  useEffect(() => {
    if (typeof window === "undefined") return;
    const iv = setInterval(() => {
      // Fix any "open" button typo back to "🔒 Lock"
      document.querySelectorAll("button").forEach((btn) => {
        const t = (btn.textContent || "").trim();
        if (t.toLowerCase() === "open" && !btn.dataset.fixedLock) {
          btn.dataset.fixedLock = "1";
          btn.textContent = "🔒 Lock";
        }
      });

      // Clickable Activity Archive rows -> Brief Professional Info Popover
      if (window.location.pathname.startsWith("/admin")) {
        document.querySelectorAll("tr, .archive-row").forEach((row: any) => {
          const txt = row.textContent || "";
          if (
            (txt.includes("CREATE") || txt.includes("UPDATE") || txt.includes("DELETE") || txt.includes("UPSERT") || txt.includes("LOCK") || txt.includes("REPORT") || txt.includes("2026")) &&
            !row.dataset.briefBound &&
            !row.querySelector("th")
          ) {
            row.dataset.briefBound = "1";
            row.style.cursor = "pointer";
            row.title = "Click for brief professional record summary";
            row.addEventListener("click", (e: any) => {
              if (e.target?.tagName === "BUTTON") return;
              const logs = (window as any).__auditLogsCache || vault.logs || [];
              const found =
                logs.find((l: any) => l.summary && txt.includes(l.summary.slice(0, 18))) ||
                logs.find((l: any) => l.actor_name && txt.includes(l.actor_name)) ||
                logs[0];
              if (found) setBriefLog(found);
            });
          }
        });
      }
    }, 800);
    return () => clearInterval(iv);
  }, [vault.logs]);

  const isAdm = path.startsWith("/admin");
  const isTl = path.startsWith("/team-leader");
  const isSmm = path.startsWith("/smm");

  const currentUser = vault.profiles.find((p: any) => p.id === uid);
  const tls = vault.profiles.filter((p: any) => p.role === "team_leader");
  const smms = vault.profiles.filter((p: any) => p.role === "smm");

  // Compute scoped assets & aggregated stats for the selected Horizon (Weekly / Monthly / Quarterly / Yearly)
  const scopedAssets = useMemo(() => {
    const all = vault.assets || [];
    if (isSmm && uid) return all.filter((a: any) => a.smm_id === uid);
    if (isTl && uid) {
      const sqIds = new Set(smms.filter((s: any) => s.team_leader_id === uid).map((s: any) => s.id));
      return all.filter((a: any) => a.team_leader_id === uid || sqIds.has(a.smm_id));
    }
    return all;
  }, [vault.assets, smms.length, isSmm, isTl, uid]);

  const horizonStats = useMemo(() => {
    const assetIds = new Set(scopedAssets.map((a: any) => a.id));
    const agg = aggregateMetricsByHorizon(vault.metrics || [], horizon).filter((r: any) => assetIds.has(r.asset_id));
    const periodRows = agg.filter((r: any) => !period || r.period === period);
    const targetRows = periodRows.length > 0 ? periodRows : agg;
    const posts = targetRows.reduce((s: number, r: any) => s + Number(r.posts_published || 0), 0);
    const views = targetRows.reduce((s: number, r: any) => s + Number(r.impressions || 0), 0);
    const likes = targetRows.reduce((s: number, r: any) => s + Number(r.likes || 0), 0);
    const comments = targetRows.reduce((s: number, r: any) => s + Number(r.comments || 0), 0);
    const shares = targetRows.reduce((s: number, r: any) => s + Number(r.shares_reposts || 0), 0);
    const gained = targetRows.reduce((s: number, r: any) => s + Number(r.followers_gained || 0), 0);
    const lost = targetRows.reduce((s: number, r: any) => s + Number(r.followers_lost || 0), 0);
    return {
      accounts: scopedAssets.length,
      posts,
      views,
      likes,
      comments,
      shares,
      gained,
      lost,
      netFollowers: gained - lost
    };
  }, [scopedAssets, vault.metrics, horizon, period]);

  // Filter reports by role hierarchy
  const smmReports = useMemo(() => {
    const list = (vault.reports || []).filter((r: any) => r.tier === "smm_to_tl" && r.horizon === horizon);
    if (isSmm && uid) return list.filter((r: any) => r.smm_id === uid);
    if (isTl && uid) return list.filter((r: any) => !r.tl_id || r.tl_id === uid);
    return list;
  }, [vault.reports, horizon, isSmm, isTl, uid]);

  const tlSquadReports = useMemo(() => {
    return (vault.reports || []).filter((r: any) => r.tier === "tl_to_admin" && r.horizon === horizon);
  }, [vault.reports, horizon]);

  const handleSmmSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const targetTl = tls.find((t: any) => t.id === (smmTlId || currentUser?.team_leader_id)) || tls[0];
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: uid,
          entity: "report",
          action: "submit_smm",
          payload: {
            horizon,
            period,
            tl_id: targetTl?.id || "",
            tl_name: targetTl?.full_name || "Team Leader",
            stats: horizonStats,
            highlights,
            blockers,
            next_steps: nextSteps,
            evidence_link: evidenceLink
          }
        })
      });
      if (!r.ok) throw new Error("Failed to submit report");
      setHighlights(""); setBlockers(""); setNextSteps(""); setEvidenceLink("");
      await load();
      msg(`✓ Submitted ${horizon.toUpperCase()} Report (${period}) to Team Leader!`);
    } catch (err: any) {
      msg(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleTlSubmitSquadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: uid,
          entity: "report",
          action: "submit_tl",
          payload: {
            horizon,
            period,
            includedReportIds: selectedSmmRepIds.length ? selectedSmmRepIds : smmReports.map((x: any) => x.id),
            stats: horizonStats,
            executive_summary: execSummary,
            regional_learnings: learnings,
            escalations
          }
        })
      });
      if (!r.ok) throw new Error("Failed to forward squad report");
      setExecSummary(""); setLearnings(""); setEscalations("");
      await load();
      msg(`✓ Compiled & submitted ${horizon.toUpperCase()} Squad Report to Master Admin!`);
    } catch (err: any) {
      msg(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    setBusy(true);
    try {
      await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: uid || "admin", entity: "report", action: "update_status", payload: { reportId, status } })
      });
      await load();
      msg(`✓ Marked report as: ${status}`);
    } catch {} finally {
      setBusy(false);
    }
  };

  const handleSaveFullAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const isSeed = isTl && assignMode === "email_only";
      const isFbPhone = af.platform === "facebook" && isPhoneInput(af.email);
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: uid || "admin",
          entity: "asset",
          action: "create",
          payload: {
            platform: af.platform,
            team_leader_id: isTl ? uid : af.tlId || null,
            smm_id: isSmm ? uid : af.smmId || null,
            country_language: af.country,
            language: af.lang,
            project_name: af.project,
            bio: isSeed ? `Pending Setup (${af.platform.toUpperCase()})` : af.name || af.handle,
            account_id: isSeed ? af.email || "Pending Handle" : af.handle,
            account_password: isSeed ? "" : af.pass,
            email: af.email,
            email_password: isFbPhone ? "" : af.emailPass,
            profile_link: isSeed ? "" : af.url,
            two_fa_code: isSeed ? "" : af.twoFa,
            status: "active"
          }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save asset");
      setShowAssetModal(false);
      setAf({ ...af, name: "", handle: "", pass: "", email: "", emailPass: "", url: "", twoFa: "" });
      await load();
      msg("✓ Asset saved with all complete details!");
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      msg(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-5 right-5 z-[200] px-5 py-3 rounded-2xl bg-emerald-500 text-black font-extrabold text-xs shadow-2xl">
          {toast}
        </div>
      )}

      {/* HEADER ACTION PILLS: REPORTS TAB (ALL 3 PAGES) + COMPLETE ADD ASSET */}
      <div className="inline-flex flex-wrap items-center gap-2 ml-2">
        <button
          type="button"
          onClick={() => setShowReportsTab(true)}
          className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg flex items-center gap-1.5"
        >
          <span>📊</span>
          <span>{isAdm ? "Master Reports Inbox (W/M/Q/Y)" : isTl ? "Squad Reports Hub (SMM → TL → Admin)" : "Submit Report to TL (W/M/Q/Y)"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAssetModal(true)}
          className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg"
        >
          {isTl ? "+ Assign Asset (All Details)" : "+ Add Asset (All Details)"}
        </button>
      </div>

      {/* =====================================================================
          1. HIERARCHICAL REPORTS TAB MODAL (SMM -> TEAM LEADER -> ADMIN)
             Supports Weekly, Monthly, Quarterly, and Yearly Reports
         ===================================================================== */}
      {showReportsTab && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6" onClick={() => setShowReportsTab(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-zinc-950 border border-purple-500/40 rounded-3xl p-5 sm:p-7 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl text-left"
          >
            {/* Header & Horizon Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-extrabold uppercase">
                    {isAdm ? "Tier 3 · Master Admin Final Review" : isTl ? "Tier 2 · Team Leader Collection & Rollup" : "Tier 1 · SMM Handler Submission"}
                  </span>
                  <span className="text-[11px] text-zinc-400">Flow: SMM ➔ Team Leader ➔ Master Admin</span>
                </div>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAdm
                    ? "Master Admin Executive Reports Center"
                    : isTl
                    ? "Team Leader Squad Reporting & Consolidation Hub"
                    : "SMM Performance & Learning Report Submission"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-black p-1 rounded-2xl border border-zinc-800">
                  {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorizon(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all ${
                        horizon === h ? "bg-purple-600 text-white shadow" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowReportsTab(false)} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 text-xs">
                  ✕
                </button>
              </div>
            </div>

            {/* Auto-Aggregated Horizon Telemetry Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              {[
                ["Active Accounts", horizonStats.accounts, "text-white"],
                ["Total Posts (Rate)", horizonStats.posts.toLocaleString(), "text-emerald-400"],
                ["Total Views", horizonStats.views.toLocaleString(), "text-purple-400"],
                ["Total Likes", horizonStats.likes.toLocaleString(), "text-pink-400"],
                ["Comments & Shares", (horizonStats.comments + horizonStats.shares).toLocaleString(), "text-blue-400"],
                ["Net Follower Growth", (horizonStats.netFollowers >= 0 ? "+" : "") + horizonStats.netFollowers.toLocaleString(), "text-amber-400"]
              ].map(([label, val, color]) => (
                <div key={String(label)} className="p-3 rounded-2xl bg-black border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-zinc-500">{label}</div>
                  <div className={`text-base font-black mt-0.5 ${color}`}>{val}</div>
                </div>
              ))}
            </div>

            {/* ===============================================================
                ROLE 1: SMM VIEW — Submit Report to Team Leader
               =============================================================== */}
            {isSmm && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form onSubmit={handleSmmSubmitReport} className="lg:col-span-7 space-y-4 bg-black/60 border border-zinc-800 p-5 rounded-2xl">
                  <h3 className="text-sm font-extrabold uppercase text-emerald-400">
                    📤 Submit {horizon.toUpperCase()} Report to Team Leader
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400">Reporting Period ({horizon})</label>
                      <input
                        type="text"
                        required
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        placeholder="e.g. 2026-10-21 or 2026-Q4"
                        className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400">Submit To Team Leader</label>
                      <select
                        value={smmTlId}
                        onChange={(e) => setSmmTlId(e.target.value)}
                        className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                      >
                        {tls.map((tl: any) => (
                          <option key={tl.id} value={tl.id}>{tl.full_name} ({tl.country})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">1. Key Wins, Top Performing Posts & Learning Insights</label>
                    <textarea
                      required
                      rows={3}
                      value={highlights}
                      onChange={(e) => setHighlights(e.target.value)}
                      placeholder="Summarize top performing content, audience engagement trends, and what worked best this period..."
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400">2. Challenges / Account Issues</label>
                      <textarea
                        rows={2}
                        value={blockers}
                        onChange={(e) => setBlockers(e.target.value)}
                        placeholder="Any shadowbans, verification hurdles, or low-reach issues..."
                        className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-400">3. Next {horizon} Action Plan</label>
                      <textarea
                        rows={2}
                        value={nextSteps}
                        onChange={(e) => setNextSteps(e.target.value)}
                        placeholder="Planned content angles and growth targets for next period..."
                        className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">4. Top Post Verification URL / Evidence Link (Optional)</label>
                    <input
                      type="url"
                      value={evidenceLink}
                      onChange={(e) => setEvidenceLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs"
                  >
                    {busy ? "⏳ Submitting..." : `📤 Submit ${horizon.toUpperCase()} Report to Team Leader`}
                  </button>
                </form>

                <div className="lg:col-span-5 space-y-3">
                  <h3 className="text-sm font-extrabold uppercase text-purple-300">📋 My Submitted {horizon} Reports ({smmReports.length})</h3>
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {smmReports.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-black border border-zinc-800 text-center text-xs text-zinc-500">
                        No {horizon} reports submitted yet.
                      </div>
                    ) : (
                      smmReports.map((r: any) => (
                        <div key={r.id} className="p-3.5 rounded-2xl bg-black border border-zinc-800 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-white">{r.horizon?.toUpperCase()} · {r.period}</span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">{r.status}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400">To TL: <b className="text-zinc-200">{r.tl_name}</b> · Posts: <b className="text-emerald-400">{r.stats?.posts || 0}</b> · Views: <b className="text-purple-300">{(r.stats?.views || 0).toLocaleString()}</b></div>
                          <p className="text-[11px] text-zinc-300 line-clamp-2">{r.highlights}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                ROLE 2: TEAM LEADER VIEW — Collect SMM Reports & Submit to Admin
               =============================================================== */}
            {isTl && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Incoming SMM Reports Column */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold uppercase text-purple-300">
                      📥 1. Incoming Squad SMM {horizon} Reports ({smmReports.length})
                    </h3>
                    <span className="text-[11px] text-zinc-400">Review & include in Admin rollup</span>
                  </div>
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {smmReports.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-black border border-zinc-800 text-center text-xs text-zinc-500">
                        No SMM {horizon} reports received for this horizon yet.
                      </div>
                    ) : (
                      smmReports.map((r: any) => (
                        <div key={r.id} className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-white">{r.smm_name}</span>
                              <span className="ml-2 text-[11px] text-emerald-400 font-mono">({r.period})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">{r.status}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-zinc-950 text-[11px]">
                            <div>Posts: <b className="text-white">{r.stats?.posts || 0}</b></div>
                            <div>Views: <b className="text-emerald-400">{(r.stats?.views || 0).toLocaleString()}</b></div>
                            <div>Net Fol: <b className="text-purple-300">{r.stats?.netFollowers || 0}</b></div>
                          </div>
                          <div className="text-[11px] text-zinc-300"><b>Wins:</b> {r.highlights}</div>
                          {r.blockers && <div className="text-[11px] text-amber-300"><b>Blockers:</b> {r.blockers}</div>}
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateReportStatus(r.id, "Approved by TL")}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold"
                            >
                              ✅ Approve SMM Report
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateReportStatus(r.id, "Revision Requested")}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold"
                            >
                              🔄 Request Revision
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* TL Consolidated Submission to Master Admin */}
                <form onSubmit={handleTlSubmitSquadReport} className="lg:col-span-6 space-y-4 bg-black/60 border border-blue-500/30 p-5 rounded-2xl">
                  <h3 className="text-sm font-extrabold uppercase text-blue-400">
                    📤 2. Compile & Submit Consolidated {horizon} Squad Report to Admin
                  </h3>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Reporting Period ({horizon})</label>
                    <input
                      type="text"
                      required
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">1. Executive Squad Summary (For Master Admin)</label>
                    <textarea
                      required
                      rows={3}
                      value={execSummary}
                      onChange={(e) => setExecSummary(e.target.value)}
                      placeholder="Synthesize overall squad performance, campaign execution velocity, and key achievements across your SMMs..."
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">2. Regional MEL Learnings & Content Adaptation</label>
                    <textarea
                      rows={2}
                      value={learnings}
                      onChange={(e) => setLearnings(e.target.value)}
                      placeholder="What narratives, languages, or platforms drove the highest engagement this period?"
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-400">3. Resource Requests / Escalations to Admin</label>
                    <textarea
                      rows={2}
                      value={escalations}
                      onChange={(e) => setEscalations(e.target.value)}
                      placeholder="Any new account seeds, SIM/email needs, or personnel escalations..."
                      className="w-full mt-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs"
                  >
                    {busy ? "⏳ Forwarding to Admin..." : `📤 Submit Consolidated ${horizon.toUpperCase()} Report to Master Admin`}
                  </button>
                </form>
              </div>
            )}

            {/* ===============================================================
                ROLE 3: MASTER ADMIN VIEW — Review TL Squad Reports & SMM Reports
               =============================================================== */}
            {isAdm && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold uppercase text-emerald-400">
                    🛡️ Consolidated Team Leader {horizon} Reports ({tlSquadReports.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      exportHorizonCSV({
                        horizon,
                        metrics: vault.metrics,
                        assets: vault.assets,
                        profiles: vault.profiles,
                        scopeLabel: `Master_${horizon.toUpperCase()}_MEL_Report`
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-extrabold text-xs"
                  >
                    📥 Download {horizon.toUpperCase()} Multi-Tab Excel Workbook
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tlSquadReports.length === 0 ? (
                    <div className="col-span-2 p-6 rounded-2xl bg-black border border-zinc-800 text-center text-xs text-zinc-500">
                      No consolidated Team Leader {horizon} reports submitted yet.
                    </div>
                  ) : (
                    tlSquadReports.map((r: any) => (
                      <div key={r.id} className="p-4 rounded-2xl bg-black border border-emerald-500/30 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-emerald-400">TL Squad Report · {r.period}</span>
                            <h4 className="text-sm font-black text-white">{r.tl_name} ({r.country})</h4>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">{r.status}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl bg-zinc-950 text-[11px]">
                          <div>SMM Reports: <b className="text-white">{r.smm_reports_count || 0}</b></div>
                          <div>Posts: <b className="text-emerald-400">{r.stats?.posts || 0}</b></div>
                          <div>Views: <b className="text-purple-300">{(r.stats?.views || 0).toLocaleString()}</b></div>
                          <div>Net Fol: <b className="text-amber-300">{r.stats?.netFollowers || 0}</b></div>
                        </div>
                        <div className="text-zinc-200"><b>Executive Summary:</b> {r.executive_summary}</div>
                        {r.regional_learnings && <div className="text-zinc-400"><b>MEL Learnings:</b> {r.regional_learnings}</div>}
                        {r.escalations && <div className="text-amber-300"><b>Escalations:</b> {r.escalations}</div>}
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateReportStatus(r.id, "✅ Verified & Archived by Admin")}
                            className="px-3 py-1 rounded-lg bg-emerald-500 text-black font-extrabold text-[10px]"
                          >
                            ✅ Verify & Sign Off
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <h3 className="text-xs font-extrabold uppercase text-purple-300 mb-3">
                    👤 Individual SMM {horizon} Submissions ({smmReports.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {smmReports.map((r: any) => (
                      <div key={r.id} className="p-3.5 rounded-2xl bg-black border border-zinc-800 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <b className="text-white">{r.smm_name}</b>
                          <span className="text-[10px] text-purple-300 font-mono">{r.period}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400">TL: {r.tl_name} · Status: <b className="text-emerald-400">{r.status}</b></div>
                        <div className="text-[11px] text-zinc-300 line-clamp-2">{r.highlights}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. BRIEF PROFESSIONAL ARCHIVE RECORD INSPECTOR (ON CLICK)
         ===================================================================== */}
      {briefLog && (
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

            {/* Brief Key-Value Professional Summary */}
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
                  <span className="text-zinc-500">Target Account / User:</span>
                  <span className="font-bold text-emerald-400">{briefLog.record_snapshot.bio || briefLog.record_snapshot.full_name || briefLog.record_snapshot.account_id}</span>
                </div>
              )}
              {briefLog.record_snapshot?.assigned_smm && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Assigned Handler:</span>
                  <span className="text-zinc-200">{briefLog.record_snapshot.assigned_smm} (TL: {briefLog.record_snapshot.assigned_tl || "—"})</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBriefLog(null)} className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 font-bold">
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/crud", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ actorId: uid || "admin", entity: "audit", action: "restore", payload: { logId: briefLog.id } })
                  });
                  setBriefLog(null);
                  await load();
                  msg("♻️ Record restored!");
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-extrabold"
              >
                ♻️ Restore Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. COMPLETE ASSET PROVISIONING MODAL (FOR SMM, TL & ADMIN)
             Includes Every Single Detail + TL Starter Email vs Full Mode
         ===================================================================== */}
      {showAssetModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowAssetModal(false)}>
          <form
            onSubmit={handleSaveFullAsset}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl text-left text-xs"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-emerald-400">
                  {isTl ? "Team Leader Asset Assignment" : isSmm ? "SMM Asset Registration" : "Admin Asset Provisioning"}
                </span>
                <h3 className="text-base font-extrabold text-white">
                  {isTl ? "Assign Social Media Asset to Squad SMM (Complete Details)" : "Add Social Media Asset (Complete Details)"}
                </h3>
              </div>
              <button type="button" onClick={() => setShowAssetModal(false)} className="px-3 py-1 rounded-xl bg-zinc-900 text-zinc-300">
                ✕
              </button>
            </div>

            {isTl && (
              <div className="grid grid-cols-2 gap-2 bg-black p-1.5 rounded-2xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAssignMode("full")}
                  className={`py-2 rounded-xl font-extrabold ${assignMode === "full" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}
                >
                  1. Full Account Details (All Fields)
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode("email_only")}
                  className={`py-2 rounded-xl font-extrabold ${assignMode === "email_only" ? "bg-blue-600 text-white" : "text-zinc-400"}`}
                >
                  2. Starter Email Only (SMM Completes Setup)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Platform</label>
                <select value={af.platform} onChange={(e) => setAf({ ...af, platform: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white uppercase">
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              {!isTl && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">2. Supervising Team Leader</label>
                  <select value={af.tlId} onChange={(e) => setAf({ ...af, tlId: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white">
                    {tls.map((t: any) => <option key={t.id} value={t.id}>{t.full_name} ({t.country})</option>)}
                  </select>
                </div>
              )}
              {!isSmm && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned SMM Handler</label>
                  <select value={af.smmId} onChange={(e) => setAf({ ...af, smmId: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white">
                    {smms.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">3. Target Country</label>
                <select value={af.country} onChange={(e) => setAf({ ...af, country: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white">
                  {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">4. Operating Language</label>
                <select value={af.lang} onChange={(e) => setAf({ ...af, lang: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white">
                  {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">5. Campaign / Project Name</label>
                <input value={af.project} onChange={(e) => setAf({ ...af, project: e.target.value })} placeholder="General Campaign" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white" />
              </div>
            </div>

            {!(isTl && assignMode === "email_only") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">6. Account Display Name / Bio</label>
                  <input required value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} placeholder="Account Display Name" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">7. Username / @Handle / Account ID</label>
                  <input required value={af.handle} onChange={(e) => setAf({ ...af, handle: e.target.value })} placeholder="@username or Account ID" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white font-mono" />
                </div>
                <div>
                  <div className="flex justify-between">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">8. Account Login Password</label>
                    <button type="button" onClick={() => setAf({ ...af, showPw: !af.showPw })} className="text-[10px] text-purple-400 font-bold">👁 {af.showPw ? "Hide" : "Show"}</button>
                  </div>
                  <input type={af.showPw ? "text" : "password"} required value={af.pass} onChange={(e) => setAf({ ...af, pass: e.target.value })} placeholder="Account Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">9. Profile URL</label>
                  <input type="url" value={af.url} onChange={(e) => setAf({ ...af, url: e.target.value })} placeholder="https://..." className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">10. {af.platform === "facebook" ? "FB Email or Phone Number" : "Recovery Email Address"}</label>
                <input required={isTl && assignMode === "email_only"} value={af.email} onChange={(e) => setAf({ ...af, email: e.target.value })} placeholder={af.platform === "facebook" ? "Email or +Phone" : "account@email.com"} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white font-mono" />
              </div>
              {!(af.platform === "facebook" && isPhoneInput(af.email)) ? (
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">11. Recovery Email Password</label>
                  <input type={af.showPw ? "text" : "password"} value={af.emailPass} onChange={(e) => setAf({ ...af, emailPass: e.target.value })} placeholder="Email Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white font-mono" />
                </div>
              ) : (
                <div className="flex items-center px-3 py-2 mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
                  ✓ Phone used — no email PW needed
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">12. 2FA Secret / Backup Code</label>
                <input value={af.twoFa} onChange={(e) => setAf({ ...af, twoFa: e.target.value })} placeholder="2FA Secret (Optional)" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-white font-mono" />
              </div>
            </div>

            <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs">
              {busy ? "⏳ Saving..." : "✓ Save & Register Complete Asset"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
