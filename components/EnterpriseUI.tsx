"use client";

import React, { useState, useEffect } from "react";
import { ExecutiveOverlay } from "@/components/ExecutiveOverlay";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  APP_THEMES,
  AppThemeId,
  computeLive2FACode,
  getAssetAccountName,
  recordLocalArchiveEvent,
} from "@/lib/constants";

export function ActionButton({ onClick, type = "button", disabled = false, loading = false, loadingText = "Processing...", className = "", children, title }: any) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isBusy = loading || internalLoading;

  const handleClick = async (e: any) => {
    if (isBusy || disabled) return;
    if (onClick) {
      try {
        const res = onClick(e);
        if (res && typeof res.then === "function") {
          setInternalLoading(true);
          await res;
        }
      } finally {
        setInternalLoading(false);
      }
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || isBusy}
      onClick={handleClick}
      title={title}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {isBusy && <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />}
      <span>{isBusy ? loadingText : children}</span>
    </button>
  );
}

export function usePortalTheme() {
  const [themeId, setThemeId] = useState<AppThemeId>("emerald");
  useEffect(() => {
    const saved = localStorage.getItem("portal_theme_v1") as AppThemeId;
    if (saved && APP_THEMES.some((t) => t.id === saved)) setThemeId(saved);
  }, []);
  const changeTheme = (id: AppThemeId) => {
    setThemeId(id);
    localStorage.setItem("portal_theme_v1", id);
  };
  const currentTheme = APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0];
  return { themeId, changeTheme, currentTheme };
}

