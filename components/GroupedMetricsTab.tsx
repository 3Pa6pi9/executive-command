"use client";

import React, { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";

export function GroupedMetricsTab({ assets = [], metrics = [], weekOf, setWeekOf, isLocked = false, actorId, onSaved }: any) {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const [filterPlat, setFilterPlat] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const next: Record<string, any> = {};
    for (const a of safeAssets) {
      if (!a?.id) continue;
      const ex = safeMetrics.find((m: any) => m && m.asset_id === a.id && m.week_of === weekOf) || {};
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
  }, [safeAssets.length, safeMetrics.length, weekOf]);

  const updateCell = (assetId: string, field: string, val: string) => {
    setDrafts((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [field]: val }
    }));
  };

  const handleSaveAll = async () => {
    if (isLocked) return;
    setSaving(true);
    setMsg("");
    try {
      const unlockedAssets = safeAssets.filter((a: any) => a?.id && a?.status !== "locked" && !a?.is_locked);
      const rows = unlockedAssets.map((a: any) => {
        const d = drafts[a.id] || {};
        const likes = Math.max(0, Number(d.likes || 0) || 0);
        const comments = Math.max(0, Number(d.comments || 0) || 0);
        const shares = Math.max(0, Number(d.shares_reposts || 0) || 0);
        return {
          asset_id: a.id,
          week_of: weekOf || new Date().toISOString().split("T")[0],
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
      });
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, entity: "metric", action: "bulk_upsert", payload: { rows } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save weekly metrics");
      setMsg(`✓ Saved weekly performance & post rate for ${rows.length} accounts!`);
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
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-300">Account & Metric Entry Locked by Administrator</h4>
              <p className="text-[11px] text-red-200/80">Your profile or assets are currently locked for audit review. Contact your Team Leader or Admin to unlock.</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase">🔒 Locked State</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-zinc-400">Week Of:</span>
          <input
            type="date"
            value={weekOf || ""}
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
          {msg && <span className="text-xs font-bold text-emerald-400">{msg}</span>}
          <button
            type="button"
            disabled={isLocked || saving}
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs transition-all"
          >
            {saving ? "⏳ Saving..." : isLocked ? "🔒 Locked by Admin" : "💾 Save All Weekly Performance"}
          </button>
        </div>
      </div>

      {activePlatforms.length === 0 ? (
        <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-400">
          No social media assets assigned yet for this filter. Use the <b>+ Add Asset</b> tab to add an account.
        </div>
      ) : (
        activePlatforms.map((plat) => {
          const list = safeAssets.filter((a: any) => (a?.platform || "").toLowerCase() === plat);
          return (
            <div key={plat} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-4 py-3 bg-zinc-900/70 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">{plat} Accounts ({list.length})</span>
                <span className="text-[11px] text-zinc-400">Week: {weekOf}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
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
                      const rowLocked = isLocked || a.status === "locked" || a.is_locked;
                      return (
                        <tr key={a.id} className={rowLocked ? "bg-red-950/15 opacity-75" : "hover:bg-zinc-900/30"}>
                          <td className="p-3 font-medium text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{a.bio || a.account_id}</span>
                              {rowLocked ? (
                                <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-[9px] font-bold uppercase">🔒 LOCKED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase">🔓 OPEN</span>
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
