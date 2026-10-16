"use client";

import { useState, useEffect } from "react";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  APP_THEMES,
  UI_LAYOUT_MODES,
  AppThemeId,
  UILayoutMode,
  computeLive2FACode,
  getAssetAccountName,
  recordLocalArchiveEvent,
} from "@/lib/constants";

// Universal Button with Built-in Click & Loading Spinner Indicator
export function ActionButton({
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  loadingText = "Processing...",
  className = "",
  children,
  title,
}: {
  onClick?: (e: any) => Promise<any> | any;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
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
      {isBusy && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      )}
      <span>{isBusy ? loadingText : children}</span>
    </button>
  );
}

// Theme & Out-of-the-Box UI Layout Mode Hook
export function usePortalTheme() {
  const [themeId, setThemeId] = useState<AppThemeId>("emerald");
  const [layoutMode, setLayoutMode] = useState<UILayoutMode>("classic");

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal_theme_v1") as AppThemeId;
    if (savedTheme && APP_THEMES.some((t) => t.id === savedTheme)) setThemeId(savedTheme);
    const savedLayout = localStorage.getItem("portal_layout_mode_v1") as UILayoutMode;
    if (savedLayout && UI_LAYOUT_MODES.some((m) => m.id === savedLayout)) setLayoutMode(savedLayout);
  }, []);

  const changeTheme = (id: AppThemeId) => {
    setThemeId(id);
    localStorage.setItem("portal_theme_v1", id);
  };

  const changeLayoutMode = (mode: UILayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem("portal_layout_mode_v1", mode);
  };

  const currentTheme = APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0];
  return { themeId, changeTheme, currentTheme, layoutMode, changeLayoutMode };
}

