"use client";

import React, { useState, useEffect } from "react";
import { PLATFORMS, TimeHorizon } from "@/lib/constants";

export function GroupedMetricsTab({ assets = [], metrics = [], weekOf, setWeekOf, isLocked = false, actorId, onSaved }: any) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const [horizon, setHorizon] = useState<TimeHorizon>("weekly");
  const [period, setPeriod] = useState<string>(() => weekOf || new Date().toISOString().split("T")[0]);
  const [filterPlat, setFilterPlat] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [myReports, setMyReports] = useState<any[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<any[]>(Array.isArray(metrics) ? metrics : []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Update default period format when SMM switches between Weekly, Monthly, Quarterly, and Yearly
  const handleSwitchHorizon = (h: TimeHorizon) => {
    setHorizon(h);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const q = Math.ceil((now.getMonth() + 1) / 3);
    if (h === "weekly") setPeriod(weekOf || now.toISOString().split("T")[0]);
    else if (h === "monthly") setPeriod(`${y}-${m}`);
    else if (h === "quarterly") setPeriod(`${y}-Q${q}`);
    else setPeriod(`${y}`);
  };

  const fetchVaultReports = async () => {
    try {
      const r = await fetch("/api/crud", { cache: "no-store" });
      const j = await r.json();
      if (Array.isArray(j?.metrics)) setLiveMetrics(j.metrics);
      if (Array.isArray(j?.reportRecords)) {
        const mine = actorId ? j.reportRecords.filter((x: any) => x.smm_id === actorId) : j.reportRecords;
        setMyReports(mine);
      }
    } catch {}
  };

  useEffect(() => {
    fetchVaultReports();
  }, [actorId, horizon, period]);

  const assetSig = safeAssets.map((a: any) => a?.id || "").join(",");
  useEffect(() => {
    // Check if we already have a saved report for this (horizon + period)
    const existingReport = myReports.find((r: any) => r.horizon === horizon && r.period === period);
    const next: Record<string, any> = {};
    for (const a of safeAssets) {
      if (!a?.id) continue;
      const repRow = existingReport?.rows?.find((x: any) => x.asset_id === a.id);
      const metRow = liveMetrics.find((m: any) => m && m.asset_id === a.id && m.week_of === period);
      const ex = repRow || metRow || {};
      next[a.id] = {
        posts_published: ex.posts_published ?? "",
        impressions: ex.impressions ?? "",
        likes: ex.likes ?? "",
        comments: ex.comments ?? "",
        shares_reposts: ex.shares_reposts ?? "",
        total_followers: ex.total_followers ?? "",
        followers_gained: ex.followers_gained ?? "",
        followers_lost: ex.followers_lost ?? "",
        top_post_impressions: ex.top_post_impressions ?? ""
      };
    }
    setDrafts(next);
  }, [assetSig, myReports.length, liveMetrics.length, horizon, period]);

  const handleSubmitReport = async () => {
    if (isLocked) return;
    setSaving(true);
    setMsg("");
    try {
      const unlockedAssets = safeAssets.filter((a: any) => a?.id && a.status !== "locked" && !a.is_locked);
      const rows = unlockedAssets.map((a: any) => {
        const d = drafts[a.id] || {};
        const l = Math.max(0, Number(d.likes || 0) || 0);
        const c = Math.max(0, Number(d.comments || 0) || 0);
        const s = Math.max(0, Number(d.shares_reposts || 0) || 0);
        return {
          asset_id: a.id,
          account_name: a.bio || a.account_id,
          account_handle: a.account_id,
          platform: a.platform,
          country: a.country_language || "Kenya",
          week_of: period,
          posts_published: Math.max(0, Number(d.posts_published || 0) || 0),
          impressions: Math.max(0, Number(d.impressions || 0) || 0),
          likes: l,
          comments: c,
          shares_reposts: s,
          engagements: l + c + s,
          total_followers: Math.max(0, Number(d.total_followers || 0) || 0),
          followers_gained: Math.max(0, Number(d.followers_gained || 0) || 0),
          followers_lost: Math.max(0, Number(d.followers_lost || 0) || 0),
          top_post_impressions: Math.max(0, Number(d.top_post_impressions || 0) || 0)
        };
      });

      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId,
          entity: "report_record",
          action: "submit_smm_report",
          payload: { horizon, period, rows }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to submit report");
      await fetchVaultReports();
      setMsg(`✓ Submitted ${horizon.toUpperCase()} Report (${period}) to your Team Leader!`);
      if (onSaved) onSaved();
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activePlats = PLATFORMS.filter(
    (p) => (filterPlat === "all" || filterPlat === p) && safeAssets.some((a: any) => (a?.platform || "").toLowerCase() === p)
  );

  return (
    <div className="space-y-6">
      {isLocked && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-between shadow-lg">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-300">🔒 Report Submissions Locked</h4>
            <p className="text-[11px] text-red-200/80">Your Team Leader or Admin has locked report submissions for audit review.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-extrabold">🔒 LOCKED</span>
        </div>
      )}

      {/* TOP BAR: TOGGLE WEEKLY / MONTHLY / QUARTERLY / YEARLY + PERIOD + SUBMIT */}
      <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-extrabold text-emerald-400">SMM Metric Report Builder</span>
            <h3 className="text-base font-black text-white">Submit {horizon.toUpperCase()} Metric Report to Team Leader</h3>
          </div>

          {/* 4-HORIZON TOGGLE PILLS */}
          <div className="flex items-center gap-1 bg-black p-1.5 rounded-2xl border border-zinc-800">
            {(["weekly", "monthly", "quarterly", "yearly"] as TimeHorizon[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleSwitchHorizon(h)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all ${
                  horizon === h ? "bg-emerald-500 text-black shadow-md" : "text-zinc-400 hover:text-white"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-zinc-400">
              {horizon === "weekly" ? "Week Of:" : horizon === "monthly" ? "Month (YYYY-MM):" : horizon === "quarterly" ? "Quarter (YYYY-Q#):" : "Year (YYYY):"}
            </span>
            {horizon === "weekly" ? (
              <input
                type="date"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  if (setWeekOf) setWeekOf(e.target.value);
                }}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
              />
            ) : horizon === "monthly" ? (
              <input
                type="month"
                value={period.slice(0, 7)}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
              />
            ) : horizon === "quarterly" ? (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
              >
                {["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2025-Q4"].map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            ) : (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono"
              >
                {["2026", "2025", "2024"].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}

            <select
              value={filterPlat}
              onChange={(e) => setFilterPlat(e.target.value)}
              className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white uppercase"
            >
              <option value="all">All Platforms ({safeAssets.length})</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {msg && <span className="text-xs font-extrabold text-emerald-400">{msg}</span>}
            <button
              type="button"
              disabled={isLocked || saving}
              onClick={handleSubmitReport}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-extrabold text-xs shadow-lg transition-all"
            >
              {saving ? "⏳ Submitting..." : isLocked ? "🔒 Submissions Locked" : `📤 Submit ${horizon.toUpperCase()} Report (${period})`}
            </button>
          </div>
        </div>
      </div>

      {/* METRIC REPORT INPUT TABLE BY PLATFORM */}
      {activePlats.map((plat) => {
        const list = safeAssets.filter((a: any) => (a?.platform || "").toLowerCase() === plat);
        return (
          <div key={plat} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-white">{plat} Accounts ({list.length})</span>
              <span className="text-[11px] text-emerald-400 font-mono">{horizon.toUpperCase()} · {period}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-400 bg-black/40">
                    <th className="p-3">Account & Lock Status</th>
                    <th className="p-2">Posts (Post Rate)</th>
                    <th className="p-2">Views</th>
                    <th className="p-2">Likes</th>
                    <th className="p-2">Comments</th>
                    <th className="p-2">Shares</th>
                    <th className="p-2">Followers</th>
                    <th className="p-2">+Gained</th>
                    <th className="p-2">-Lost</th>
                    <th className="p-2">Top Post</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {list.map((a: any) => {
                    const d = drafts[a.id] || {};
                    const locked = isLocked || a.status === "locked" || a.is_locked;
                    return (
                      <tr key={a.id} className={locked ? "bg-red-950/20 opacity-80" : "hover:bg-zinc-900/30"}>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <span>{a.bio || a.account_id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${locked ? "bg-red-500/20 text-red-300" : "bg-emerald-500/15 text-emerald-400"}`}>
                              {locked ? "🔒 LOCKED" : "🟢 ACTIVE"}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">{a.account_id}</div>
                        </td>
                        {["posts_published", "impressions", "likes", "comments", "shares_reposts", "total_followers", "followers_gained", "followers_lost", "top_post_impressions"].map((f) => (
                          <td key={f} className="p-1.5">
                            <input
                              type="number"
                              min="0"
                              disabled={locked}
                              value={d[f] ?? ""}
                              onChange={(e) => setDrafts((p) => ({ ...p, [a.id]: { ...(p[a.id] || {}), [f]: e.target.value } }))}
                              placeholder="0"
                              className="w-20 rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none disabled:opacity-40"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* SMM SUBMITTED REPORTS HISTORY */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] uppercase font-extrabold text-purple-400">SMM Report Archive</span>
            <h3 className="text-sm font-black text-white">📜 My Submitted Reports History ({myReports.length})</h3>
          </div>
          <span className="text-[11px] text-zinc-400">Showing Weekly, Monthly, Quarterly & Yearly submissions</span>
        </div>

        {myReports.length === 0 ? (
          <div className="p-6 rounded-xl bg-black border border-zinc-900 text-center text-xs text-zinc-500">
            No reports submitted yet. Choose Weekly, Monthly, Quarterly, or Yearly above and click Submit Report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-400 bg-black">
                  <th className="p-3">Horizon</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Team Leader</th>
                  <th className="p-3">Accounts</th>
                  <th className="p-3">Total Posts</th>
                  <th className="p-3">Total Views</th>
                  <th className="p-3">Likes</th>
                  <th className="p-3">Net Followers</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {myReports.map((rep: any) => (
                  <tr
                    key={rep.id}
                    onClick={() => {
                      setHorizon(rep.horizon || "weekly");
                      setPeriod(rep.period || "");
                    }}
                    className="hover:bg-zinc-900/40 cursor-pointer"
                    title="Click to load this report period into the editor above"
                  >
                    <td className="p-3 uppercase font-extrabold text-purple-300">{rep.horizon}</td>
                    <td className="p-3 font-mono font-bold text-white">{rep.period}</td>
                    <td className="p-3 text-zinc-300">{rep.tl_name || "Team Leader"}</td>
                    <td className="p-3 font-mono">{rep.account_count || (rep.rows || []).length}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{(rep.totals?.posts || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-purple-300">{(rep.totals?.views || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-pink-300">{(rep.totals?.likes || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-amber-300">
                      {((rep.totals?.gained || 0) - (rep.totals?.lost || 0)).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rep.forwarded_to_admin ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
                        {rep.status || "Submitted to TL"}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-500 font-mono text-[11px]">
                      {rep.submitted_at ? new Date(rep.submitted_at).toLocaleString() : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