export function ThemePickerDropdown({ themeId, onChange }: { themeId: AppThemeId; onChange: (id: AppThemeId) => void }) {
  return (
    <select
      value={themeId}
      onChange={(e) => onChange(e.target.value as AppThemeId)}
      className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 font-bold outline-none cursor-pointer"
    >
      {APP_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

export function GroupedWeeklyMetricsForm({ actorId, assets, allMetrics, isLocked, onSaved, onInspectAsset }: any) {
  const [platformTab, setPlatformTab] = useState<string>("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");
  const [weekOf, setWeekOf] = useState(new Date().toISOString().split("T")[0]);
  const [rowsState, setRowsState] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const platformAssets = assets.filter((a: any) => platformTab === "all" || a.platform === platformTab);
  const displayedAssets = selectedAccountFilter === "all" ? platformAssets : platformAssets.filter((a: any) => a.id === selectedAccountFilter);

  useEffect(() => {
    const nextMap: Record<string, any> = {};
    for (const a of assets) {
      const existing = allMetrics.find((m: any) => m.asset_id === a.id && m.week_of === weekOf);
      const latestAny = allMetrics.filter((m: any) => m.asset_id === a.id).sort((x: any, y: any) => (y.week_of || "").localeCompare(x.week_of || ""))[0];
      nextMap[a.id] = {
        posts_published: existing?.posts_published ?? "",
        impressions: existing?.impressions ?? "",
        likes: existing?.likes ?? "",
        total_followers: existing?.total_followers ?? latestAny?.total_followers ?? "",
        followers_gained: existing?.followers_gained ?? "",
        followers_lost: existing?.followers_lost ?? "",
      };
    }
    setRowsState(nextMap);
  }, [assets, allMetrics, weekOf]);

  const updateCell = (assetId: string, field: string, val: string) => {
    setRowsState((prev) => ({ ...prev, [assetId]: { ...(prev[assetId] || {}), [field]: val } }));
  };

  const totalAccounts = displayedAssets.length;
  const totalPosts = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.posts_published) || 0), 0);
  const totalViews = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.impressions) || 0), 0);
  const totalLikes = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.likes) || 0), 0);
  const totalFollowers = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.total_followers) || 0), 0);
  const totalGained = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.followers_gained) || 0), 0);
  const totalLost = displayedAssets.reduce((s: number, a: any) => s + (parseInt(rowsState[a.id]?.followers_lost) || 0), 0);
  const netFollowers = totalGained - totalLost;

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return alert("Metric submissions are locked by your Team Leader.");
    if (!displayedAssets.length) return alert("No accounts in this tab.");
    setSubmitting(true);
    const payloadRows = displayedAssets.map((a: any) => {
      const st = rowsState[a.id] || {};
      const views = parseInt(st.impressions) || 0, likes = parseInt(st.likes) || 0;
      return {
        asset_id: a.id, week_of: weekOf,
        posts_published: parseInt(st.posts_published) || 0,
        impressions: views, likes, engagements: likes,
        shares_reposts: 0, comments: 0,
        total_followers: parseInt(st.total_followers) || 0,
        followers_gained: parseInt(st.followers_gained) || 0,
        followers_lost: parseInt(st.followers_lost) || 0,
        top_post_impressions: 0,
      };
    });
    const res = await fetch("/api/crud", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId, entity: "metric", action: "batch_upsert", payload: { rows: payloadRows } }),
    });
    setSubmitting(false);
    if (res.ok) {
      recordLocalArchiveEvent({ actor_name: "Handler", actor_role: "smm", action: "UPSERT", entity_type: "METRIC", summary: `Submitted weekly metrics (${weekOf}) for ${payloadRows.length} accounts`, record_snapshot: { weekOf, totalAccounts, totalPosts, totalViews, totalLikes, totalFollowers } });
      await onSaved(`Saved weekly metrics for ${payloadRows.length} account(s) (${weekOf}).`);
    }
  };

  return (
    <form onSubmit={handleBatchSubmit} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Weekly Metrics Submission Form</h2>
          <p className="text-xs text-zinc-400">Enter weekly metrics for all grouped accounts in a single form.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedAccountFilter} onChange={(e) => setSelectedAccountFilter(e.target.value)} className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white min-w-[210px]">
            <option value="all">All Accounts in Tab ({platformAssets.length})</option>
            {platformAssets.map((a: any) => <option key={a.id} value={a.id}>{getAssetAccountName(a)} ({a.account_id}) — {a.platform.toUpperCase()}</option>)}
          </select>
          <input type="date" required value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["all", ...PLATFORMS].map((plat) => (
          <button key={plat} type="button" onClick={() => { setPlatformTab(plat); setSelectedAccountFilter("all"); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase border cursor-pointer ${platformTab === plat ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>
            {plat === "all" ? `All Platforms (${assets.length})` : `${plat} (${assets.filter((a: any) => a.platform === plat).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-black border border-zinc-800 p-4 rounded-2xl font-mono">
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Total Accounts</span><span className="text-lg font-bold text-white">{totalAccounts}</span></div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Total Posts</span><span className="text-lg font-bold text-amber-400">{totalPosts.toLocaleString()}</span></div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Total Views</span><span className="text-lg font-bold text-blue-400">{totalViews.toLocaleString()}</span></div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Total Likes</span><span className="text-lg font-bold text-purple-400">{totalLikes.toLocaleString()}</span></div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Total Followers</span><span className="text-lg font-bold text-emerald-400">{totalFollowers.toLocaleString()}</span></div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900"><span className="text-[10px] text-zinc-500 block uppercase">Gained / Lost</span><span className="text-sm font-bold text-emerald-400">+{totalGained} / <span className="text-red-400">-{totalLost}</span> ({netFollowers >= 0 ? `+${netFollowers}` : netFollowers})</span></div>
      </div>

      <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
        <table className="w-full text-left text-xs text-zinc-200">
          <thead className="bg-zinc-900 text-zinc-400 uppercase font-mono text-[10px]">
            <tr><th className="p-3">Account Name & Username</th><th className="p-3">Total Posts</th><th className="p-3">Total Views</th><th className="p-3">Total Likes</th><th className="p-3">Total Followers</th><th className="p-3">Followers Gained</th><th className="p-3">Followers Lost</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-black">
            {displayedAssets.map((asset: any) => {
              const row = rowsState[asset.id] || {};
              return (
                <tr key={asset.id}>
                  <td className="p-3">
                    <button type="button" onClick={() => onInspectAsset && onInspectAsset(asset)} className="font-bold text-white hover:text-purple-300 text-left">[{asset.platform.toUpperCase()}] {getAssetAccountName(asset)}</button>
                    <div className="text-[11px] text-zinc-500 font-mono">{asset.account_id}</div>
                  </td>
                  <td className="p-2"><input type="number" min="0" placeholder="Posts" value={row.posts_published ?? ""} onChange={(e) => updateCell(asset.id, "posts_published", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white font-mono" /></td>
                  <td className="p-2"><input type="number" min="0" placeholder="Views" value={row.impressions ?? ""} onChange={(e) => updateCell(asset.id, "impressions", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-blue-300 font-mono" /></td>
                  <td className="p-2"><input type="number" min="0" placeholder="Likes" value={row.likes ?? ""} onChange={(e) => updateCell(asset.id, "likes", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-purple-300 font-mono" /></td>
                  <td className="p-2"><input type="number" min="0" placeholder="Followers" value={row.total_followers ?? ""} onChange={(e) => updateCell(asset.id, "total_followers", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-emerald-300 font-mono" /></td>
                  <td className="p-2"><input type="number" min="0" placeholder="+ Gained" value={row.followers_gained ?? ""} onChange={(e) => updateCell(asset.id, "followers_gained", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-emerald-400 font-mono" /></td>
                  <td className="p-2"><input type="number" min="0" placeholder="- Lost" value={row.followers_lost ?? ""} onChange={(e) => updateCell(asset.id, "followers_lost", e.target.value)} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-red-400 font-mono" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ActionButton type="submit" loading={submitting} loadingText="Saving Weekly Metrics..." disabled={isLocked || !displayedAssets.length} className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs">
        {isLocked ? "Metric Submissions Locked by Team Leader" : `Save Weekly Metrics (${displayedAssets.length} Accounts)`}
      </ActionButton>
    </form>
  );
}

export function FancyMultiSelect({ label, options, selected, onChange }: any) {
  const [open, setOpen] = useState(false);
  const toggle = (item: string) => onChange(selected.includes(item) ? selected.filter((x: string) => x !== item) : [...selected, item]);
  return (
    <div className="relative inline-flex items-center gap-2" data-exec-admin-overlay="1"><ExecutiveOverlay />
      <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{label} ({selected.length})</label>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center">
        <span className="truncate">{selected.length > 0 ? selected.join(", ") : "Select options..."}</span>
        <span className="text-zinc-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {options.map((opt: string) => (
            <button key={opt} type="button" onClick={() => toggle(opt)} className={`text-left px-2.5 py-2 rounded-lg text-[11px] font-bold truncate border ${selected.includes(opt) ? "bg-purple-600/30 border-purple-500 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>
              {selected.includes(opt) ? "✓ " : ""}{opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FancyEntityMultiSelect({ label, items, selectedIds, onChange }: any) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((x: string) => x !== id) : [...selectedIds, id]);
  const selectedLabels = items.filter((it: any) => selectedIds.includes(it.id));
  return (
    <div className="relative inline-flex items-center gap-2" data-exec-admin-overlay="1"><ExecutiveOverlay />
      <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{label} ({selectedIds.length})</label>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center">
        <span className="truncate">{selectedLabels.length > 0 ? selectedLabels.map((i: any) => i.label).join(", ") : "Select items..."}</span>
        <span className="text-zinc-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {items.map((it: any) => (
            <button key={it.id} type="button" onClick={() => toggle(it.id)} className={`text-left px-3 py-2 rounded-lg text-xs border ${selectedIds.includes(it.id) ? "bg-blue-600/30 border-blue-500 text-white font-bold" : "bg-black border-zinc-800 text-zinc-400"}`}>
              <div className="truncate">{selectedIds.includes(it.id) ? "✓ " : ""}{it.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThreePaneCommandMatrix({ teamLeaders = [], smms = [], assets = [], metrics = [], onSelectTl, onSelectSmm, onSelectAsset, onEditAsset, onToggleAssetStatus, onToggleSmmLock }: any) {
  const [activeTlId, setActiveTlId] = useState<string>(teamLeaders[0]?.id || "all");
  const [activeSmmId, setActiveSmmId] = useState<string>("all");
  const paneSmms = activeTlId === "all" ? smms : smms.filter((s: any) => s.team_leader_id === activeTlId || (s.team_leader_ids && s.team_leader_ids.includes(activeTlId)));
  const paneAssets = assets.filter((a: any) => activeSmmId !== "all" ? a.smm_id === activeSmmId : activeTlId !== "all" ? a.team_leader_id === activeTlId || paneSmms.some((s: any) => s.id === a.smm_id) : true);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-zinc-950/90 border border-zinc-800 rounded-3xl p-4">
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-zinc-800 pr-0 lg:pr-3 space-y-2 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center px-2 py-1"><span className="text-[10px] uppercase font-bold text-emerald-400">Team Leaders ({teamLeaders.length})</span><button type="button" onClick={() => { setActiveTlId("all"); setActiveSmmId("all"); }} className="text-[10px] text-zinc-400">All</button></div>
        {teamLeaders.map((tl: any) => (
          <div key={tl.id} onClick={() => { setActiveTlId(tl.id); setActiveSmmId("all"); }} className={`cursor-pointer p-3 rounded-2xl border flex justify-between items-center ${activeTlId === tl.id ? "bg-emerald-500/20 border-emerald-400 text-white" : "bg-black border-zinc-900 text-zinc-300"}`}>
            <div className="truncate"><div className="font-bold text-xs">{tl.full_name}</div><div className="text-[10px] text-zinc-500">{tl.country}</div></div>
            {onSelectTl && <button type="button" onClick={(e) => { e.stopPropagation(); onSelectTl(tl); }} className="px-2 py-1 rounded bg-zinc-900 text-[10px] text-emerald-300 font-bold">Details</button>}
          </div>
        ))}
      </div>
      <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-zinc-800 pr-0 lg:pr-3 space-y-2 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between items-center px-2 py-1"><span className="text-[10px] uppercase font-bold text-blue-400">SMM Handlers ({paneSmms.length})</span><button type="button" onClick={() => setActiveSmmId("all")} className="text-[10px] text-zinc-400">All</button></div>
        {paneSmms.map((smm: any) => (
          <div key={smm.id} onClick={() => setActiveSmmId(smm.id)} className={`cursor-pointer p-3 rounded-2xl border flex justify-between items-center gap-2 ${activeSmmId === smm.id ? "bg-blue-500/20 border-blue-400 text-white" : "bg-black border-zinc-900 text-zinc-300"}`}>
            <div className="truncate"><div className="font-bold text-xs">{smm.full_name}</div><div className="text-[10px] text-zinc-500">{smm.country}</div></div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onToggleSmmLock && <ActionButton onClick={() => onToggleSmmLock(smm)} loadingText="..." className="px-2 py-1 rounded bg-zinc-900 text-[10px] font-bold">{smm.is_locked ? "Locked" : "Open"}</ActionButton>}
              {onSelectSmm && <button type="button" onClick={() => onSelectSmm(smm)} className="px-2 py-1 rounded bg-zinc-900 text-[10px] text-blue-300 font-bold">Details</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-5 space-y-2 max-h-[70vh] overflow-y-auto">
        <div className="px-2 py-1"><span className="text-[10px] uppercase font-bold text-purple-400">Accounts ({paneAssets.length})</span></div>
        {paneAssets.map((asset: any) => {
          const isSusp = asset.status === "suspended";
          const views = metrics.filter((m: any) => m.asset_id === asset.id).reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);
          return (
            <div key={asset.id} onClick={() => onSelectAsset(asset)} className="cursor-pointer p-3.5 rounded-2xl bg-black border border-zinc-900 hover:border-purple-500/50 flex justify-between items-center gap-3">
              <div className="truncate"><div className="font-bold text-xs text-white truncate">[{asset.platform?.toUpperCase()}] {getAssetAccountName(asset)}</div><div className="text-[11px] text-zinc-500 font-mono">{asset.account_id} • {views.toLocaleString()} Views</div></div>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <ActionButton onClick={() => onToggleAssetStatus(asset, isSusp ? "active" : "suspended")} loadingText="..." className="px-2 py-1 rounded bg-zinc-900 text-[10px] font-bold">{isSusp ? "Suspended" : "Active"}</ActionButton>
                <button type="button" onClick={() => onEditAsset(asset)} className="px-2.5 py-1 rounded bg-zinc-900 text-[10px] text-emerald-300 font-bold">Edit</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SMMSpotlightModal({ smm, tlName, assets, metrics, onClose, onSelectAsset, onEditAsset, onToggleAssetStatus, onEditSmm, onToggleSmmLock }: any) {
  const smmAssets = assets.filter((a: any) => a.smm_id === smm.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl bg-zinc-950 border border-blue-500/50 rounded-3xl p-5 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div><span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase">SMM Handler {tlName ? `• TL: ${tlName}` : ""}</span><h2 className="text-2xl font-bold text-white mt-2">{smm.full_name}</h2></div>
          <div className="flex items-center gap-2">
            {onToggleSmmLock && <ActionButton onClick={() => onToggleSmmLock(smm)} loadingText="..." className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold">{smm.is_locked ? "Unlock SMM" : "Lock SMM"}</ActionButton>}
            {onEditSmm && <button type="button" onClick={() => onEditSmm(smm)} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold">Edit SMM</button>}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {smmAssets.map((asset: any) => {
            const isSuspended = asset.status === "suspended";
            return (
              <div key={asset.id} onClick={() => onSelectAsset(asset)} className="cursor-pointer rounded-2xl p-4 bg-black border border-zinc-800 hover:border-purple-400 space-y-2 relative">
                <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                  <ActionButton onClick={() => onToggleAssetStatus(asset, isSuspended ? "active" : "suspended")} loadingText="..." className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-900 text-zinc-200">{isSuspended ? "Suspended" : "Active"}</ActionButton>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                <h4 className="font-bold text-white truncate pr-20">{getAssetAccountName(asset)}</h4>
                <p className="text-[11px] text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>
                <div className="grid grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onSelectAsset(asset)} className="py-1.5 bg-purple-600/25 text-purple-200 rounded-xl text-[11px] font-bold">View Details</button>
                  <button type="button" onClick={() => onEditAsset(asset)} className="py-1.5 bg-zinc-900 text-emerald-400 rounded-xl text-[11px] font-bold">Edit Account</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TeamLeaderSpotlightModal({ tl, smms, assets, onClose, onSelectSmm, onEditTl, onEditSmm, onToggleSmmLock }: any) {
  const tlSmms = smms.filter((s: any) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl bg-zinc-950 border border-emerald-500/50 rounded-3xl p-5 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div><span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">Team Leader Details</span><h2 className="text-2xl font-bold text-white mt-2">{tl.full_name}</h2></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEditTl(tl)} className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold">Edit Team Leader</button>
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tlSmms.map((smm: any) => (
            <div key={smm.id} onClick={() => onSelectSmm(smm)} className="cursor-pointer rounded-2xl p-5 bg-black border border-zinc-800 hover:border-blue-400 space-y-3">
              <div className="flex justify-between items-start">
                <div><h4 className="font-bold text-white text-lg">{smm.full_name}</h4><p className="text-xs text-zinc-400">{smm.country}</p></div>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">{assets.filter((a: any) => a.smm_id === smm.id).length} Accounts</span>
              </div>
              <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => onSelectSmm(smm)} className="flex-1 py-2 bg-blue-600/20 text-blue-300 rounded-xl text-xs font-bold">View Details</button>
                <ActionButton onClick={() => onToggleSmmLock(smm)} loadingText="..." className="px-2.5 py-2 rounded-xl text-xs font-bold border border-zinc-700">{smm.is_locked ? "Locked" : "Open"}</ActionButton>
                <button type="button" onClick={() => onEditSmm(smm)} className="px-2.5 py-2 rounded-xl bg-zinc-900 text-zinc-200 text-xs font-bold">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UniversalAssetEditModal({ asset, teamLeaders = [], smms = [], canReassignSmm = false, onClose, onSave, onDelete }: any) {
  const [form, setForm] = useState<any>({ ...asset, platform: asset.platform || "twitter", status: asset.status || "active", country_language: asset.country_language || "Kenya", language: asset.language || "English", account_name: getAssetAccountName(asset), account_id: asset.account_id || "", account_password: asset.account_password || "", profile_link: asset.profile_link || "", bio: asset.bio || "", email: asset.email || "", email_password: asset.email_password || "", two_fa_code: asset.two_fa_code || "", phone_number: asset.phone_number || "", team_leader_id: asset.team_leader_id || "", smm_id: asset.smm_id || "" });
  const [saving, setSaving] = useState(false);
  const isTwitter = form.platform === "twitter", isFacebook = form.platform === "facebook";
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); await onSave({ ...form, project_name: form.account_name || form.account_id }); setSaving(false); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-zinc-950 border border-emerald-500/60 rounded-3xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><h3 className="text-lg font-bold text-white">Edit Account — {form.account_name}</h3><button type="button" onClick={onClose} className="px-3 py-1.5 bg-zinc-900 text-xs text-zinc-300 rounded-xl font-bold">Close</button></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">{PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-bold"><option value="active">ACTIVE</option><option value="suspended">SUSPENDED</option></select>
          <select value={form.country_language} onChange={(e) => setForm({ ...form, country_language: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">{ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">{ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="text" required value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Account Name" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          <input type="text" required value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} placeholder={isTwitter ? "Username" : "Username / Handle"} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
          <input type="text" value={form.account_password} onChange={(e) => setForm({ ...form, account_password: e.target.value })} placeholder="Account Password" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={isFacebook ? "Email / Phone Number" : "Email"} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          <input type="text" value={form.email_password} onChange={(e) => setForm({ ...form, email_password: e.target.value })} placeholder="Email Password" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono" />
          <input type="url" value={form.profile_link} onChange={(e) => setForm({ ...form, profile_link: e.target.value })} placeholder="Profile Link" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-blue-300" />
          <input type="text" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Bio" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          <input type="text" value={form.two_fa_code} onChange={(e) => setForm({ ...form, two_fa_code: e.target.value })} placeholder="2FA Code" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-amber-300 font-mono" />
          {!isFacebook && <input type="text" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="Phone Number" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={form.team_leader_id || ""} onChange={(e) => setForm({ ...form, team_leader_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"><option value="">Select Team Leader</option>{teamLeaders.map((tl: any) => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}</select>
          {canReassignSmm && <select value={form.smm_id || ""} onChange={(e) => setForm({ ...form, smm_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"><option value="">Unassigned SMM</option>{smms.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>}
        </div>
        <div className="flex gap-2 pt-2">
          <ActionButton type="submit" loading={saving} loadingText="Saving..." className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs">Save Account Changes</ActionButton>
          {onDelete && <ActionButton onClick={() => onDelete(asset.id)} loadingText="Deleting..." className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs">Delete Account</ActionButton>}
        </div>
      </form>
    </div>
  );
}

export function AssetGrowthModal({ asset, metrics, profiles = [], onClose, onEdit, onToggleStatus }: any) {
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [live2fa, setLive2fa] = useState("------");
  useEffect(() => { if (asset?.two_fa_code) computeLive2FACode(asset.two_fa_code).then(setLive2fa); }, [asset]);
  const assetMetrics = metrics.filter((m: any) => m.asset_id === asset.id).sort((a: any, b: any) => (a.week_of || "").localeCompare(b.week_of || ""));
  const latest = assetMetrics[assetMetrics.length - 1] || {};
  const totalImpr = assetMetrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);
  const totalLikes = assetMetrics.reduce((s: number, m: any) => s + Number(m.likes || 0), 0);
  const totalPosts = assetMetrics.reduce((s: number, m: any) => s + Number(m.posts_published || 0), 0);
  const ownerSmm = profiles.find((p: any) => p.id === asset.smm_id);
  const isSuspended = asset.status === "suspended";
  const accName = getAssetAccountName(asset);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-4xl bg-zinc-950 border border-purple-500/60 rounded-3xl p-4 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
          <div><span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 font-bold text-[10px] uppercase">{asset.platform} • {asset.country_language}</span><h2 className="text-xl font-bold text-white mt-2">{accName} ({asset.account_id})</h2></div>
          <div className="flex items-center gap-2">
            {onToggleStatus && <ActionButton onClick={() => onToggleStatus(asset, isSuspended ? "active" : "suspended")} loadingText="..." className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold">{isSuspended ? "Suspended" : "Active"}</ActionButton>}
            <button type="button" onClick={() => setRevealSecrets(!revealSecrets)} className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-amber-300 font-bold">{revealSecrets ? "Hide Credentials" : "Show Credentials"}</button>
            {onEdit && <button type="button" onClick={() => { onClose(); onEdit(asset); }} className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold">Edit Account</button>}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
          <div className="bg-black p-3 rounded-2xl border border-zinc-900"><span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span><span className="text-lg font-bold text-amber-400">{totalPosts.toLocaleString()}</span></div>
          <div className="bg-black p-3 rounded-2xl border border-zinc-900"><span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span><span className="text-lg font-bold text-blue-400">{totalImpr.toLocaleString()}</span></div>
          <div className="bg-black p-3 rounded-2xl border border-zinc-900"><span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span><span className="text-lg font-bold text-purple-400">{totalLikes.toLocaleString()}</span></div>
          <div className="bg-black p-3 rounded-2xl border border-zinc-900"><span className="text-[10px] text-zinc-500 block">TOTAL FOLLOWERS</span><span className="text-lg font-bold text-white">{(latest.total_followers || 0).toLocaleString()}</span></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono bg-black border border-zinc-800 p-4 rounded-2xl">
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">ACCOUNT NAME</span><span className="text-white font-bold">{accName}</span></div>
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">USERNAME</span><span className="text-white font-bold">{asset.account_id}</span></div>
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">PASSWORD</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px]"}>{asset.account_password || "N/A"}</span></div>
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">{asset.platform === "facebook" ? "EMAIL / PHONE" : "EMAIL"}</span><span className="text-zinc-200">{asset.email || "N/A"}</span></div>
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">EMAIL PASSWORD</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px]"}>{asset.email_password || "N/A"}</span></div>
          <div className="bg-zinc-950 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">2FA / HANDLER</span><span className="text-amber-300">{asset.two_fa_code ? live2fa : "None"} • {ownerSmm?.full_name || "Unassigned"}</span></div>
        </div>
      </div>
    </div>
  );
}

export function ExecutiveAnalyticsGraphs({ assets, metrics, profiles = [], onSelectTl, onSelectSmm }: any) {
  const assetIdSet = new Set(assets.map((a: any) => a.id));
  const scopedMetrics = metrics.filter((m: any) => assetIdSet.has(m.asset_id));
  const getLatestFollowers = (list: any[]) => list.reduce((sum, a) => {
    const aLogs = scopedMetrics.filter((m: any) => m.asset_id === a.id).sort((x: any, y: any) => (y.week_of || "").localeCompare(x.week_of || ""));
    return sum + Number(aLogs[0]?.total_followers || 0);
  }, 0);

  const totalAccounts = assets.length;
  const totalPosts = scopedMetrics.reduce((s: number, m: any) => s + Number(m.posts_published || 0), 0);
  const totalViews = scopedMetrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);
  const totalLikes = scopedMetrics.reduce((s: number, m: any) => s + Number(m.likes || 0), 0);
  const totalFollowers = getLatestFollowers(assets);
  const totalGained = scopedMetrics.reduce((s: number, m: any) => s + Number(m.followers_gained || 0), 0);
  const totalLost = scopedMetrics.reduce((s: number, m: any) => s + Number(m.followers_lost || 0), 0);

  const tls = profiles.filter((p: any) => p.role === "team_leader");
  const smms = profiles.filter((p: any) => p.role === "smm");

  const tlLeaderboard = tls.map((tl: any) => {
    const squadSmms = smms.filter((s: any) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
    const squadSmmIds = new Set(squadSmms.map((s: any) => s.id));
    const squadAssets = assets.filter((a: any) => a.team_leader_id === tl.id || squadSmmIds.has(a.smm_id));
    const squadAssetIds = new Set(squadAssets.map((a: any) => a.id));
    const logs = scopedMetrics.filter((m: any) => squadAssetIds.has(m.asset_id));
    return {
      tl, accountCount: squadAssets.length,
      posts: logs.reduce((s: number, m: any) => s + Number(m.posts_published || 0), 0),
      views: logs.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0),
      likes: logs.reduce((s: number, m: any) => s + Number(m.likes || 0), 0),
      followers: getLatestFollowers(squadAssets),
      gained: logs.reduce((s: number, m: any) => s + Number(m.followers_gained || 0), 0),
      lost: logs.reduce((s: number, m: any) => s + Number(m.followers_lost || 0), 0),
    };
  }).sort((a: any, b: any) => b.views - a.views || b.followers - a.followers);

  const smmLeaderboard = smms.map((smm: any) => {
    const myAssets = assets.filter((a: any) => a.smm_id === smm.id);
    const myAssetIds = new Set(myAssets.map((a: any) => a.id));
    const logs = scopedMetrics.filter((m: any) => myAssetIds.has(m.asset_id));
    const tl = tls.find((t: any) => t.id === smm.team_leader_id);
    return {
      smm, tlName: tl?.full_name || "Unassigned", accountCount: myAssets.length,
      posts: logs.reduce((s: number, m: any) => s + Number(m.posts_published || 0), 0),
      views: logs.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0),
      likes: logs.reduce((s: number, m: any) => s + Number(m.likes || 0), 0),
      followers: getLatestFollowers(myAssets),
      gained: logs.reduce((s: number, m: any) => s + Number(m.followers_gained || 0), 0),
      lost: logs.reduce((s: number, m: any) => s + Number(m.followers_lost || 0), 0),
    };
  }).sort((a: any, b: any) => b.views - a.views || b.followers - a.followers);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL ACCOUNTS</span><span className="text-xl font-bold text-white">{totalAccounts}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span><span className="text-xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span><span className="text-xl font-bold text-blue-400">{totalViews.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span><span className="text-xl font-bold text-purple-400">{totalLikes.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL FOLLOWERS</span><span className="text-xl font-bold text-emerald-400">{totalFollowers.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">GAINED / LOST</span><span className="text-sm font-bold text-emerald-400">+{totalGained} / <span className="text-red-400">-{totalLost}</span></span></div>
      </div>

      {tlLeaderboard.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3 overflow-x-auto">
          <h3 className="text-base font-bold text-white">Team Leader Performance Leaderboard</h3>
          <table className="w-full text-left text-xs font-mono text-zinc-300">
            <thead className="bg-zinc-900 text-zinc-400 uppercase">
              <tr><th className="p-3">Team Leader</th><th className="p-3">Total Accounts</th><th className="p-3">Total Posts</th><th className="p-3">Total Views</th><th className="p-3">Total Likes</th><th className="p-3">Total Followers</th><th className="p-3">Gained / Lost</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {tlLeaderboard.map((r: any, i: number) => (
                <tr key={r.tl.id} onClick={() => onSelectTl && onSelectTl(r.tl)} className="hover:bg-zinc-900/60 cursor-pointer">
                  <td className="p-3 font-bold text-white">#{i + 1} {r.tl.full_name}</td><td className="p-3">{r.accountCount}</td><td className="p-3 text-amber-300">{r.posts.toLocaleString()}</td><td className="p-3 text-blue-400 font-bold">{r.views.toLocaleString()}</td><td className="p-3 text-purple-300">{r.likes.toLocaleString()}</td><td className="p-3 text-emerald-400 font-bold">{r.followers.toLocaleString()}</td><td className="p-3"><span className="text-emerald-400">+{r.gained}</span> / <span className="text-red-400">-{r.lost}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {smmLeaderboard.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3 overflow-x-auto">
          <h3 className="text-base font-bold text-white">SMM Handler Performance Leaderboard</h3>
          <table className="w-full text-left text-xs font-mono text-zinc-300">
            <thead className="bg-zinc-900 text-zinc-400 uppercase">
              <tr><th className="p-3">SMM Handler</th><th className="p-3">Team Leader</th><th className="p-3">Total Accounts</th><th className="p-3">Total Posts</th><th className="p-3">Total Views</th><th className="p-3">Total Likes</th><th className="p-3">Total Followers</th><th className="p-3">Gained / Lost</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {smmLeaderboard.map((r: any, i: number) => (
                <tr key={r.smm.id} onClick={() => onSelectSmm && onSelectSmm(r.smm)} className="hover:bg-zinc-900/60 cursor-pointer">
                  <td className="p-3 font-bold text-white">#{i + 1} {r.smm.full_name}</td><td className="p-3 text-emerald-300">{r.tlName}</td><td className="p-3">{r.accountCount}</td><td className="p-3 text-amber-300">{r.posts.toLocaleString()}</td><td className="p-3 text-blue-400 font-bold">{r.views.toLocaleString()}</td><td className="p-3 text-purple-300">{r.likes.toLocaleString()}</td><td className="p-3 text-emerald-400 font-bold">{r.followers.toLocaleString()}</td><td className="p-3"><span className="text-emerald-400">+{r.gained}</span> / <span className="text-red-400">-{r.lost}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ForensicArchiveVault({ logs, onRestore }: any) {
  const [search, setSearch] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const filtered = (logs || []).filter((l: any) => {
    if (startDateTime && new Date(l.created_at || Date.now()).getTime() < new Date(startDateTime).getTime()) return false;
    if (endDateTime && new Date(l.created_at || Date.now()).getTime() > new Date(endDateTime).getTime()) return false;
    if (search.trim()) return `${l.actor_name || ""} ${l.summary || ""} ${l.action || ""}`.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const exportArchivesCSV = () => {
    const headers = ["Timestamp", "User", "Role", "Category", "Action", "Summary"];
    const rows = filtered.map((l: any) => [`"${l.created_at || ""}"`, `"${l.actor_name || ""}"`, `"${l.actor_role || ""}"`, `"${l.entity_type || ""}"`, `"${l.action || ""}"`, `"${(l.summary || "").replace(/"/g, '""')}"`].join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Archives_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-3">
        <h2 className="text-xl font-bold text-white">Archives ({filtered.length} Records)</h2>
        <ActionButton onClick={exportArchivesCSV} loadingText="Exporting..." className="px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-xs">Export Archives CSV</ActionButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black border border-zinc-800 p-3 rounded-2xl">
        <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search archives..." className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filtered.map((log: any) => (
          <div key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer rounded-2xl border border-zinc-800 bg-black p-3.5 flex flex-wrap justify-between items-center gap-2 hover:border-amber-500/50">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">{log.entity_type} • {log.action}</span>
              <span className="text-xs font-bold text-white">{log.summary}</span>
            </div>
            <span className="text-xs font-mono text-zinc-400">{log.actor_name} • {log.created_at ? new Date(log.created_at).toLocaleString() : "Recent"}</span>
          </div>
        ))}
      </div>
      {selectedLog && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4" onClick={() => setSelectedLog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-zinc-950 border border-amber-500/60 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white">{selectedLog.summary}</h3>
              <div className="flex gap-2">
                <ActionButton onClick={async () => { await onRestore(selectedLog); setSelectedLog(null); }} loadingText="Restoring..." className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold">Restore Record</ActionButton>
                <button type="button" onClick={() => setSelectedLog(null)} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
              </div>
            </div>
            <pre className="p-4 bg-black rounded-2xl border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto max-h-80">{JSON.stringify(selectedLog.record_snapshot || {}, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function CampaignDispatchWizard({ actorId, teamLeaders, smms, defaultTlId, onSuccess }: any) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [targetMode, setTargetMode] = useState<"tl" | "smm">("tl");
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>(defaultTlId ? [defaultTlId] : []);
  const [selectedSmmIds, setSelectedSmmIds] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [direction, setDirection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/crud", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId, entity: "campaign", action: "dispatch", payload: { platforms: selectedPlatforms, targetMode, targetTlIds: selectedTlIds, targetSmmIds: selectedSmmIds, topic: topic.trim(), direction: direction.trim() } }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { setTopic(""); setDirection(""); onSuccess(`Assigned campaign "${topic}" to ${data.count} matching accounts.`); }
  };

  return (
    <form onSubmit={handleDispatch} className="max-w-3xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-3xl p-6 space-y-5">
      <h2 className="text-xl font-bold text-white">Assign Campaign</h2>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {PLATFORMS.map((p) => <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2 rounded-xl text-xs font-bold uppercase border ${selectedPlatforms.includes(p) ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{p}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setTargetMode("tl")} className={`py-2.5 rounded-xl text-xs font-bold border ${targetMode === "tl" ? "bg-blue-600 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>Assign to Team Leaders</button>
        <button type="button" onClick={() => setTargetMode("smm")} className={`py-2.5 rounded-xl text-xs font-bold border ${targetMode === "smm" ? "bg-purple-600 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>Assign to SMMs</button>
      </div>
      {targetMode === "tl" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{teamLeaders.map((tl: any) => <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`p-2.5 rounded-xl border text-left text-xs font-bold ${selectedTlIds.includes(tl.id) ? "bg-blue-600/30 border-blue-400 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>✓ {tl.full_name}</button>)}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{smms.map((s: any) => <button type="button" key={s.id} onClick={() => toggleItem(s.id, selectedSmmIds, setSelectedSmmIds)} className={`p-2.5 rounded-xl border text-left text-xs font-bold ${selectedSmmIds.includes(s.id) ? "bg-purple-600/30 border-purple-400 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>✓ {s.full_name}</button>)}</div>
      )}
      <input type="text" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign Topic" className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
      <textarea rows={3} required value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Direction, Key Points & Objectives..." className="w-full rounded-xl bg-black border border-zinc-800 p-3 text-xs text-white" />
      <ActionButton type="submit" loading={submitting} loadingText="Assigning Campaign..." className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl text-xs">Assign Campaign</ActionButton>
    </form>
  );
}

export function useRealtimePresence(supabaseClient: any, profile: any) {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabaseClient.channel("executive-presence-room", { config: { presence: { key: profile.id } } });
    const syncState = () => {
      const state = channel.presenceState();
      const list: any[] = [];
      const ids = new Set<string>();
      Object.entries(state).forEach(([key, presences]: [string, any]) => {
        if (Array.isArray(presences) && presences.length > 0) { ids.add(key); list.push(presences[0]); }
      });
      setOnlineUsers(list); setOnlineIds(ids);
    };
    channel.on("presence", { event: "sync" }, syncState).subscribe(async (st: string) => {
      if (st === "SUBSCRIBED") await channel.track({ id: profile.id, full_name: profile.full_name || "User", role: profile.role || "smm", country: profile.country || "Global" });
    });
    return () => { supabaseClient.removeChannel(channel); };
  }, [supabaseClient, profile?.id, profile?.full_name, profile?.role, profile?.country]);
  return { onlineUsers, onlineIds };
}

export function LiveOnlineRosterPill({ onlineUsers }: any) {
  const isAdminPortalView = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (!isAdminPortalView) return <ExecutiveOverlay />;
  return (
    <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
      <span>{onlineUsers.length} Online</span>
    </span>
  );
}

export function GlobalCommandPalette({ profiles = [], assets = [], onSelectTl, onSelectSmm, onSelectAsset }: any) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const clean = q.toLowerCase().trim();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">Search</button>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center pt-16 bg-black/85 backdrop-blur-2xl p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-zinc-950 border border-zinc-700 rounded-3xl p-5 space-y-3">
            <input type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Team Leaders, SMMs, or Accounts..." className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none" />
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {profiles.filter((p: any) => !clean || (p.full_name || "").toLowerCase().includes(clean)).slice(0, 6).map((p: any) => (
                <div key={p.id} onClick={() => { setOpen(false); if (p.role === "team_leader") onSelectTl(p); else onSelectSmm(p); }} className="cursor-pointer p-2.5 rounded-xl bg-black border border-zinc-900 flex justify-between text-xs text-white">
                  <span>{p.full_name} ({p.role})</span><span className="text-zinc-400">{p.country}</span>
                </div>
              ))}
              {assets.filter((a: any) => !clean || getAssetAccountName(a).toLowerCase().includes(clean) || (a.account_id || "").toLowerCase().includes(clean)).slice(0, 6).map((a: any) => (
                <div key={a.id} onClick={() => { setOpen(false); onSelectAsset(a); }} className="cursor-pointer p-2.5 rounded-xl bg-black border border-zinc-900 flex justify-between text-xs text-white">
                  <span>{getAssetAccountName(a)} ({a.account_id})</span><span className="text-zinc-400">{a.platform}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { PasswordVaultBadge, HierarchicalReportsHub, GroupedMetricsTab } from "@/components/ExecutiveOverlay";

