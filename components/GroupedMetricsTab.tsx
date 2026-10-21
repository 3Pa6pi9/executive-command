"use client";

import React, { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";

export function GroupedMetricsTab({ assets = [], metrics = [], weekOf, setWeekOf, isLocked = false, actorId, onSaved }: any) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const [liveMetrics, setLiveMetrics] = useState<any[]>(Array.isArray(metrics) ? metrics : []);
  const [filterPlat, setFilterPlat] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const currentWeek = weekOf || new Date().toISOString().split("T")[0];

  // Fetch latest saved metrics from /api/crud on mount & week change so saved rows ALWAYS persist
  const fetchFreshMetrics = async () => {
    try {
      const r = await fetch("/api/crud", { cache: "no-store" });
      const j = await r.json();
      if (Array.isArray(j?.metrics)) {
        setLiveMetrics(j.metrics);
        return j.metrics;
      }
    } catch (_e) {}
    return liveMetrics;
  };

  useEffect(() => {
    fetchFreshMetrics();
  }, [currentWeek]);

  // Populate draft inputs whenever week or asset count or liveMetrics count updates
  const assetIdsSig = safeAssets.map((a: any) => a?.id || "").join(",");
  useEffect(() => {
    const source = liveMetrics.length > 0 ? liveMetrics : Array.isArray(metrics) ? metrics : [];
    const next: Record<string, any> = {};
    for (const a of safeAssets) {
      if (!a?.id) continue;
      const ex = source.find((m: any) => m && m.asset_id === a.id && m.week_of === currentWeek) || {};
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
  }, [assetIdsSig, liveMetrics.length, currentWeek]);

  const updateCell = (assetId: string, field: string, val: string) => {
    setDrafts((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [field]: val }
    }));
  };

  const buildPayloadRow = (a: any) => {
    const d = drafts[a.id] || {};
    const likes = Math.max(0, Number(d.likes || 0) || 0);
    const comments = Math.max(0, Number(d.comments || 0) || 0);
    const shares = Math.max(0, Number(d.shares_reposts || 0) || 0);
    return {
      asset_id: a.id,
      week_of: currentWeek,
      posts_published: Math.max(0, Number(d.posts_published || 0) || 0),
      impressions: Math.max(0, Number(d.impressions || 0) || 0),
      likes,
      comments,
      shares_reposts: shares,
      engagements: likes + comments + shares,
      total_followers: Math.max(0, Number(d.total_followers || 0) || 0),
      followers_gained: Math.max(0, Number(d.followers_gained || 0) || 0),
      followers_lost: Math.max(0, Number(d.followers_lost || 0) || 0),
      top_post_impressions: Math.max(0, Number(d.top_post_impressions || 0) || 0)
    };
  };

  const handleSaveSingleRow = async (a: any) => {
    if (isLocked || a.status === "locked" || a.is_locked) return;
    setSavingRowId(a.id);
    setMsg("");
    try {
      const row = buildPayloadRow(a);
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, entity: "metric", action: "bulk_upsert", payload: { rows: [row] } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save row");
      await fetchFreshMetrics();
      setMsg(`✓ Saved weekly record for ${a.bio || a.account_id}!`);
      if (onSaved) onSaved();
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setSavingRowId(null);
    }
  };

  const handleSaveAll = async () => {
    if (isLocked) return;
    setSaving(true);
    setMsg("");
    try {
      const unlockedAssets = safeAssets.filter((a: any) => a?.id && a?.status !== "locked" && !a?.is_locked);
      const rows = unlockedAssets.map((a: any) => buildPayloadRow(a));
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, entity: "metric", action: "bulk_upsert", payload: { rows } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save weekly metrics");
      await fetchFreshMetrics();
      setMsg(`✓ Successfully saved weekly performance & post rate for ${j.count || rows.length} accounts!`);
      if (onSaved) onSaved();
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activePlatforms = PLATFORMS.filter(
    (p) =>
      (filterPlat === "all" || filterPlat === p) &&
      safeAssets.some((a: any) => (a?.platform || "").toLowerCase() === p)
  );

  return (
    <div className="space-y-6">
      {isLocked && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-300">Account & Metric Entry Locked by Administrator</h4>
              <p className="text-[11px] text-red-200/80">Your profile or assets are currently locked for audit. Contact your Team Leader or Admin to unlock.</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase">🔒 LOCKED</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-zinc-400">Week Of:</span>
          <input
            type="date"
            value={currentWeek}
            onChange={(e) => setWeekOf && setWeekOf(e.target.value)}
            className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white"
          />
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
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold text-xs transition-all shadow-lg"
          >
            {saving ? "⏳ Saving All..." : isLocked ? "🔒 Locked by Admin" : "💾 Save All Weekly Performance"}
          </button>
        </div>
      </div>

      {activePlatforms.length === 0 ? (
        <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-400">
          No social media assets found in this view. Use the <b>+ Add Asset</b> tab to add an account.
        </div>
      ) : (
        activePlatforms.map((plat) => {
          const list = safeAssets.filter((a: any) => (a?.platform || "").toLowerCase() === plat);
          return (
            <div key={plat} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-4 py-3 bg-zinc-900/70 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">{plat} Accounts ({list.length})</span>
                <span className="text-[11px] text-zinc-400">Week: {currentWeek}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-400 bg-black/40">
                      <th className="p-3">Account & Lock Identifier</th>
                      <th className="p-2">Posts (Post Rate)</th>
                      <th className="p-2">Views</th>
                      <th className="p-2">Likes</th>
                      <th className="p-2">Comments</th>
                      <th className="p-2">Shares</th>
                      <th className="p-2">Followers</th>
                      <th className="p-2">+Gained</th>
                      <th className="p-2">-Lost</th>
                      <th className="p-2">Top Post</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {list.map((a: any) => {
                      const d = drafts[a.id] || {};
                      const rowLocked = isLocked || a.status === "locked" || a.is_locked;
                      const hasSavedRecord = liveMetrics.some((m: any) => m && m.asset_id === a.id && m.week_of === currentWeek);
                      return (
                        <tr key={a.id} className={rowLocked ? "bg-red-950/20 opacity-80" : "hover:bg-zinc-900/30"}>
                          <td className="p-3 font-medium text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{a.bio || a.account_id}</span>
                              {rowLocked ? (
                                <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-[9px] font-bold uppercase">🔒 LOCKED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase">🟢 ACTIVE</span>
                              )}
                              {hasSavedRecord && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">✓ Saved</span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">{a.account_id}</div>
                          </td>
                          {["posts_published", "impressions", "likes", "comments", "shares_reposts", "total_followers", "followers_gained", "followers_lost", "top_post_impressions"].map((f) => (
                            <td key={f} className="p-1.5">
                              <input
                                type="number"
                                min="0"
                                disabled={rowLocked}
                                value={d[f] ?? ""}
                                onChange={(e) => updateCell(a.id, f, e.target.value)}
                                placeholder="0"
                                className="w-20 rounded-lg bg-black border border-zinc-800 px-2 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none disabled:opacity-40"
                              />
                            </td>
                          ))}
                          <td className="p-2">
                            <button
                              type="button"
                              disabled={rowLocked || savingRowId === a.id}
                              onClick={() => handleSaveSingleRow(a)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] disabled:opacity-40 whitespace-nowrap"
                            >
                              {savingRowId === a.id ? "⏳..." : "💾 Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
