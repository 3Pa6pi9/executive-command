"use client";
import { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";

export function GroupedMetricsTab({ assets, metrics, weekOf, setWeekOf, isLocked, actorId, onSaved }: any) {
  const [platTab, setPlatTab] = useState("all");
  const [rows, setRows] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const list = assets.filter((a: any) => platTab === "all" || (a.platform || "").toLowerCase() === platTab);

  useEffect(() => {
    const m: Record<string, any> = {};
    for (const a of assets) {
      const ex = metrics.find((x: any) => x.asset_id === a.id && x.week_of === weekOf) || {};
      m[a.id] = {
        posts_published: ex.posts_published ?? "",
        impressions: ex.impressions ?? "",
        likes: ex.likes ?? "",
        total_followers: ex.total_followers ?? "",
        followers_gained: ex.followers_gained ?? "",
        followers_lost: ex.followers_lost ?? ""
      };
    }
    setRows(m);
  }, [assets, metrics, weekOf]);

  const setCell = (id: string, f: string, v: string) =>
    setRows(p => ({ ...p, [id]: { ...(p[id] || {}), [f]: v } }));

  const sum = (f: string) => list.reduce((s: number, a: any) => s + (parseInt(rows[a.id]?.[f]) || 0), 0);
  const net = sum("followers_gained") - sum("followers_lost");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return alert("Metric entry is currently locked by your Team Leader.");
    setSaving(true);
    const rList = list.map((a: any) => {
      const r = rows[a.id] || {};
      return {
        asset_id: a.id,
        week_of: weekOf,
        posts_published: parseInt(r.posts_published) || 0,
        impressions: parseInt(r.impressions) || 0,
        likes: parseInt(r.likes) || 0,
        engagements: parseInt(r.likes) || 0,
        total_followers: parseInt(r.total_followers) || 0,
        followers_gained: parseInt(r.followers_gained) || 0,
        followers_lost: parseInt(r.followers_lost) || 0
      };
    });
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId, entity: "metric", action: "bulk_upsert", payload: { rows: rList } })
    });
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={save} className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-zinc-800 pb-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {["all", ...PLATFORMS].map(p => (
            <button
              type="button"
              key={p}
              onClick={() => setPlatTab(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                platTab === p ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              {p} ({p === "all" ? assets.length : assets.filter((x: any) => (x.platform || "").toLowerCase() === p).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">Reporting Week:</span>
          <input
            type="date"
            value={weekOf}
            onChange={e => setWeekOf(e.target.value)}
            className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 font-mono text-xs">
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">TOTAL ACCOUNTS</span>
          <b className="text-base text-white">{list.length.toLocaleString()}</b>
        </div>
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span>
          <b className="text-base text-purple-400">{sum("posts_published").toLocaleString()}</b>
        </div>
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span>
          <b className="text-base text-blue-400">{sum("impressions").toLocaleString()}</b>
        </div>
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span>
          <b className="text-base text-pink-400">{sum("likes").toLocaleString()}</b>
        </div>
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">TOTAL FOLLOWERS</span>
          <b className="text-base text-white">{sum("total_followers").toLocaleString()}</b>
        </div>
        <div className="bg-black p-3 rounded-xl border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block">FOLLOWERS GAINED / LOST</span>
          <b className={`text-base ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString()}
          </b>
        </div>
      </div>

      <div className="overflow-x-auto border border-zinc-900 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase">
            <tr>
              <th className="p-2.5">Account Name & Username</th>
              <th className="p-2.5">Total Posts</th>
              <th className="p-2.5">Total Views</th>
              <th className="p-2.5">Total Likes</th>
              <th className="p-2.5">Total Followers</th>
              <th className="p-2.5">Followers Gained</th>
              <th className="p-2.5">Followers Lost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 bg-black">
            {list.map((a: any) => (
              <tr key={a.id} className="hover:bg-zinc-950/60">
                <td className="p-2.5 text-white">
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold mr-1.5">
                    {a.platform}
                  </span>
                  <b className="text-white">{a.bio || a.account_id}</b>
                  <span className="text-zinc-500 font-mono ml-1.5">({a.account_id})</span>
                </td>
                {["posts_published", "impressions", "likes", "total_followers", "followers_gained", "followers_lost"].map(f => (
                  <td key={f} className="p-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={rows[a.id]?.[f] ?? ""}
                      onChange={e => setCell(a.id, f, e.target.value)}
                      className="w-24 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono focus:border-purple-500 outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  No accounts registered under this platform tab yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={saving || isLocked || list.length === 0}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs active:scale-95 transition-all"
      >
        {saving ? "⏳ Saving Weekly Metrics..." : `Save Weekly Metrics (${list.length} Accounts)`}
      </button>
    </form>
  );
}
