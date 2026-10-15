"use client";

import { useState, useEffect } from "react";
import { PLATFORMS, ALL_COUNTRIES, ASSET_LANGUAGES, computeLive2FACode } from "@/lib/constants";

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
          <button type="button" onClick={() => onChange([...options])} className="text-[10px] text-purple-400 hover:underline">All</button>
          {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">Clear</button>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-purple-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all duration-300"
      >
        <div className="flex flex-wrap gap-1 truncate">
          {selected.length > 0 ? (
            selected.slice(0, 4).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-bold">{s}</span>
            ))
          ) : (
            <span className="text-zinc-500">Tap to select...</span>
          )}
          {selected.length > 4 && <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">+{selected.length - 4} more</span>}
        </div>
        <span className={`text-zinc-400 text-[10px] transition-transform duration-300 ${open ? "rotate-180 text-purple-400" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
          {options.length > 6 && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded-lg bg-black border border-zinc-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
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
                  className={`text-left px-2.5 py-2 rounded-lg text-[11px] font-bold truncate border transition-all duration-200 active:scale-95 ${
                    active ? "bg-purple-600/30 border-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]" : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
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
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-blue-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all duration-300"
      >
        <div className="flex flex-wrap gap-1 truncate">
          {selectedLabels.length > 0 ? (
            selectedLabels.slice(0, 3).map((it) => (
              <span key={it.id} className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-200 text-[10px] font-bold">{it.label}</span>
            ))
          ) : (
            <span className="text-zinc-500">Tap to assign...</span>
          )}
          {selectedLabels.length > 3 && <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">+{selectedLabels.length - 3} more</span>}
        </div>
        <span className={`text-zinc-400 text-[10px] transition-transform duration-300 ${open ? "rotate-180 text-blue-400" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter list..."
            className="w-full rounded-lg bg-black border border-zinc-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
          <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
            {filtered.map((it) => {
              const active = selectedIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={`text-left px-3 py-2 rounded-lg text-xs border transition-all duration-200 active:scale-95 ${
                    active ? "bg-blue-600/30 border-blue-500 text-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.25)]" : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
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

// Blurred Pop-Up Spotlight Window for SMM Handler
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
  onToggleAssetStatus: (asset: any, nextStatus: "active" | "suspended") => void;
  onEditSmm?: (smm: any) => void;
  onToggleSmmLock?: (smm: any) => void;
}) {
  const smmAssets = assets.filter((a) => a.smm_id === smm.id);
  const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
  const totalImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
  const totalEng = smmLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
  const totalPosts = smmLogs.reduce((s, x) => s + Number(x.posts_published || 0), 0);
  const activeCount = smmAssets.filter((a) => a.status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black border border-blue-500/60 rounded-3xl p-5 sm:p-7 space-y-6 shadow-[0_0_90px_-10px_rgba(59,130,246,0.5)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300"
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                👤 SMM Handler Spotlight
              </span>
              {tlName && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  🛡 Commander {tlName}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${smm.is_locked ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {smm.is_locked ? "🔒 LOCKED" : "🔓 OPEN"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">{smm.full_name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              🌍 Countries: <b className="text-zinc-200">{smm.country}</b> • 📱 Platforms:{" "}
              <b className="text-purple-300">{(smm.platforms || ["twitter"]).join(", ").toUpperCase()}</b>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onToggleSmmLock && (
              <button
                type="button"
                onClick={() => onToggleSmmLock(smm)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                  smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {smm.is_locked ? "🔒 Unlock SMM" : "🔓 Lock SMM"}
              </button>
            )}
            {onEditSmm && (
              <button type="button" onClick={() => onEditSmm(smm)} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg">
                ✎ Edit SMM & Assets
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-bold">
              ✕ Close Window
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">MANAGED ASSETS</span>
            <span className="text-xl font-bold text-white">{activeCount} <span className="text-xs text-zinc-500">/ {smmAssets.length} Active</span></span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL IMPRESSIONS</span>
            <span className="text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL ENGAGEMENTS</span>
            <span className="text-xl font-bold text-purple-400">{totalEng.toLocaleString()}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">POSTS PUBLISHED</span>
            <span className="text-xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
            🗂 {smm.full_name}&apos;s Social Media Assets ({smmAssets.length}) — Click any card to pop open Asset Spotlight
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {smmAssets.map((asset) => {
              const isSuspended = asset.status === "suspended";
              const aLogs = metrics.filter((m) => m.asset_id === asset.id);
              const aImpr = aLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
              const aEng = aLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);
              const aFol = aLogs[0]?.total_followers || 0;

              return (
                <div
                  key={asset.id}
                  onClick={() => onSelectAsset(asset)}
                  className={`group cursor-pointer rounded-2xl p-4 border relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_-10px_rgba(168,85,247,0.45)] ${
                    isSuspended ? "bg-red-950/15 border-red-500/50" : "bg-black/90 border-zinc-800 hover:border-purple-400"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAssetStatus(asset, isSuspended ? "active" : "suspended");
                    }}
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-1 z-10 ${
                      isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    }`}
                  >
                    <span>{isSuspended ? "⚠ SUSP" : "● ACTV"}</span>
                    <span>⇄</span>
                  </button>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">{asset.platform}</span>
                  <h4 className="font-bold text-white text-base mt-1.5 truncate pr-16 group-hover:text-purple-300 transition-colors">{asset.account_id}</h4>
                  <p className="text-[11px] text-zinc-400">🌍 {asset.country_language || "Global"} • 🗣 {asset.language || "English"}</p>

                  <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 group-hover:border-purple-500/40 text-[11px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Impr / Eng:</span>
                      <span className="text-blue-400 font-bold">{aImpr.toLocaleString()} / <span className="text-purple-400">{aEng.toLocaleString()}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Followers:</span>
                      <span className="text-emerald-400 font-bold">{aFol.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onSelectAsset(asset)} className="py-1.5 bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-[11px] font-bold transition-all">
                      🔍 Open Asset
                    </button>
                    <button type="button" onClick={() => onEditAsset(asset)} className="py-1.5 bg-zinc-900 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-xl text-[11px] font-bold transition-all">
                      ✎ Edit All 15
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

// Blurred Pop-Up Spotlight Window for Team Leader
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
  onToggleSmmLock: (smm: any) => void;
}) {
  const tlSmms = smms.filter((s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id)));
  const tlAssets = assets.filter((a) => a.team_leader_id === tl.id || tlSmms.some((s) => s.id === a.smm_id));
  const tlLogs = metrics.filter((m) => tlAssets.some((a) => a.id === m.asset_id));
  const totalImpr = tlLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
  const totalEng = tlLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black border border-emerald-500/60 rounded-3xl p-5 sm:p-7 space-y-6 shadow-[0_0_95px_-10px_rgba(16,185,129,0.5)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300"
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-4">
          <div>
            <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              🛡️ Team Leader Spotlight Window
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">Commander {tl.full_name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              🌍 Regions: <b className="text-zinc-200">{tl.country}</b> • 👥 Squad: <b className="text-emerald-400">{tlSmms.length} SMMs</b> • 🗂 Assets: <b className="text-purple-300">{tlAssets.length}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEditTl(tl)} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-lg">
              ✎ Edit TL & Assign SMMs
            </button>
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-bold">
              ✕ Close Window
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">SQUAD SMM HANDLERS</span>
            <span className="text-xl font-bold text-emerald-400">{tlSmms.length}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">SQUAD SOCIAL ASSETS</span>
            <span className="text-xl font-bold text-purple-400">{tlAssets.length}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">SQUAD IMPRESSIONS</span>
            <span className="text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          </div>
          <div className="bg-black/80 border border-zinc-800 p-3.5 rounded-2xl font-mono">
            <span className="text-[10px] text-zinc-500 block">SQUAD ENGAGEMENTS</span>
            <span className="text-xl font-bold text-pink-400">{totalEng.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
            👥 Click any SMM Handler below to pop open their SMM Spotlight Window
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tlSmms.map((smm) => {
              const smmAssets = assets.filter((a) => a.smm_id === smm.id);
              const smmLogs = metrics.filter((m) => smmAssets.some((a) => a.id === m.asset_id));
              const sImpr = smmLogs.reduce((s, x) => s + Number(x.impressions || 0), 0);
              const sEng = smmLogs.reduce((s, x) => s + Number(x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => onSelectSmm(smm)}
                  className="group cursor-pointer rounded-2xl p-5 bg-black/90 border border-zinc-800 hover:border-blue-400 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_-10px_rgba(59,130,246,0.45)] space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-white text-lg group-hover:text-blue-300 transition-colors">{smm.full_name}</h4>
                      <p className="text-xs text-zinc-400">🌍 {smm.country}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                      {smmAssets.length} Assets
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 group-hover:border-blue-500/30 text-xs font-mono space-y-1">
                    <div className="flex justify-between"><span className="text-zinc-500">Impressions:</span><span className="text-blue-400 font-bold">{sImpr.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Engagements:</span><span className="text-purple-400 font-bold">{sEng.toLocaleString()}</span></div>
                    <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-900 truncate">SM: {(smm.platforms || ["twitter"]).join(", ").toUpperCase()}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onSelectSmm(smm)} className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-xs font-bold transition-all">
                      🔍 Open SMM Window
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSmmLock(smm)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                    >
                      {smm.is_locked ? "🔒" : "🔓"}
                    </button>
                    <button type="button" onClick={() => onEditSmm(smm)} className="px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold">✎</button>
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
    project_name: asset.project_name || "General Campaign",
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
    tl_campaign: asset.tl_campaign || asset.project_name || "",
    tl_task: asset.tl_task || "",
    tl_comment: asset.tl_comment || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, project_name: form.project_name || form.tl_campaign || "General Campaign" });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-zinc-950 border border-emerald-500/60 rounded-3xl p-4 sm:p-6 space-y-4 shadow-[0_0_80px_rgba(16,185,129,0.35)] max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h3 className="text-lg sm:text-xl font-bold text-white">✎ Edit All 15 Asset Fields — [{(form.platform || "").toUpperCase()}] {form.account_id}</h3>
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-zinc-900 text-xs text-zinc-300 rounded-xl font-bold">✕ Close</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">1. Platform</label>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">2. Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-bold">
              <option value="active">● ACTIVE</option>
              <option value="suspended">⚠ SUSPENDED</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">3. Country</label>
            <select value={form.country_language} onChange={(e) => setForm({ ...form, country_language: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">4. Language</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" required value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} placeholder="5. Asset ID / @Handle" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          <input type="text" value={form.account_password} onChange={(e) => setForm({ ...form, account_password: e.target.value })} placeholder="6. Social Media Password" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono" />
          <input type="url" value={form.profile_link} onChange={(e) => setForm({ ...form, profile_link: e.target.value })} placeholder="7. Profile URL" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-blue-300" />
          <input type="text" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="8. Profile Bio" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="9. Recovery Email" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
          <input type="text" value={form.email_password} onChange={(e) => setForm({ ...form, email_password: e.target.value })} placeholder="10. Email Password" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300 font-mono" />
          <input type="text" value={form.two_fa_code} onChange={(e) => setForm({ ...form, two_fa_code: e.target.value })} placeholder="11. 2FA Secret Key" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-amber-300 font-mono" />
          <input type="text" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="12. Phone Number" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
          <select value={form.team_leader_id || ""} onChange={(e) => setForm({ ...form, team_leader_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
            <option value="">Select Team Leader</option>
            {teamLeaders.map((tl) => <option key={tl.id} value={tl.id}>TL: {tl.full_name}</option>)}
          </select>
          {canReassignSmm && (
            <select value={form.smm_id || ""} onChange={(e) => setForm({ ...form, smm_id: e.target.value })} className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
              <option value="">Unassigned SMM</option>
              {smms.map((s) => <option key={s.id} value={s.id}>SMM: {s.full_name}</option>)}
            </select>
          )}
          <input type="text" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value, tl_campaign: e.target.value })} placeholder="Campaign Name" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-purple-300 font-bold" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" value={form.tl_task} onChange={(e) => setForm({ ...form, tl_task: e.target.value })} placeholder="Campaign Direction / Objectives" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300" />
          <input type="text" value={form.tl_comment} onChange={(e) => setForm({ ...form, tl_comment: e.target.value })} placeholder="Commander / Handler Notes" className="rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-amber-300" />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs">
            {saving ? "Saving..." : "✓ Save All 15 Asset Fields Live"}
          </button>
          {onDelete && (
            <button type="button" onClick={() => onDelete(asset.id)} className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl text-xs">
              🗑 Delete
            </button>
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
  onToggleStatus?: (asset: any, nextStatus: "active" | "suspended") => void;
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
  const previous = assetMetrics.length > 1 ? assetMetrics[assetMetrics.length - 2] : assetMetrics[0] || {};
  const earliest = assetMetrics[0] || {};

  const totalImpr = assetMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = assetMetrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = assetMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const avgEngRate = totalImpr > 0 ? ((totalEng / totalImpr) * 100).toFixed(2) : "0.00";
  const imprDelta = (latest.impressions || 0) - (previous.impressions || 0);
  const folOverallGrowth = (latest.total_followers || 0) - (earliest.total_followers || 0);
  const maxImpr = Math.max(100, ...assetMetrics.map((m) => Number(m.impressions || 0)));

  const ownerSmm = profiles.find((p) => p.id === asset.smm_id);
  const ownerTl = profiles.find((p) => p.id === (asset.team_leader_id || ownerSmm?.team_leader_id));
  const isSuspended = asset.status === "suspended";

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-2 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black border border-purple-500/60 rounded-3xl p-4 sm:p-6 space-y-5 shadow-[0_0_95px_-10px_rgba(168,85,247,0.5)] max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-200 font-bold text-[10px] uppercase">
                🗂 Asset Spotlight • {asset.platform}
              </span>
              <button
                type="button"
                onClick={() => onToggleStatus && onToggleStatus(asset, isSuspended ? "active" : "suspended")}
                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${
                  isSuspended ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                }`}
              >
                <span>{isSuspended ? "⚠ SUSPENDED" : "● ACTIVE"}</span>
                <span>⇄</span>
              </button>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 text-[10px] font-bold">
                🌍 {asset.country_language || "Global"} • 🗣 {asset.language || "English"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">{asset.account_id}</h2>
            {asset.profile_link && <a href={asset.profile_link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">{asset.profile_link}</a>}
          </div>
          <div className="flex items-center gap-2">
            {copiedLabel && <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg font-bold">Copied {copiedLabel}!</span>}
            <button type="button" onClick={() => setRevealSecrets(!revealSecrets)} className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-amber-300 font-bold">
              {revealSecrets ? "🙈 Mask Vault" : "🔓 Reveal Vault"}
            </button>
            {onEdit && (
              <button type="button" onClick={() => { onClose(); onEdit(asset); }} className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold">
                ✎ Edit All 15 Fields
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">✕</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">CUMULATIVE IMPR.</span>
            <span className="text-lg sm:text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
            <span className={`block text-[10px] mt-0.5 ${imprDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>WoW: {imprDelta >= 0 ? `+${imprDelta.toLocaleString()}` : imprDelta.toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">ENGAGEMENTS & RATE</span>
            <span className="text-lg sm:text-xl font-bold text-purple-400">{totalEng.toLocaleString()}</span>
            <span className="block text-[10px] text-emerald-400 mt-0.5">Avg Eng Rate: {avgEngRate}%</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">CURRENT FOLLOWERS</span>
            <span className="text-lg sm:text-xl font-bold text-white">{(latest.total_followers || 0).toLocaleString()}</span>
            <span className={`block text-[10px] mt-0.5 ${folOverallGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>Net Growth: {folOverallGrowth >= 0 ? `+${folOverallGrowth.toLocaleString()}` : folOverallGrowth.toLocaleString()}</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">TOTAL CADENCE</span>
            <span className="text-lg sm:text-xl font-bold text-amber-400">{totalPosts.toLocaleString()} Posts</span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">{assetMetrics.length} Weekly Reports</span>
          </div>
        </div>

        <div className="bg-black border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div onClick={() => copyVal(asset.account_id, "Handle")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">1. ASSET ID</span><span className="text-white font-bold">{asset.account_id || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.account_password, "Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">2. PASSWORD</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>{asset.account_password || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.email, "Email")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">3. EMAIL</span><span className="text-zinc-200 truncate block">{asset.email || "N/A"}</span></div>
            <div onClick={() => copyVal(asset.email_password, "Email Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">4. EMAIL PASS</span><span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>{asset.email_password || "N/A"}</span></div>
            <div onClick={() => copyVal(live2fa, "2FA Code")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">5. LIVE 2FA ({totpSec}s)</span><span className="text-amber-300 font-bold">{asset.two_fa_code ? live2fa : "None"}</span></div>
            <div onClick={() => copyVal(asset.phone_number, "Phone")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">6. PHONE</span><span className="text-zinc-200">{asset.phone_number || "N/A"}</span></div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">7. COUNTRY & LANG</span><span className="text-white">{asset.country_language || "N/A"} • {asset.language || "English"}</span></div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">8. HANDLER & TL</span><span className="text-blue-300">{ownerSmm?.full_name || "Unassigned"}</span>{ownerTl && <span className="text-zinc-500"> ({ownerTl.full_name})</span>}</div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"><span className="text-[10px] text-zinc-500 block">9. CAMPAIGN</span><span className="text-purple-300 font-bold">{asset.project_name || asset.tl_campaign || "General"}</span></div>
          </div>
        </div>

        {assetMetrics.length > 0 && (
          <div className="bg-black border border-zinc-900 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase text-cyan-400">📊 Weekly Impressions & Follower Growth Trajectory</h4>
            {assetMetrics.slice(-6).map((m) => {
              const pct = Math.min(100, Math.max(6, Math.round(((m.impressions || 0) / maxImpr) * 100)));
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-300 font-bold">{m.week_of}</span>
                    <span className="text-blue-400">{(m.impressions || 0).toLocaleString()} Impr • {(m.engagements || 0).toLocaleString()} Eng</span>
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

export function ExecutiveAnalyticsGraphs({
  assets,
  metrics,
  onSelectAsset,
  titlePrefix = "Enterprise",
}: {
  assets: any[];
  metrics: any[];
  profiles?: any[];
  onSelectAsset?: (asset: any) => void;
  titlePrefix?: string;
}) {
  const assetIdSet = new Set(assets.map((a) => a.id));
  const scopedMetrics = metrics.filter((m) => assetIdSet.has(m.asset_id));

  const totalImpr = scopedMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = scopedMetrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = scopedMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const netFollowers = scopedMetrics.reduce((s, m) => s + (Number(m.followers_gained || 0) - Number(m.followers_lost || 0)), 0);
  const avgEngRate = totalImpr > 0 ? ((totalEng / totalImpr) * 100).toFixed(2) : "0.00";

  const weekMap = new Map<string, { week: string; impr: number; eng: number }>();
  for (const m of scopedMetrics) {
    const w = m.week_of || "Unknown";
    if (!weekMap.has(w)) weekMap.set(w, { week: w, impr: 0, eng: 0 });
    weekMap.get(w)!.impr += Number(m.impressions || 0);
    weekMap.get(w)!.eng += Number(m.engagements || 0);
  }
  const weeklySeries = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week)).slice(-8);
  const maxWeekImpr = Math.max(100, ...weeklySeries.map((w) => w.impr));

  const platformStats = PLATFORMS.map((plat) => {
    const platAssets = assets.filter((a) => a.platform === plat);
    const platIds = new Set(platAssets.map((a) => a.id));
    const impr = scopedMetrics.filter((m) => platIds.has(m.asset_id)).reduce((s, m) => s + Number(m.impressions || 0), 0);
    return { platform: plat, assetCount: platAssets.length, impr };
  }).filter((p) => p.assetCount > 0 || p.impr > 0);
  const maxPlatImpr = Math.max(100, ...platformStats.map((p) => p.impr));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono"><span className="text-[10px] text-zinc-500 block">TOTAL IMPRESSIONS</span><span className="text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono"><span className="text-[10px] text-zinc-500 block">ENGAGEMENTS ({avgEngRate}%)</span><span className="text-xl font-bold text-purple-400">{totalEng.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono"><span className="text-[10px] text-zinc-500 block">NET FOLLOWERS</span><span className="text-xl font-bold text-emerald-400">{netFollowers >= 0 ? `+${netFollowers.toLocaleString()}` : netFollowers.toLocaleString()}</span></div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono"><span className="text-[10px] text-zinc-500 block">TOTAL POSTS</span><span className="text-xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-cyan-400">📈 {titlePrefix} Weekly Trajectory</h3>
          {weeklySeries.map((w) => (
            <div key={w.week} className="space-y-1">
              <div className="flex justify-between text-xs font-mono"><span className="text-white font-bold">{w.week}</span><span className="text-blue-400">{w.impr.toLocaleString()} Impr • {w.eng.toLocaleString()} Eng</span></div>
              <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${Math.min(100, Math.max(5, Math.round((w.impr / maxWeekImpr) * 100)))}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-purple-400">🌐 Platform Reach Breakdown</h3>
          {platformStats.map((p) => (
            <div key={p.platform} className="space-y-1">
              <div className="flex justify-between text-xs font-mono"><span className="text-white font-bold uppercase">{p.platform} ({p.assetCount} Assets)</span><span className="text-purple-300">{p.impr.toLocaleString()} Impr</span></div>
              <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full" style={{ width: `${Math.min(100, Math.max(5, Math.round((p.impr / maxPlatImpr) * 100)))}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Archives Component with Date & Time Filter + Suspended Asset Tracking
export function ForensicArchiveVault({
  logs,
  onRestore,
}: {
  logs: any[];
  onRestore: (log: any) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl animate-in fade-in duration-300">
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
            Real-Time Forensic Ledger
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">🗄 Archives ({filtered.length} Events)</h2>
        </div>
      </div>

      {/* Date & Time Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/80 border border-zinc-800 p-3.5 rounded-2xl">
        <div>
          <label className="text-[10px] uppercase font-bold text-amber-400 block mb-1">📅 From Date & Time</label>
          <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-amber-400 block mb-1">📅 To Date & Time</label>
          <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
        </div>
        <div className="flex items-end gap-2">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search handle, actor, status..." className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-xs text-white" />
          {(startDateTime || endDateTime || search) && (
            <button type="button" onClick={() => { setStartDateTime(""); setEndDateTime(""); setSearch(""); }} className="px-3 py-2 rounded-xl bg-zinc-900 text-xs text-amber-400 font-bold">Reset</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["ALL", "ASSET", "EMPLOYEE", "METRIC"].map((t) => (
          <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${typeFilter === t ? "bg-amber-500 text-black border-amber-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{t}</button>
        ))}
        {["ALL", "SUSPENDED", "ACTIVE", "UPDATE", "CREATE", "DELETE"].map((act) => (
          <button key={act} type="button" onClick={() => setActionFilter(act)} className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${actionFilter === act ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{act}</button>
        ))}
      </div>

      <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
        {filtered.map((log) => {
          const isOpen = expandedId === log.id;
          const snap = log.record_snapshot?.before || log.record_snapshot || {};
          const isSusp = log.action === "SUSPENDED" || snap?.status === "suspended";

          return (
            <div key={log.id} className={`rounded-2xl border transition-all ${isSusp ? "bg-red-950/20 border-red-500/50" : "bg-black/70 border-zinc-900"}`}>
              <div onClick={() => setExpandedId(isOpen ? null : log.id)} className="cursor-pointer p-3.5 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSusp ? "bg-red-500 text-black" : "bg-emerald-500/20 text-emerald-300"}`}>
                    {log.entity_type} • {log.action}
                  </span>
                  <span className="text-xs font-bold text-white">{log.summary}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-400">{log.actor_name} • {log.created_at ? new Date(log.created_at).toLocaleString() : "Live"}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onRestore(log); }} className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">♻ Restore</button>
                </div>
              </div>
              {isOpen && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-950 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {Object.entries(snap).map(([k, v]) => (
                    <div key={k} className="bg-black border border-zinc-900 p-2 rounded-xl break-all">
                      <span className="text-[10px] text-zinc-500 uppercase block">{k}</span>
                      <span className="text-zinc-200 font-bold">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
      setTopic("");
      setDirection("");
      onSuccess(`🎯 Dispatched "${topic}" to ${data.count} matching assets!`);
    }
  };

  return (
    <form onSubmit={handleDispatch} className="max-w-3xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-300">
      <h2 className="text-xl sm:text-2xl font-bold text-white">🎯 Give Campaign Dispatcher</h2>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {PLATFORMS.map((p) => (
          <button type="button" key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)} className={`py-2.5 rounded-xl text-xs font-bold uppercase border ${selectedPlatforms.includes(p) ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>{p}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setTargetMode("tl")} className={`py-3 rounded-xl text-xs font-bold border ${targetMode === "tl" ? "bg-blue-600 text-white border-blue-400" : "bg-black border-zinc-800 text-zinc-400"}`}>🛡️ Give to Team Leaders ({matchingTls.length})</button>
        <button type="button" onClick={() => setTargetMode("smm")} className={`py-3 rounded-xl text-xs font-bold border ${targetMode === "smm" ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400"}`}>👤 Give Directly to SMMs ({matchingSmms.length})</button>
      </div>
      {targetMode === "tl" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {matchingTls.map((tl) => (
            <button type="button" key={tl.id} onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)} className={`p-3 rounded-xl border text-left text-xs font-bold ${selectedTlIds.includes(tl.id) ? "bg-blue-600/30 border-blue-400 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}>✓ Commander {tl.full_name}</button>
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
      <button type="submit" disabled={submitting} className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl text-sm">🚀 Dispatch Campaign Live</button>
    </form>
  );
}
