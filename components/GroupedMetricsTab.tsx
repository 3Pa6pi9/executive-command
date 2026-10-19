"use client";

import React, { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";

export function GroupedMetricsTab({ assets, metrics, weekOf, setWeekOf, isLocked, actorId, onSaved }: any) {
  const [filterPlat, setFilterPlat] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const next: Record<string, any> = {};
    for (const a of assets || []) {
      const ex = (metrics || []).find((m: any) => m.asset_id === a.id && m.week_of === weekOf) || {};
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
  }, [assets, metrics, weekOf]);

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
      const rows = (assets || []).map((a: any) => {
        const d = drafts[a.id] || {};
        const likes = Number(d.likes || 0);
        const comments = Number(d.comments || 0);
        const shares = Number(d.shares_reposts || 0);
        return {
          asset_id: a.id,
          week_of: weekOf,
          posts_published: Number(d.posts_published || 0),
          impressions: Number(d.impressions || 0),
          likes,
          comments,
          shares_reposts: shares,
          engagements: likes + comments + shares,
          total_followers: Number(d.total_followers || 0),
          followers_gained: Number(d.followers_gained || 0),
          followers_lost: Number(d.followers_lost || 0),
          top_post_impressions: Number(d.top_post_impressions || 0)
        };
      });
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, entity: "metric", action: "bulk_upsert", payload: { rows } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save metrics");
      setMsg(`✓ Saved weekly performance & post rate for ${rows.length} accounts!`);
      if (onSaved) onSaved();
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activePlatforms = PLATFORMS.filter((p) =>
    (filterPlat === "all" || filterPlat === p) &&
    (assets || []).some((a: any) => (a.platform || "").toLowerCase() === p)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-zinc-400">Week Of:</span>
          <input
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white"
          />
          <select
            value={filterPlat}
            onChange={(e) => setFilterPlat(e.target.value)}
            className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white uppercase"
          >
            <option value="all">All Platforms ({assets?.length || 0})</option>
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
            {saving ? "⏳ Saving..." : isLocked ? "🔒 Locked by Leader" : "💾 Save All Weekly Performance"}
          </button>
        </div>
      </div>

      {activePlatforms.map((plat) => {
        const list = (assets || []).filter((a: any) => (a.platform || "").toLowerCase() === plat);
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
                    <th className="p-3">Account</th>
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
                    return (
                      <tr key={a.id} className="hover:bg-zinc-900/30">
                        <td className="p-3 font-medium text-white whitespace-nowrap">
                          <div>{a.bio || a.account_id}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{a.account_id}</div>
                        </td>
                        {["posts_published", "impressions", "likes", "comments", "shares_reposts", "total_followers", "followers_gained", "followers_lost", "top_post_impressions"].map((f) => (
                          <td key={f} className="p-1.5">
                            <input
                              type="number"
                              min="0"
                              disabled={isLocked}
                              value={d[f] ?? ""}
                              onChange={(e) => updateCell(a.id, f, e.target.value)}
                              placeholder="0"
                              className="w-20 rounded-lg bg-black border border-zinc-800 px-2 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
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
    </div>
  );
}