export function ThemePickerDropdown({
  themeId,
  onChange,
  layoutMode,
  onLayoutChange,
}: {
  themeId: AppThemeId;
  onChange: (id: AppThemeId) => void;
  layoutMode?: UILayoutMode;
  onLayoutChange?: (mode: UILayoutMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {layoutMode && onLayoutChange && (
        <select
          value={layoutMode}
          onChange={(e) => onLayoutChange(e.target.value as UILayoutMode)}
          className="rounded-xl bg-zinc-900 border border-emerald-500/40 hover:border-emerald-400 px-3 py-2 text-xs text-emerald-300 font-bold outline-none transition-all cursor-pointer"
          title="Switch Workspace UI Architecture"
        >
          {UI_LAYOUT_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <select
        value={themeId}
        onChange={(e) => onChange(e.target.value as AppThemeId)}
        className="rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs text-zinc-200 font-bold outline-none transition-all cursor-pointer"
        title="Select Color Theme"
      >
        {APP_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Grouped Single-Form Weekly Metrics Matrix (Groups all accounts by Platform Tab with Live Totals)
export function GroupedWeeklyMetricsForm({
  actorId,
  assets,
  allMetrics,
  isLocked,
  onSaved,
  onInspectAsset,
}: {
  actorId: string;
  assets: any[];
  allMetrics: any[];
  isLocked?: boolean;
  onSaved: (msg: string) => Promise<void> | void;
  onInspectAsset?: (asset: any) => void;
}) {
  const [platformTab, setPlatformTab] = useState<string>("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");
  const [weekOf, setWeekOf] = useState(new Date().toISOString().split("T")[0]);
  const [rowsState, setRowsState] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const platformAssets = assets.filter((a) => platformTab === "all" || a.platform === platformTab);
  const displayedAssets =
    selectedAccountFilter === "all"
      ? platformAssets
      : platformAssets.filter((a) => a.id === selectedAccountFilter);

  // Initialize or sync form rows when weekOf or assets change
  useEffect(() => {
    const nextMap: Record<string, any> = {};
    for (const a of assets) {
      const existing = allMetrics.find((m) => m.asset_id === a.id && m.week_of === weekOf);
      const latestAny = allMetrics
        .filter((m) => m.asset_id === a.id)
        .sort((x, y) => (y.week_of || "").localeCompare(x.week_of || ""))[0];

      nextMap[a.id] = {
        posts_published: existing?.posts_published ?? "",
        impressions: existing?.impressions ?? "",
        likes: existing?.likes ?? "",
        total_followers: existing?.total_followers ?? latestAny?.total_followers ?? "",
        followers_gained: existing?.followers_gained ?? "",
        followers_lost: existing?.followers_lost ?? "",
        engagements: existing?.engagements ?? "",
        shares_reposts: existing?.shares_reposts ?? "",
        comments: existing?.comments ?? "",
      };
    }
    setRowsState(nextMap);
  }, [assets, allMetrics, weekOf]);

  const updateCell = (assetId: string, field: string, val: string) => {
    setRowsState((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [field]: val },
    }));
  };

  // Live Aggregate Totals Across All Accounts in Current Tab
  const totalAccounts = displayedAssets.length;
  const totalPosts = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.posts_published) || 0), 0);
  const totalViews = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.impressions) || 0), 0);
  const totalLikes = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.likes) || 0), 0);
  const totalFollowers = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.total_followers) || 0), 0);
  const totalGained = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.followers_gained) || 0), 0);
  const totalLost = displayedAssets.reduce((s, a) => s + (parseInt(rowsState[a.id]?.followers_lost) || 0), 0);
  const netFollowers = totalGained - totalLost;

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return alert("Metric submissions are currently locked by your Team Leader.");
    if (displayedAssets.length === 0) return alert("No accounts available in this group.");

    setSubmitting(true);
    const payloadRows = displayedAssets.map((a) => {
      const st = rowsState[a.id] || {};
      const views = parseInt(st.impressions) || 0;
      const likes = parseInt(st.likes) || 0;
      const reposts = parseInt(st.shares_reposts) || 0;
      const comments = parseInt(st.comments) || 0;
      const explicitEng = parseInt(st.engagements);
      const computedEng = !isNaN(explicitEng) && explicitEng > 0 ? explicitEng : likes + reposts + comments;

      return {
        asset_id: a.id,
        week_of: weekOf,
        posts_published: parseInt(st.posts_published) || 0,
        impressions: views,
        likes,
        engagements: computedEng,
        shares_reposts: reposts,
        comments,
        total_followers: parseInt(st.total_followers) || 0,
        followers_gained: parseInt(st.followers_gained) || 0,
        followers_lost: parseInt(st.followers_lost) || 0,
        top_post_impressions: 0,
      };
    });

    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId,
        entity: "metric",
        action: "batch_upsert",
        payload: { rows: payloadRows },
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      recordLocalArchiveEvent({
        actor_name: "Handler",
        actor_role: "smm",
        action: "UPSERT",
        entity_type: "METRIC",
        summary: `Submitted weekly metrics (${weekOf}) for ${payloadRows.length} accounts — Views: ${totalViews.toLocaleString()}, Likes: ${totalLikes.toLocaleString()}`,
        record_snapshot: { weekOf, totalAccounts, totalPosts, totalViews, totalLikes, totalFollowers, totalGained, totalLost },
      });
      await onSaved(`Saved weekly metrics for ${payloadRows.length} account(s) (${weekOf}).`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save weekly metrics.");
    }
  };

  return (
    <form onSubmit={handleBatchSubmit} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl">
      {/* Top Bar: Platform Group Tabs + Account Name Dropdown + Report Date */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Weekly Metrics Submission Form</h2>
          <p className="text-xs text-zinc-400">
            Select a platform tab to enter metrics for all grouped accounts in a single form, or filter by Account Name.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Account Name Filter</label>
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500 min-w-[210px]"
            >
              <option value="all">All Accounts in Tab ({platformAssets.length})</option>
              {platformAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {getAssetAccountName(a)} ({a.account_id}) — {a.platform.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Report Date (Week Of)</label>
            <input
              type="date"
              required
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
              className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Platform Grouping Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {["all", ...PLATFORMS].map((plat) => {
          const count = plat === "all" ? assets.length : assets.filter((a) => a.platform === plat).length;
          return (
            <button
              key={plat}
              type="button"
              onClick={() => {
                setPlatformTab(plat);
                setSelectedAccountFilter("all");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase border transition-all cursor-pointer ${
                platformTab === plat
                  ? "bg-purple-600 text-white border-purple-400 shadow-md"
                  : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {plat === "all" ? `All Platforms (${count})` : `${plat} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Live 6-Metric Summary Bar (Total Accounts, Total Posts, Total Views, Total Likes, Total Followers, Followers Gained/Lost) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-black/90 border border-zinc-800/90 p-4 rounded-2xl font-mono">
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">1. Total Accounts</span>
          <span className="text-lg font-bold text-white">{totalAccounts}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">2. Total Posts</span>
          <span className="text-lg font-bold text-amber-400">{totalPosts.toLocaleString()}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">3. Total Views</span>
          <span className="text-lg font-bold text-blue-400">{totalViews.toLocaleString()}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">4. Total Likes</span>
          <span className="text-lg font-bold text-purple-400">{totalLikes.toLocaleString()}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">5. Total Followers</span>
          <span className="text-lg font-bold text-emerald-400">{totalFollowers.toLocaleString()}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900">
          <span className="text-[10px] text-zinc-500 block uppercase">6. Gained / Lost</span>
          <span className="text-sm font-bold text-emerald-400">
            +{totalGained} <span className="text-red-400">/ -{totalLost}</span>{" "}
            <span className="text-zinc-400">({netFollowers >= 0 ? `+${netFollowers}` : netFollowers})</span>
          </span>
        </div>
      </div>

      {/* Unified Single-Form Table for All Grouped Accounts */}
      <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
        <table className="w-full text-left text-xs text-zinc-200">
          <thead className="bg-zinc-900 text-zinc-400 uppercase font-mono text-[10px]">
            <tr>
              <th className="p-3 min-w-[180px]">Account Name & Username</th>
              <th className="p-3 min-w-[105px]">Total Posts</th>
              <th className="p-3 min-w-[120px]">Total Views</th>
              <th className="p-3 min-w-[115px]">Total Likes</th>
              <th className="p-3 min-w-[125px]">Total Followers</th>
              <th className="p-3 min-w-[115px]">Followers Gained</th>
              <th className="p-3 min-w-[115px]">Followers Lost</th>
              <th className="p-3 min-w-[115px]">Reposts / Comments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-black">
            {displayedAssets.map((asset) => {
              const row = rowsState[asset.id] || {};
              const accName = getAssetAccountName(asset);
              return (
                <tr key={asset.id} className="hover:bg-zinc-950/80">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold uppercase">
                        {asset.platform}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInspectAsset && onInspectAsset(asset)}
                        className="font-bold text-white hover:text-purple-300 text-left truncate"
                      >
                        {accName}
                      </button>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {asset.account_id} • {asset.country_language}
                    </div>
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="Posts"
                      value={row.posts_published ?? ""}
                      onChange={(e) => updateCell(asset.id, "posts_published", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 p-2 text-xs text-white font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="Views"
                      value={row.impressions ?? ""}
                      onChange={(e) => updateCell(asset.id, "impressions", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 p-2 text-xs text-blue-300 font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="Likes"
                      value={row.likes ?? ""}
                      onChange={(e) => updateCell(asset.id, "likes", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 p-2 text-xs text-purple-300 font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="Total Followers"
                      value={row.total_followers ?? ""}
                      onChange={(e) => updateCell(asset.id, "total_followers", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 p-2 text-xs text-emerald-300 font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="+ Gained"
                      value={row.followers_gained ?? ""}
                      onChange={(e) => updateCell(asset.id, "followers_gained", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-500 p-2 text-xs text-emerald-400 font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      placeholder="- Lost"
                      value={row.followers_lost ?? ""}
                      onChange={(e) => updateCell(asset.id, "followers_lost", e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-red-500 p-2 text-xs text-red-400 font-mono outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        min="0"
                        placeholder="Reposts"
                        value={row.shares_reposts ?? ""}
                        onChange={(e) => updateCell(asset.id, "shares_reposts", e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-[11px] text-white font-mono outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Comments"
                        value={row.comments ?? ""}
                        onChange={(e) => updateCell(asset.id, "comments", e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-[11px] text-white font-mono outline-none"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayedAssets.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-zinc-500">
                  No accounts registered under this platform filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ActionButton
        type="submit"
        loading={submitting}
        loadingText="Saving Weekly Metrics..."
        disabled={isLocked || displayedAssets.length === 0}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg"
      >
        {isLocked ? "Metric Submissions Locked by Team Leader" : `Save Weekly Metrics for All ${displayedAssets.length} Account(s)`}
      </ActionButton>
    </form>
  );
}

export function FancyMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const toggle = (item: string) => {
    if (selected.includes(item)) onChange(selected.filter((x) => x !== item));
    else onChange([...selected, item]);
  };
  const filtered = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] uppercase font-bold text-zinc-400">
          {label} <span className="text-purple-400">({selected.length} selected)</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange([...options])} className="text-[10px] text-purple-400 hover:underline">Select All</button>
          {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">Clear</button>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-purple-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all"
      >
        <div className="flex flex-wrap gap-1 truncate">
          {selected.length > 0 ? (
            selected.slice(0, 4).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-bold">{s}</span>
            ))
          ) : (
            <span className="text-zinc-500">Select options...</span>
          )}
          {selected.length > 4 && <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">+{selected.length - 4} more</span>}
        </div>
        <span className="text-zinc-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2">
          {options.length > 6 && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded-lg bg-black border border-zinc-800 px-2.5 py-1.5 text-xs text-white outline-none"
            />
          )}
          <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pr-1">
            {filtered.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`text-left px-2.5 py-2 rounded-lg text-[11px] font-bold truncate border transition-all active:scale-95 ${
                    active ? "bg-purple-600/30 border-purple-500 text-white" : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
                  }`}
                >
                  {active ? "✓ " : ""}{opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function FancyEntityMultiSelect({
  label,
  items,
  selectedIds,
  onChange,
}: {
  label: string;
  items: { id: string; label: string; sub?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };
  const filtered = items.filter((it) => it.label.toLowerCase().includes(filter.toLowerCase()) || (it.sub || "").toLowerCase().includes(filter.toLowerCase()));
  const selectedLabels = items.filter((it) => selectedIds.includes(it.id));

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] uppercase font-bold text-zinc-400">
          {label} <span className="text-blue-400">({selectedIds.length} assigned)</span>
        </label>
        <div className="flex gap-2">
          {items.length > 0 && <button type="button" onClick={() => onChange(items.map((i) => i.id))} className="text-[10px] text-blue-400 hover:underline">Select All</button>}
          {selectedIds.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">Clear</button>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-blue-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all"
      >
        <div className="flex flex-wrap gap-1 truncate">
          {selectedLabels.length > 0 ? (
            selectedLabels.slice(0, 3).map((it) => (
              <span key={it.id} className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-200 text-[10px] font-bold">{it.label}</span>
            ))
          ) : (
            <span className="text-zinc-500">Select items...</span>
          )}
          {selectedLabels.length > 3 && <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">+{selectedLabels.length - 3} more</span>}
        </div>
        <span className="text-zinc-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter list..."
            className="w-full rounded-lg bg-black border border-zinc-800 px-2.5 py-1.5 text-xs text-white outline-none"
          />
          <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
            {filtered.map((it) => {
              const active = selectedIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={`text-left px-3 py-2 rounded-lg text-xs border transition-all active:scale-95 ${
                    active ? "bg-blue-600/30 border-blue-500 text-white font-bold" : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="truncate">{active ? "✓ " : ""}{it.label}</div>
                  {it.sub && <div className="text-[10px] text-zinc-500 truncate">{it.sub}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Out-of-the-Box 3-Pane Split Command Matrix (Used when LayoutMode === 'split')
export function ThreePaneCommandMatrix({
  teamLeaders,
  smms,
  assets,
  metrics,
  onSelectTl,
  onSelectSmm,
  onSelectAsset,
  onEditAsset,
  onToggleAssetStatus,
  onToggleSmmLock,
}: {
  teamLeaders: any[];
  smms: any[];
  assets: any[];
  metrics: any[];
  onSelectTl?: (tl: any) => void;
  onSelectSmm?: (smm: any) => void;
  onSelectAsset: (asset: any) => void;
  onEditAsset: (asset: any) => void;
  onToggleAssetStatus: (asset: any, next: "active" | "suspended") => Promise<void> | void;
  onToggleSmmLock?: (smm: any) => Promise<void> | void;
}) {
  const [activeTlId, setActiveTlId] = useState<string>(teamLeaders[0]?.id || "all");
  const [activeSmmId, setActiveSmmId] = useState<string>("all");

  const paneSmms =
    activeTlId === "all"
      ? smms
      : smms.filter((s) => s.team_leader_id === activeTlId || (s.team_leader_ids && s.team_leader_ids.includes(activeTlId)));

  const paneAssets = assets.filter((a) => {
    if (activeSmmId !== "all") return a.smm_id === activeSmmId;
    if (activeTlId !== "all") return a.team_leader_id === activeTlId || paneSmms.some((s) => s.id === a.smm_id);
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-zinc-950/90 border border-zinc-800 rounded-3xl p-4 shadow-2xl">
      {/* Pane 1: Team Leaders */}
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-zinc-800 pr-0 lg:pr-3 space-y-2 max-h-[72vh] overflow-y-auto">
        <div className="flex justify-between items-center px-2 py-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400">Pane 1: Team Leaders ({teamLeaders.length})</span>
          <button type="button" onClick={() => { setActiveTlId("all"); setActiveSmmId("all"); }} className="text-[10px] text-zinc-400 hover:text-white">
            Show All
          </button>
        </div>
        {teamLeaders.map((tl) => {
          const selected = activeTlId === tl.id;
          const count = smms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id))).length;
          return (
            <div
              key={tl.id}
              onClick={() => { setActiveTlId(tl.id); setActiveSmmId("all"); }}
              className={`cursor-pointer p-3 rounded-2xl border transition-all flex justify-between items-center ${
                selected ? "bg-emerald-500/20 border-emerald-400 text-white" : "bg-black border-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <div className="truncate">
                <div className="font-bold text-xs">{tl.full_name}</div>
                <div className="text-[10px] text-zinc-500 truncate">{tl.country} • {count} SMMs</div>
              </div>
              {onSelectTl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectTl(tl); }}
                  className="px-2 py-1 rounded bg-zinc-900 text-[10px] text-emerald-300 font-bold"
                >
                  Details
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pane 2: SMM Handlers */}
      <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-zinc-800 pr-0 lg:pr-3 space-y-2 max-h-[72vh] overflow-y-auto">
        <div className="flex justify-between items-center px-2 py-1">
          <span className="text-[10px] uppercase font-bold text-blue-400">Pane 2: SMM Handlers ({paneSmms.length})</span>
          <button type="button" onClick={() => setActiveSmmId("all")} className="text-[10px] text-zinc-400 hover:text-white">
            All in Squad
          </button>
        </div>
        {paneSmms.map((smm) => {
          const selected = activeSmmId === smm.id;
          const aCount = assets.filter((a) => a.smm_id === smm.id).length;
          return (
            <div
              key={smm.id}
              onClick={() => setActiveSmmId(smm.id)}
              className={`cursor-pointer p-3 rounded-2xl border transition-all flex justify-between items-center gap-2 ${
                selected ? "bg-blue-500/20 border-blue-400 text-white" : "bg-black border-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <div className="truncate">
                <div className="font-bold text-xs">{smm.full_name}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {smm.country} • {aCount} Accounts
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {onToggleSmmLock && (
                  <ActionButton
                    onClick={() => onToggleSmmLock(smm)}
                    loadingText="..."
                    className={`px-2 py-1 rounded text-[10px] font-bold ${smm.is_locked ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
                  >
                    {smm.is_locked ? "Locked" : "Open"}
                  </ActionButton>
                )}
                {onSelectSmm && (
                  <button
                    type="button"
                    onClick={() => onSelectSmm(smm)}
                    className="px-2 py-1 rounded bg-zinc-900 text-[10px] text-blue-300 font-bold"
                  >
                    Details
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pane 3: Accounts & Live Telemetry */}
      <div className="lg:col-span-5 space-y-2 max-h-[72vh] overflow-y-auto">
        <div className="flex justify-between items-center px-2 py-1">
          <span className="text-[10px] uppercase font-bold text-purple-400">Pane 3: Social Media Accounts ({paneAssets.length})</span>
        </div>
        {paneAssets.map((asset) => {
          const isSusp = asset.status === "suspended";
          const aLogs = metrics.filter((m) => m.asset_id === asset.id);
          const views = aLogs.reduce((s, m) => s + Number(m.impressions || 0), 0);
          return (
            <div
              key={asset.id}
              onClick={() => onSelectAsset(asset)}
              className="cursor-pointer p-3.5 rounded-2xl bg-black border border-zinc-900 hover:border-purple-500/50 flex justify-between items-center gap-3 transition-all"
            >
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold uppercase">
                    {asset.platform}
                  </span>
                  <span className="font-bold text-xs text-white truncate">{getAssetAccountName(asset)}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {asset.account_id} • {views.toLocaleString()} Views
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <ActionButton
                  onClick={() => onToggleAssetStatus(asset, isSusp ? "active" : "suspended")}
                  loadingText="..."
                  className={`px-2 py-1 rounded text-[10px] font-bold ${isSusp ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
                >
                  {isSusp ? "Suspended" : "Active"}
                </ActionButton>
                <button
                  type="button"
                  onClick={() => onEditAsset(asset)}
                  className="px-2.5 py-1 rounded bg-zinc-900 text-[10px] text-emerald-300 font-bold"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// SMM Details Modal
export function SMMSpotlightModal({
  smm,
  tlName,
  assets,
  metrics,
  onClose,
  onSelectAsset,
  onEditAsset,
  onToggleAssetStatus,
  onEditSmm,
  onToggleSmmLock,
}: {
  smm: any;
  tlName?: string;
  assets: any[];
  metrics: any[];
  onClose: () => void;
  onSelectAsset: (asset: any) => void;
  onEditAsset: (asset: any) => void;
  onToggleAssetStatus: (asset: any, nextStatus: "active" | "suspended") => Promise<void> | void;
  onEditSmm?: (smm: any) => void;
  onToggleSmmLock?: (smm: any) => Promise<void> | void;
}) {
  const smmAssets = assets.filter((a) => a.smm_id === smm.id);
  const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
  const totalImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
  const totalEng = smmLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
  const totalPosts = smmLogs.reduce((s, x) => s + Number(x.posts_published || 0), 0);
  const activeCount = smmAssets.filter((a) => a.status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-zinc-950 border border-blue-500/50 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[10px] font-bold uppercase">
                SMM Handler Overview
              </span>
              {tlName && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  Team Leader: {tlName}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${smm.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {smm.is_locked ? "LOCKED" : "OPEN"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">{smm.full_name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Countries: <b className="text-zinc-200">{smm.country}</b> • Platforms:{" "}
              <b className="text-purple-300">{(smm.platforms || ["twitter"]).join(", ").toUpperCase()}</b>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onToggleSmmLock && (
              <ActionButton
                onClick={() => onToggleSmmLock(smm)}
                loadingText="Updating..."
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                  smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {smm.is_locked ? "Unlock SMM" : "Lock SMM"}
              </ActionButton>
            )}
            {onEditSmm && (
              <button type="button" onClick={() => onEditSmm(smm)} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
                Edit SMM & Accounts
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 font-bold">
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL ACCOUNTS</span>
            <span className="text-xl font-bold text-white">{activeCount} <span className="text-xs text-zinc-500">/ {smmAssets.length} Active</span></span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span>
            <span className="text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">ENGAGEMENTS</span>
            <span className="text-xl font-bold text-purple-400">{totalEng.toLocaleString()}</span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span>
            <span className="text-xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Managed Accounts ({smmAssets.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {smmAssets.map((asset) => {
              const isSuspended = asset.status === "suspended";
              const aLogs = metrics.filter((m) => m.asset_id === asset.id);
              const aImpr = aLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
              const aLikes = aLogs.reduce((s, x) => s + Number(x.likes || 0), 0);
              const aFol = aLogs[0]?.total_followers || 0;

              return (
                <div
                  key={asset.id}
                  onClick={() => onSelectAsset(asset)}
                  className={`cursor-pointer rounded-2xl p-4 border relative transition-all hover:-translate-y-1 ${
                    isSuspended ? "bg-red-950/15 border-red-500/50" : "bg-black border-zinc-800 hover:border-purple-400"
                  }`}
                >
                  <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                    <ActionButton
                      onClick={() => onToggleAssetStatus(asset, isSuspended ? "active" : "suspended")}
                      loadingText="..."
                      className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                        isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {isSuspended ? "Suspended" : "Active"}
                    </ActionButton>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <h4 className="font-bold text-white text-base mt-1.5 truncate pr-20">{getAssetAccountName(asset)}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono">{asset.account_id} • {asset.country_language}</p>

                  <div className="mt-3 p-2.5 rounded-xl bg-zinc-950 border border-zinc-900 text-[11px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Views / Likes:</span>
                      <span className="text-blue-400 font-bold">{aImpr.toLocaleString()} / <span className="text-purple-400">{aLikes.toLocaleString()}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Total Followers:</span>
                      <span className="text-emerald-400 font-bold">{aFol.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onSelectAsset(asset)} className="py-1.5 bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-[11px] font-bold">
                      View Details
                    </button>
                    <button type="button" onClick={() => onEditAsset(asset)} className="py-1.5 bg-zinc-900 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-xl text-[11px] font-bold">
                      Edit Account
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Team Leader Details Modal
export function TeamLeaderSpotlightModal({
  tl,
  smms,
  assets,
  metrics,
  onClose,
  onSelectSmm,
  onEditTl,
  onEditSmm,
  onToggleSmmLock,
}: {
  tl: any;
  smms: any[];
  assets: any[];
  metrics: any[];
  onClose: () => void;
  onSelectSmm: (smm: any) => void;
  onEditTl: (tl: any) => void;
  onEditSmm: (smm: any) => void;
  onToggleSmmLock: (smm: any) => Promise<void> | void;
}) {
  const tlSmms = smms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
  const tlAssets = assets.filter((a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id));
  const tlLogs = metrics.filter((m) => tlAssets.some((a) => a.id === m.asset_id));
  const totalImpr = tlLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
  const totalLikes = tlLogs.reduce((s, x) => s + Number(x.likes || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-zinc-950 border border-emerald-500/50 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div>
            <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase">
              Team Leader Overview
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">{tl.full_name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Regions: <b className="text-zinc-200">{tl.country}</b> • Squad: <b className="text-emerald-400">{tlSmms.length} SMMs</b> • Accounts: <b className="text-purple-300">{tlAssets.length}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEditTl(tl)} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold">
              Edit Team Leader & Squad
            </button>
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 font-bold">
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">SQUAD SMM HANDLERS</span>
            <span className="text-xl font-bold text-emerald-400">{tlSmms.length}</span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL ACCOUNTS</span>
            <span className="text-xl font-bold text-purple-400">{tlAssets.length}</span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span>
            <span className="text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          </div>
          <div className="bg-black border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span>
            <span className="text-xl font-bold text-pink-400">{totalLikes.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Assigned SMM Handlers ({tlSmms.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tlSmms.map((smm) => {
              const smmAssets = assets.filter((a) => a.smm_id === smm.id);
              const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
              const sImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
              const sLikes = smmLogs.reduce((s, x) => s + Number(x.likes || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => onSelectSmm(smm)}
                  className="cursor-pointer rounded-2xl p-5 bg-black border border-zinc-800 hover:border-blue-400 transition-all hover:-translate-y-1 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-white text-lg">{smm.full_name}</h4>
                      <p className="text-xs text-zinc-400">{smm.country}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                      {smmAssets.length} Accounts
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 text-xs font-mono space-y-1">
                    <div className="flex justify-between"><span className="text-zinc-500">Total Views:</span><span className="text-blue-400 font-bold">{sImpr.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Total Likes:</span><span className="text-purple-400 font-bold">{sLikes.toLocaleString()}</span></div>
                  </div>
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onSelectSmm(smm)} className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-xs font-bold">
                      View Details
                    </button>
                    <ActionButton
                      onClick={() => onToggleSmmLock(smm)}
                      loadingText="..."
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                    >
                      {smm.is_locked ? "Locked" : "Open"}
                    </ActionButton>
                    <button type="button" onClick={() => onEditSmm(smm)} className="px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold">
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Platform-Aware Account Editor Modal (Account Name, Username for Twitter, Email/Phone for Facebook, No "Recovery" wording)
export function UniversalAssetEditModal({
  asset,
  teamLeaders = [],
  smms = [],
  canReassignSmm = false,
  onClose,
  onSave,
  onDelete,
}: {
  asset: any;
  teamLeaders?: any[];
  smms?: any[];
  canReassignSmm?: boolean;
  onClose: () => void;
  onSave: (updatedAsset: any) => Promise<void> | void;
  onDelete?: (assetId: string) => Promise<void> | void;
}) {
  const [form, setForm] = useState<any>({
    ...asset,
    platform: asset.platform || "twitter",
    status: asset.status || "active",
    country_language: asset.country_language || "Kenya",
    language: asset.language || "English",
    account_name: getAssetAccountName(asset),
    account_id: asset.account_id || "",
    account_password: asset.account_password || "",
    profile_link: asset.profile_link || "",
    bio: asset.bio || "",
    email: asset.email || "",
    email_password: asset.email_password || "",
    two_fa_code: asset.two_fa_code || "",
    phone_number: asset.phone_number || "",
    team_leader_id: asset.team_leader_id || "",
    smm_id: asset.smm_id || "",
    tl_task: asset.tl_task || "",
    tl_comment: asset.tl_comment || "",
  });
  const [saving, setSaving] = useState(false);

  const isTwitter = form.platform === "twitter";
  const isFacebook = form.platform === "facebook";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      project_name: form.account_name || form.account_id,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-zinc-950 border border-emerald-500/60 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-lg sm:text-xl font-bold text-white">
            Edit Account Details — {form.account_name} ({form.account_id})
          </h3>
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-zinc-900 text-xs text-zinc-300 rounded-xl font-bold">
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Platform</label>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-bold">
              <option value="active">ACTIVE</option>
              <option value="suspended">SUSPENDED</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Country</label>
            <select value={form.country_language} onChange={(e) => setForm({ ...form, country_language: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Language</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Account Name</label>
            <input
              type="text"
              required
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="e.g. Sahara Voice X"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">
              {isTwitter ? "Username" : "Username / Handle"}
            </label>
            <input
              type="text"
              required
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              placeholder={isTwitter ? "@username" : "Username"}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Account Password</label>
            <input
              type="text"
              value={form.account_password}
              onChange={(e) => setForm({ ...form, account_password: e.target.value })}
              placeholder="Account Password"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Profile Link</label>
            <input type="url" value={form.profile_link} onChange={(e) => setForm({ ...form, profile_link: e.target.value })} placeholder="https://..." className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-blue-300" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Bio</label>
            <input type="text" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Profile Bio" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">
              {isFacebook ? "Email / Phone Number" : "Email"}
            </label>
            <input
              type="text"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={isFacebook ? "Email or Phone Number" : "Email address"}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Email Password</label>
            <input
              type="text"
              value={form.email_password}
              onChange={(e) => setForm({ ...form, email_password: e.target.value })}
              placeholder="Email Password"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">2FA Code</label>
            <input
              type="text"
              value={form.two_fa_code}
              onChange={(e) => setForm({ ...form, two_fa_code: e.target.value })}
              placeholder="2FA Secret Key"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-amber-300 font-mono"
            />
          </div>
          {!isFacebook && (
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Phone Number</label>
              <input
                type="text"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="Phone Number"
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
          <select value={form.team_leader_id || ""} onChange={(e) => setForm({ ...form, team_leader_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
            <option value="">Select Team Leader</option>
            {teamLeaders.map((tl) => <option key={tl.id} value={tl.id}>{tl.full_name}</option>)}
          </select>
          {canReassignSmm && (
            <select value={form.smm_id || ""} onChange={(e) => setForm({ ...form, smm_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              <option value="">Unassigned SMM</option>
              {smms.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <ActionButton
            type="submit"
            loading={saving}
            loadingText="Saving Account..."
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs"
          >
            Save Account Changes
          </ActionButton>
          {onDelete && (
            <ActionButton
              onClick={() => onDelete(asset.id)}
              loadingText="Deleting..."
              className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs"
            >
              Delete Account
            </ActionButton>
          )}
        </div>
      </form>
    </div>
  );
}

export function AssetGrowthModal({
  asset,
  metrics,
  profiles = [],
  onClose,
  onEdit,
  onToggleStatus,
}: {
  asset: any;
  metrics: any[];
  profiles?: any[];
  onClose: () => void;
  onEdit?: (asset: any) => void;
  onToggleStatus?: (asset: any, nextStatus: "active" | "suspended") => Promise<void> | void;
}) {
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [live2fa, setLive2fa] = useState("------");
  const [totpSec, setTotpSec] = useState(30);
  const [copiedLabel, setCopiedLabel] = useState("");

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      setTotpSec(30 - (Math.floor(Date.now() / 1000) % 30));
      if (asset?.two_fa_code) {
        const code = await computeLive2FACode(asset.two_fa_code);
        if (mounted) setLive2fa(code);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { mounted = false; clearInterval(id); };
  }, [asset]);

  const copyVal = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(""), 2000);
  };

  const assetMetrics = metrics.filter((m) => m.asset_id === asset.id).sort((a, b) => a.week_of.localeCompare(b.week_of));
  const latest = assetMetrics[assetMetrics.length - 1] || {};
  const totalImpr = assetMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalLikes = assetMetrics.reduce((s, m) => s + Number(m.likes || 0), 0);
  const totalPosts = assetMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const totalGained = assetMetrics.reduce((s, m) => s + Number(m.followers_gained || 0), 0);
  const totalLost = assetMetrics.reduce((s, m) => s + Number(m.followers_lost || 0), 0);
  const maxImpr = Math.max(100, ...assetMetrics.map((m) => Number(m.impressions || 0)));

  const ownerSmm = profiles.find((p) => p.id === asset.smm_id);
  const ownerTl = profiles.find((p) => p.id === (asset.team_leader_id || ownerSmm?.team_leader_id));
  const isSuspended = asset.status === "suspended";
  const accName = getAssetAccountName(asset);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-zinc-950 border border-purple-500/60 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-200 font-bold text-[10px] uppercase">
                Account Details • {asset.platform}
              </span>
              {onToggleStatus && (
                <ActionButton
                  onClick={() => onToggleStatus(asset, isSuspended ? "active" : "suspended")}
                  loadingText="Updating..."
                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                    isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {isSuspended ? "SUSPENDED" : "ACTIVE"}
                </ActionButton>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 text-[10px] font-bold">
                {asset.country_language || "Global"} • {asset.language || "English"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">
              {accName} <span className="text-sm font-mono text-zinc-400">({asset.account_id})</span>
            </h2>
            {asset.profile_link && <a href={asset.profile_link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">{asset.profile_link}</a>}
          </div>
          <div className="flex items-center gap-2">
            {copiedLabel && <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg font-bold">Copied {copiedLabel}</span>}
            <button type="button" onClick={() => setRevealSecrets(!revealSecrets)} className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-amber-300 font-bold">
              {revealSecrets ? "Hide Credentials" : "Show Credentials"}
            </button>
            {onEdit && (
              <button type="button" onClick={() => { onClose(); onEdit(asset); }} className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold">
                Edit Account
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900">
            <span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span>
            <span className="text-lg font-bold text-amber-400">{totalPosts.toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900">
            <span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span>
            <span className="text-lg font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900">
            <span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span>
            <span className="text-lg font-bold text-purple-400">{totalLikes.toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900">
            <span className="text-[10px] text-zinc-500 block">TOTAL FOLLOWERS</span>
            <span className="text-lg font-bold text-white">{(latest.total_followers || 0).toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900">
            <span className="text-[10px] text-zinc-500 block">GAINED / LOST</span>
            <span className="text-sm font-bold text-emerald-400">+{totalGained} / <span className="text-red-400">-{totalLost}</span></span>
          </div>
        </div>

        <div className="bg-black border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div onClick={() => copyVal(accName, "Account Name")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">1. ACCOUNT NAME</span><span className="text-white font-bold">{accName}</span></div>
            <div onClick={() => copyVal(asset.account_id, "Username")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">2. USERNAME</span><span className="text-white font-bold">{asset.account_id || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.account_password, "Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">3. PASSWORD</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>{asset.account_password || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.email, "Email")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">4. {asset.platform === "facebook" ? "EMAIL / PHONE" : "EMAIL"}</span><span className="text-zinc-200 truncate block">{asset.email || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.email_password, "Email Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">5. EMAIL PASSWORD</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>{asset.email_password || "N/A"}</span></div>
            <div onClick={() => copyVal(live2fa, "2FA Code")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">6. 2FA CODE ({totpSec}s)</span><span className="text-amber-300 font-bold">{asset.two_fa_code ? live2fa : "None"}</span></div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">7. COUNTRY & LANGUAGE</span><span className="text-white">{asset.country_language || "N/A"} • {asset.language || "English"}</span></div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">8. HANDLER & TEAM LEADER</span><span className="text-blue-300">{ownerSmm?.full_name || "Unassigned"}</span>{ownerTl && <span className="text-zinc-500"> ({ownerTl.full_name})</span>}</div>
            <div onClick={() => copyVal(asset.phone_number, "Phone")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">9. PHONE NUMBER</span><span className="text-zinc-200">{asset.phone_number || "N/A"}</span></div>
          </div>
        </div>

        {assetMetrics.length > 0 && (
          <div className="bg-black border border-zinc-900 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase text-cyan-400">Weekly Views & Likes History</h4>
            {assetMetrics.slice(-6).map((m) => {
              const pct = Math.min(100, Math.max(6, Math.round(((m.impressions || 0) / maxImpr) * 100)));
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-300 font-bold">{m.week_of}</span>
                    <span className="text-blue-400">{(m.impressions || 0).toLocaleString()} Views • {(m.likes || 0).toLocaleString()} Likes • {(m.posts_published || 0)} Posts</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Accurate Leaderboard & Analytics Graphs
export function ExecutiveAnalyticsGraphs({
  assets,
  metrics,
  profiles = [],
  onSelectAsset,
  onSelectTl,
  onSelectSmm,
  titlePrefix = "Organization",
}: {
  assets: any[];
  metrics: any[];
  profiles?: any[];
  onSelectAsset?: (asset: any) => void;
  onSelectTl?: (tl: any) => void;
  onSelectSmm?: (smm: any) => void;
  titlePrefix?: string;
}) {
  const assetIdSet = new Set(assets.map((a) => a.id));
  const scopedMetrics = metrics.filter((m) => assetIdSet.has(m.asset_id));

  // Accurate latest followers per asset (never double-counted across weeks)
  const getLatestFollowersForAssets = (assetList: any[]) => {
    return assetList.reduce((sum, a) => {
      const aLogs = scopedMetrics
        .filter((m) => m.asset_id === a.id)
        .sort((x, y) => (y.week_of || "").localeCompare(x.week_of || ""));
      return sum + Number(aLogs[0]?.total_followers || 0);
    }, 0);
  };

  const totalAccounts = assets.length;
  const totalPosts = scopedMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const totalViews = scopedMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalLikes = scopedMetrics.reduce((s, m) => s + Number(m.likes || 0), 0);
  const totalFollowers = getLatestFollowersForAssets(assets);
  const totalGained = scopedMetrics.reduce((s, m) => s + Number(m.followers_gained || 0), 0);
  const totalLost = scopedMetrics.reduce((s, m) => s + Number(m.followers_lost || 0), 0);
  const netFollowers = totalGained - totalLost;

  const tls = profiles.filter((p) => p.role === "team_leader");
  const smms = profiles.filter((p) => p.role === "smm");

  const tlLeaderboard = tls
    .map((tl) => {
      const squadSmms = smms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
      const squadSmmIds = new Set(squadSmms.map((s) => s.id));
      const squadAssets = assets.filter((a) => a.team_leader_id === tl.id || squadSmmIds.has(a.smm_id));
      const squadAssetIds = new Set(squadAssets.map((a) => a.id));
      const logs = scopedMetrics.filter((m) => squadAssetIds.has(m.asset_id));

      const views = logs.reduce((s, m) => s + Number(m.impressions || 0), 0);
      const likes = logs.reduce((s, m) => s + Number(m.likes || 0), 0);
      const posts = logs.reduce((s, m) => s + Number(m.posts_published || 0), 0);
      const followers = getLatestFollowersForAssets(squadAssets);
      const gained = logs.reduce((s, m) => s + Number(m.followers_gained || 0), 0);
      const lost = logs.reduce((s, m) => s + Number(m.followers_lost || 0), 0);

      return { tl, smmCount: squadSmms.length, accountCount: squadAssets.length, views, likes, posts, followers, gained, lost, netFol: gained - lost };
    })
    .sort((a, b) => b.views - a.views || b.followers - a.followers || b.accountCount - a.accountCount);
  const maxTlViews = Math.max(100, ...tlLeaderboard.map((t) => t.views));

  const smmLeaderboard = smms
    .map((smm) => {
      const myAssets = assets.filter((a) => a.smm_id === smm.id);
      const myAssetIds = new Set(myAssets.map((a) => a.id));
      const logs = scopedMetrics.filter((m) => myAssetIds.has(m.asset_id));

      const views = logs.reduce((s, m) => s + Number(m.impressions || 0), 0);
      const likes = logs.reduce((s, m) => s + Number(m.likes || 0), 0);
      const posts = logs.reduce((s, m) => s + Number(m.posts_published || 0), 0);
      const followers = getLatestFollowersForAssets(myAssets);
      const gained = logs.reduce((s, m) => s + Number(m.followers_gained || 0), 0);
      const lost = logs.reduce((s, m) => s + Number(m.followers_lost || 0), 0);
      const tl = tls.find((t) => t.id === smm.team_leader_id || (smm.team_leader_ids && smm.team_leader_ids.includes(t.id)));

      return { smm, tlName: tl?.full_name || "Unassigned", accountCount: myAssets.length, views, likes, posts, followers, gained, lost, netFol: gained - lost };
    })
    .sort((a, b) => b.views - a.views || b.followers - a.followers || b.accountCount - a.accountCount);
  const maxSmmViews = Math.max(100, ...smmLeaderboard.map((s) => s.views));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 6 Core Aggregate Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL ACCOUNTS</span><span className="text-xl font-bold text-white">{totalAccounts}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span><span className="text-xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL VIEWS</span><span className="text-xl font-bold text-blue-400">{totalViews.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL LIKES</span><span className="text-xl font-bold text-purple-400">{totalLikes.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">TOTAL FOLLOWERS</span><span className="text-xl font-bold text-emerald-400">{totalFollowers.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><span className="text-[10px] text-zinc-500 block">GAINED / LOST</span><span className="text-sm font-bold text-emerald-400">+{totalGained} / <span className="text-red-400">-{totalLost}</span> ({netFollowers >= 0 ? `+${netFollowers}` : netFollowers})</span></div>
      </div>

      {tlLeaderboard.length > 0 && (
        <div className="bg-zinc-950 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-white">Team Leader Performance Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 uppercase">
                <tr>
                  <th className="p-3">Rank & Team Leader</th>
                  <th className="p-3">Total Accounts</th>
                  <th className="p-3">Total Posts</th>
                  <th className="p-3">Total Views</th>
                  <th className="p-3">Total Likes</th>
                  <th className="p-3">Total Followers</th>
                  <th className="p-3">Gained / Lost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {tlLeaderboard.map((row, idx) => {
                  const barPct = Math.min(100, Math.max(5, Math.round((row.views / maxTlViews) * 100)));
                  return (
                    <tr key={row.tl.id} onClick={() => onSelectTl && onSelectTl(row.tl)} className="hover:bg-zinc-900/60 cursor-pointer">
                      <td className="p-3 font-bold text-white">#{idx + 1} {row.tl.full_name} <span className="block text-[10px] text-zinc-500">{row.tl.country} ({row.smmCount} SMMs)</span></td>
                      <td className="p-3 font-bold text-white">{row.accountCount}</td>
                      <td className="p-3 text-amber-300">{row.posts.toLocaleString()}</td>
                      <td className="p-3 w-48">
                        <div className="text-blue-400 font-bold mb-1">{row.views.toLocaleString()}</div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barPct}%` }} /></div>
                      </td>
                      <td className="p-3 text-purple-300">{row.likes.toLocaleString()}</td>
                      <td className="p-3 text-emerald-300 font-bold">{row.followers.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="text-emerald-400">+{row.gained}</span> / <span className="text-red-400">-{row.lost}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {smmLeaderboard.length > 0 && (
        <div className="bg-zinc-950 border border-blue-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-white">SMM Handler Performance Leaderboard</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-mono text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 uppercase sticky top-0">
                <tr>
                  <th className="p-3">Rank & SMM Handler</th>
                  <th className="p-3">Team Leader</th>
                  <th className="p-3">Total Accounts</th>
                  <th className="p-3">Total Posts</th>
                  <th className="p-3">Total Views</th>
                  <th className="p-3">Total Likes</th>
                  <th className="p-3">Total Followers</th>
                  <th className="p-3">Gained / Lost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {smmLeaderboard.map((row, idx) => {
                  const barPct = Math.min(100, Math.max(5, Math.round((row.views / maxSmmViews) * 100)));
                  return (
                    <tr key={row.smm.id} onClick={() => onSelectSmm && onSelectSmm(row.smm)} className="hover:bg-zinc-900/60 cursor-pointer">
                      <td className="p-3 font-bold text-white">#{idx + 1} {row.smm.full_name} <span className="block text-[10px] text-zinc-500">{row.smm.country}</span></td>
                      <td className="p-3 text-emerald-300">{row.tlName}</td>
                      <td className="p-3 font-bold text-white">{row.accountCount}</td>
                      <td className="p-3 text-amber-300">{row.posts.toLocaleString()}</td>
                      <td className="p-3 w-44">
                        <div className="text-blue-400 font-bold mb-1">{row.views.toLocaleString()}</div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${barPct}%` }} /></div>
                      </td>
                      <td className="p-3 text-purple-300">{row.likes.toLocaleString()}</td>
                      <td className="p-3 text-emerald-300 font-bold">{row.followers.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="text-emerald-400">+{row.gained}</span> / <span className="text-red-400">-{row.lost}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Straightforward Archives Component with Date/Time Filters, CSV Export & Detail Modal
export function ForensicArchiveVault({
  logs,
  onRestore,
}: {
  logs: any[];
  onRestore: (log: any) => Promise<void> | void;
}) {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const filtered = logs.filter((l) => {
    if (typeFilter !== "ALL" && l.entity_type !== typeFilter) return false;
    if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
    if (startDateTime || endDateTime) {
      const t = new Date(l.created_at || Date.now()).getTime();
      if (startDateTime && t < new Date(startDateTime).getTime()) return false;
      if (endDateTime && t > new Date(endDateTime).getTime()) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${l.actor_name || ""} ${l.summary || ""} ${l.action || ""} ${JSON.stringify(l.record_snapshot || {})}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const exportArchivesCSV = (itemsToExport: any[], filenamePrefix = "Archives_Report") => {
    const headers = ["Timestamp", "User", "Role", "Category", "Action", "Summary", "Record Details JSON"];
    const rows = itemsToExport.map((l) =>
      [
        `"${l.created_at || ""}"`,
        `"${l.actor_name || ""}"`,
        `"${l.actor_role || ""}"`,
        `"${l.entity_type || ""}"`,
        `"${l.action || ""}"`,
        `"${(l.summary || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(l.record_snapshot || {}).replace(/"/g, '""')}"`,
      ].join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl">
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Archives ({filtered.length} Records)</h2>
          <p className="text-xs text-zinc-400">Select any archive entry to view full record details or restore state.</p>
        </div>
        <ActionButton
          onClick={() => exportArchivesCSV(filtered, "Archives_Export")}
          loadingText="Exporting..."
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs"
        >
          Export Archives CSV ({filtered.length})
        </ActionButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/80 border border-zinc-800 p-3.5 rounded-2xl">
        <div>
          <label className="text-[10px] uppercase font-bold text-amber-400 block mb-1">From Date & Time</label>
          <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-amber-400 block mb-1">To Date & Time</label>
          <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        </div>
        <div className="flex items-end gap-2">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search account, user, status..." className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
          {(startDateTime || endDateTime || search) && (
            <button type="button" onClick={() => { setStartDateTime(""); setEndDateTime(""); setSearch(""); }} className="px-3 py-2 rounded-xl bg-zinc-900 text-xs text-amber-400 font-bold">Reset</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["ALL", "ASSET", "EMPLOYEE", "METRIC"].map((t) => (
          <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${typeFilter === t ? "bg-amber-500 text-black border-amber-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{t}</button>
        ))}
        {["ALL", "SUSPENDED", "ACTIVE", "UPDATE", "CREATE", "DELETE", "UPSERT"].map((act) => (
          <button key={act} type="button" onClick={() => setActionFilter(act)} className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${actionFilter === act ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{act}</button>
        ))}
      </div>

      <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
        {filtered.map((log) => {
          const snap = log.record_snapshot?.before || log.record_snapshot || {};
          const isSusp = log.action === "SUSPENDED" || snap?.status === "suspended";

          return (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 flex flex-wrap justify-between items-center gap-3 transition-all ${
                isSusp ? "bg-red-950/20 border-red-500/50" : "bg-black/70 border-zinc-900 hover:border-amber-500/50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSusp ? "bg-red-500 text-black" : "bg-emerald-500/20 text-emerald-300"}`}>
                  {log.entity_type} • {log.action}
                </span>
                <span className="text-xs font-bold text-white">{log.summary}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-zinc-400">{log.actor_name} • {log.created_at ? new Date(log.created_at).toLocaleString() : "Recent"}</span>
                <span className="text-amber-400 font-bold text-[11px]">View Details</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl bg-zinc-950 border border-amber-500/60 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
              <div>
                <span className="px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase">
                  Archive Record Details • {selectedLog.entity_type} ({selectedLog.action})
                </span>
                <h3 className="text-xl font-bold text-white mt-2">{selectedLog.summary}</h3>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton
                  onClick={() => exportArchivesCSV([selectedLog], `Archive_Record_${selectedLog.entity_type}`)}
                  loadingText="Exporting..."
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-amber-500/40 text-amber-300 text-xs font-bold"
                >
                  Download CSV
                </ActionButton>
                <ActionButton
                  onClick={async () => {
                    await onRestore(selectedLog);
                    setSelectedLog(null);
                  }}
                  loadingText="Restoring..."
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold"
                >
                  Restore Record
                </ActionButton>
                <button type="button" onClick={() => setSelectedLog(null)} className="px-3.5 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-mono text-xs">
              {Object.entries(selectedLog.record_snapshot?.before || selectedLog.record_snapshot || {}).map(([k, v]) => (
                <div key={k} className="bg-black border border-zinc-800 p-3 rounded-2xl break-all">
                  <span className="text-[10px] text-zinc-500 uppercase block">{k}</span>
                  <span className="text-zinc-100 font-bold">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CampaignDispatchWizard({
  actorId,
  teamLeaders,
  smms,
  assets,
  defaultTlId,
  onSuccess,
}: {
  actorId: string;
  teamLeaders: any[];
  smms: any[];
  assets: any[];
  defaultTlId?: string;
  onSuccess: (msg: string) => void;
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [targetMode, setTargetMode] = useState<"tl" | "smm">("tl");
  const [selectedTlIds, setSelectedTlIds] = useState<string[]>(defaultTlId ? [defaultTlId] : []);
  const [selectedSmmIds, setSelectedSmmIds] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [direction, setDirection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const matchingSmms = smms.filter((s) => {
    const smmProfs: string[] = s.platforms || [];
    const smmAssetPlats = assets.filter((a) => a.smm_id === s.id).map((a) => a.platform);
    return selectedPlatforms.some((p) => smmProfs.includes(p) || smmAssetPlats.includes(p));
  });

  const matchingTls = teamLeaders.filter((tl) => {
    const tlSmms = matchingSmms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
    const directTlAssets = assets.filter((a) => a.team_leader_id === tl.id && selectedPlatforms.includes(a.platform));
    return tlSmms.length > 0 || directTlAssets.length > 0;
  });

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId,
        entity: "campaign",
        action: "dispatch",
        payload: { platforms: selectedPlatforms, targetMode, targetTlIds: selectedTlIds, targetSmmIds: selectedSmmIds, topic: topic.trim(), direction: direction.trim() },
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      recordLocalArchiveEvent({
        actor_name: "Manager",
        actor_role: "admin",
        action: "CAMPAIGN",
        entity_type: "ASSET",
        summary: `Assigned Campaign "${topic}" to ${data.count} accounts`,
        record_snapshot: { topic, direction, platforms: selectedPlatforms },
      });
      setTopic("");
      setDirection("");
      onSuccess(`Assigned campaign "${topic}" to ${data.count} matching accounts.`);
    }
  };

  return (
    <form onSubmit={handleDispatch} className="max-w-3xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
      <h2 className="text-xl sm:text-2xl font-bold text-white">Assign Campaign</h2>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {PLATFORMS.map((p) => (
          <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2.5 rounded-xl text-xs font-bold uppercase border ${selectedPlatforms.includes(p) ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{p}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setTargetMode("tl")} className={`py-3 rounded-xl text-xs font-bold border ${targetMode === "tl" ? "bg-blue-600 text-white border-blue-400" : "bg-black border-zinc-800 text-zinc-400"}`}>Assign to Team Leaders ({matchingTls.length})</button>
        <button type="button" onClick={() => setTargetMode("smm")} className={`py-3 rounded-xl text-xs font-bold border ${targetMode === "smm" ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>Assign Directly to SMMs ({matchingSmms.length})</button>
      </div>
      {targetMode === "tl" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {matchingTls.map((tl) => (
            <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`p-3 rounded-xl border text-left text-xs font-bold ${selectedTlIds.includes(tl.id) ? "bg-blue-600/30 border-blue-400 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>✓ {tl.full_name}</button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {matchingSmms.map((s) => (
            <button type="button" key={s.id} onClick={() => toggleItem(s.id, selectedSmmIds, setSelectedSmmIds)} className={`p-3 rounded-xl border text-left text-xs font-bold ${selectedSmmIds.includes(s.id) ? "bg-purple-600/30 border-purple-400 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>✓ {s.full_name}</button>
          ))}
        </div>
      )}
      <input type="text" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign Topic" className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-xs text-white" />
      <textarea rows={4} required value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Direction, Key Points & Objectives..." className="w-full rounded-xl bg-black border border-zinc-800 p-3.5 text-xs text-white" />
      <ActionButton type="submit" loading={submitting} loadingText="Assigning Campaign..." className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl text-sm">
        Assign Campaign
      </ActionButton>
    </form>
  );
}

export function useRealtimePresence(supabaseClient: any, profile: any) {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabaseClient.channel("executive-presence-room", {
      config: { presence: { key: profile.id } },
    });
    const syncState = () => {
      const state = channel.presenceState();
      const list: any[] = [];
      const ids = new Set<string>();
      Object.entries(state).forEach(([key, presences]: [string, any]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          ids.add(key);
          list.push(presences[0]);
        }
      });
      setOnlineUsers(list);
      setOnlineIds(ids);
    };
    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: profile.id,
            full_name: profile.full_name || "User",
            role: profile.role || "smm",
            country: profile.country || "Global",
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => { supabaseClient.removeChannel(channel); };
  }, [supabaseClient, profile?.id, profile?.full_name, profile?.role, profile?.country]);

  return { onlineUsers, onlineIds };
}

export function LiveOnlineRosterPill({
  onlineUsers,
  profiles = [],
  onSelectTl,
  onSelectSmm,
}: {
  onlineUsers: any[];
  profiles?: any[];
  onSelectTl?: (tl: any) => void;
  onSelectSmm?: (smm: any) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold flex items-center gap-2 cursor-pointer"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        <span>{onlineUsers.length} Online</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-3 sm:p-6" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-zinc-950 border border-emerald-500/60 rounded-3xl p-5 sm:p-7 space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-white">{onlineUsers.length} Active Users Online</h3>
              <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {onlineUsers.map((u) => {
                const fullProf = profiles.find((p) => p.id === u.id) || u;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setOpen(false);
                      if (fullProf.role === "team_leader" && onSelectTl) onSelectTl(fullProf);
                      else if (fullProf.role === "smm" && onSelectSmm) onSelectSmm(fullProf);
                    }}
                    className="cursor-pointer p-4 rounded-2xl bg-black border border-zinc-800 hover:border-emerald-400 space-y-1"
                  >
                    <div className="text-[10px] uppercase font-bold text-emerald-300">{u.role}</div>
                    <div className="font-bold text-white text-sm truncate">{u.full_name}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{u.country}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function GlobalCommandPalette({
  profiles = [],
  assets = [],
  onSelectTl,
  onSelectSmm,
  onSelectAsset,
}: {
  profiles: any[];
  assets: any[];
  onSelectTl: (tl: any) => void;
  onSelectSmm: (smm: any) => void;
  onSelectAsset: (asset: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const clean = q.toLowerCase().trim();
  const matchedTls = profiles.filter((p) => p.role === "team_leader" && (!clean || (p.full_name || "").toLowerCase().includes(clean))).slice(0, 5);
  const matchedSmms = profiles.filter((p) => p.role === "smm" && (!clean || (p.full_name || "").toLowerCase().includes(clean))).slice(0, 6);
  const matchedAssets = assets.filter((a) => !clean || getAssetAccountName(a).toLowerCase().includes(clean) || (a.account_id || "").toLowerCase().includes(clean)).slice(0, 8);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
        <span>Search</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center pt-16 bg-black/85 backdrop-blur-2xl p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-zinc-950 border border-zinc-700 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <input type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Team Leaders, SMMs, Account Names, or Usernames..." className="w-full bg-transparent text-sm text-white outline-none" />
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-400 px-2 py-1 rounded bg-zinc-900">Close</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {matchedTls.map((tl) => (
                <div key={tl.id} onClick={() => { setOpen(false); onSelectTl(tl); }} className="cursor-pointer p-2.5 rounded-xl bg-black border border-zinc-900 flex justify-between text-xs">
                  <span className="font-bold text-white">{tl.full_name} (Team Leader)</span>
                  <span className="text-zinc-400">{tl.country}</span>
                </div>
              ))}
              {matchedSmms.map((s) => (
                <div key={s.id} onClick={() => { setOpen(false); onSelectSmm(s); }} className="cursor-pointer p-2.5 rounded-xl bg-black border border-zinc-900 flex justify-between text-xs">
                  <span className="font-bold text-white">{s.full_name} (SMM)</span>
                  <span className="text-zinc-400">{s.country}</span>
                </div>
              ))}
              {matchedAssets.map((a) => (
                <div key={a.id} onClick={() => { setOpen(false); onSelectAsset(a); }} className="cursor-pointer p-2.5 rounded-xl bg-black border border-zinc-900 flex justify-between text-xs">
                  <span className="font-bold text-white">{getAssetAccountName(a)} ({a.account_id})</span>
                  <span className="text-zinc-400">{a.platform.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
