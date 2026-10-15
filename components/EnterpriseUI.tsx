"use client";

import { useState, useEffect } from "react";
import { PLATFORMS, computeLive2FACode } from "@/lib/constants";

// Fancy Multi-Select Dropdown for Strings (Countries, Platforms, etc.)
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
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">
            Clear
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-purple-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all"
      >
        <div className="flex flex-wrap gap-1 truncate">
          {selected.length > 0 ? (
            selected.slice(0, 4).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-bold">
                {s}
              </span>
            ))
          ) : (
            <span className="text-zinc-500">Tap to select...</span>
          )}
          {selected.length > 4 && (
            <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">
              +{selected.length - 4} more
            </span>
          )}
        </div>
        <span className="text-zinc-400 text-[10px] shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2 z-50">
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
                  className={`text-left px-2.5 py-2 rounded-lg text-[11px] font-bold truncate border transition-all ${
                    active
                      ? "bg-purple-600/30 border-purple-500 text-white shadow-sm"
                      : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700"
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

// Fancy Multi-Select Dropdown for Relational Objects (SMMs, Team Leaders, Social Media Assets)
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

  const filtered = items.filter(
    (it) =>
      it.label.toLowerCase().includes(filter.toLowerCase()) ||
      (it.sub || "").toLowerCase().includes(filter.toLowerCase())
  );

  const selectedLabels = items.filter((it) => selectedIds.includes(it.id));

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] uppercase font-bold text-zinc-400">
          {label} <span className="text-blue-400">({selectedIds.length} assigned)</span>
        </label>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(items.map((i) => i.id))}
              className="text-[10px] text-blue-400 hover:underline"
            >
              Select All
            </button>
          )}
          {selectedIds.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">
              Clear
            </button>
          )}
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
              <span key={it.id} className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-200 text-[10px] font-bold">
                {it.label}
              </span>
            ))
          ) : (
            <span className="text-zinc-500">Tap to assign...</span>
          )}
          {selectedLabels.length > 3 && (
            <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 text-[10px] font-bold">
              +{selectedLabels.length - 3} more
            </span>
          )}
        </div>
        <span className="text-zinc-400 text-[10px] shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1.5 w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2 z-50">
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
                  className={`text-left px-3 py-2 rounded-lg text-xs border transition-all flex justify-between items-center ${
                    active
                      ? "bg-blue-600/30 border-blue-500 text-white font-bold"
                      : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="truncate">
                    <div className="truncate">{active ? "✓ " : ""}{it.label}</div>
                    {it.sub && <div className="text-[10px] text-zinc-500 truncate">{it.sub}</div>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-3 text-xs text-zinc-500">No matching items found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Complete Asset Details, Credentials & Growth Trajectory Modal
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
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [asset]);

  const copyVal = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(""), 2000);
  };

  const assetMetrics = metrics
    .filter((m) => m.asset_id === asset.id)
    .sort((a, b) => a.week_of.localeCompare(b.week_of));

  const latest = assetMetrics[assetMetrics.length - 1] || {};
  const previous = assetMetrics.length > 1 ? assetMetrics[assetMetrics.length - 2] : assetMetrics[0] || {};
  const earliest = assetMetrics[0] || {};

  const totalImpr = assetMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = assetMetrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalLikes = assetMetrics.reduce((s, m) => s + Number(m.likes || 0), 0);
  const totalReposts = assetMetrics.reduce((s, m) => s + Number(m.shares_reposts || 0), 0);
  const totalComments = assetMetrics.reduce((s, m) => s + Number(m.comments || 0), 0);
  const totalPosts = assetMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);

  const avgEngRate = totalImpr > 0 ? ((totalEng / totalImpr) * 100).toFixed(2) : "0.00";
  const imprDelta = (latest.impressions || 0) - (previous.impressions || 0);
  const folOverallGrowth = (latest.total_followers || 0) - (earliest.total_followers || 0);
  const maxImpr = Math.max(100, ...assetMetrics.map((m) => Number(m.impressions || 0)));

  const ownerSmm = profiles.find((p) => p.id === asset.smm_id);
  const ownerTl = profiles.find((p) => p.id === (asset.team_leader_id || ownerSmm?.team_leader_id));
  const isSuspended = asset.status === "suspended";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-zinc-950 border border-purple-500/50 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-200 font-bold text-[10px] uppercase">
                {asset.platform}
              </span>
              <div className="flex items-center gap-1 bg-black px-2.5 py-0.5 rounded-full border border-zinc-800 text-[10px] font-bold">
                <span className={isSuspended ? "text-red-400" : "text-emerald-400"}>
                  {isSuspended ? "⚠ SUSPENDED" : "● ACTIVE"}
                </span>
                {onToggleStatus && (
                  <button
                    type="button"
                    onClick={() => onToggleStatus(asset, isSuspended ? "active" : "suspended")}
                    className="ml-1 w-4 h-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[9px] flex items-center justify-center"
                    title="Toggle Active / Suspended"
                  >
                    ⇄
                  </button>
                )}
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 text-[10px] font-bold">
                🌍 {asset.country_language || "Global"} • 🗣 {asset.language || "English"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">{asset.account_id}</h2>
            {asset.profile_link && (
              <a href={asset.profile_link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">
                {asset.profile_link}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {copiedLabel && (
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg font-bold">
                Copied {copiedLabel}!
              </span>
            )}
            <button
              type="button"
              onClick={() => setRevealSecrets(!revealSecrets)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-amber-300 font-bold"
            >
              {revealSecrets ? "🙈 Mask Secrets" : "🔓 Reveal Vault"}
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(asset);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold"
              >
                ✎ Edit Asset
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">
              ✕
            </button>
          </div>
        </div>

        {/* Growth KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">CUMULATIVE IMPR.</span>
            <span className="text-lg sm:text-xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
            <span className={`block text-[10px] mt-0.5 ${imprDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              WoW: {imprDelta >= 0 ? `+${imprDelta.toLocaleString()}` : imprDelta.toLocaleString()}
            </span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">ENGAGEMENTS & RATE</span>
            <span className="text-lg sm:text-xl font-bold text-purple-400">{totalEng.toLocaleString()}</span>
            <span className="block text-[10px] text-emerald-400 mt-0.5">Avg Eng Rate: {avgEngRate}%</span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">CURRENT FOLLOWERS</span>
            <span className="text-lg sm:text-xl font-bold text-white">{(latest.total_followers || 0).toLocaleString()}</span>
            <span className={`block text-[10px] mt-0.5 ${folOverallGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              Net Growth: {folOverallGrowth >= 0 ? `+${folOverallGrowth.toLocaleString()}` : folOverallGrowth.toLocaleString()}
            </span>
          </div>
          <div className="bg-black p-3.5 rounded-2xl border border-zinc-900 font-mono">
            <span className="text-[10px] text-zinc-500 block">ACTIVITY CADENCE</span>
            <span className="text-lg sm:text-xl font-bold text-amber-400">{totalPosts.toLocaleString()} Posts</span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">
              ♥ {totalLikes} • ↻ {totalReposts} • 💬 {totalComments}
            </span>
          </div>
        </div>

        {/* Complete 12-Field Asset Credential & Assignment Vault */}
        <div className="bg-black border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-purple-400">🔐 Complete Asset Details & Credential Vault</h3>
            <span className="text-[10px] text-zinc-500">Tap any credential to copy</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div onClick={() => copyVal(asset.account_id, "Handle")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">1. ASSET ID / HANDLE</span>
              <span className="text-white font-bold">{asset.account_id || "N/A"}</span>
            </div>
            <div onClick={() => copyVal(asset.account_password, "Asset Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">2. ASSET PASSWORD</span>
              <span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>
                {asset.account_password || "N/A"}
              </span>
            </div>
            <div onClick={() => copyVal(asset.email, "Asset Email")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">3. RECOVERY EMAIL</span>
              <span className="text-zinc-200 truncate block">{asset.email || "N/A"}</span>
            </div>
            <div onClick={() => copyVal(asset.email_password, "Email Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">4. EMAIL PASSWORD</span>
              <span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>
                {asset.email_password || "N/A"}
              </span>
            </div>
            <div onClick={() => copyVal(live2fa, "2FA Code")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">5. LIVE 2FA / TOTP ({totpSec}s)</span>
              <span className="text-amber-300 font-bold">{asset.two_fa_code ? live2fa : "None"}</span>
            </div>
            <div onClick={() => copyVal(asset.phone_number, "Phone")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-zinc-700">
              <span className="text-[10px] text-zinc-500 block">6. PHONE NUMBER</span>
              <span className="text-zinc-200">{asset.phone_number || "N/A"}</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block">7. COUNTRY & LANGUAGE</span>
              <span className="text-white">{asset.country_language || "N/A"} • {asset.language || "English"}</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block">8. ASSIGNED HANDLER & TL</span>
              <span className="text-blue-300">{ownerSmm?.full_name || "Unassigned"}</span>
              {ownerTl && <span className="text-zinc-500"> (TL: {ownerTl.full_name})</span>}
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block">9. ACTIVE CAMPAIGN</span>
              <span className="text-purple-300 font-bold">{asset.project_name || asset.tl_campaign || "General Campaign"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Asset Profile Bio</span>
              <p className="text-zinc-300 mt-0.5 italic">{asset.bio || "No bio recorded."}</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Active Campaign Direction & Objectives</span>
              <p className="text-zinc-200">{asset.tl_task || "No active campaign direction assigned yet."}</p>
              {asset.tl_comment && <p className="text-[11px] text-amber-300">💬 {asset.tl_comment}</p>}
            </div>
          </div>
        </div>

        {/* Visual Trajectory Bar Graph */}
        {assetMetrics.length > 0 && (
          <div className="bg-black border border-zinc-900 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase text-cyan-400">📊 Weekly Impressions & Follower Growth Trajectory</h4>
            <div className="space-y-2">
              {assetMetrics.slice(-8).map((m) => {
                const pct = Math.min(100, Math.max(6, Math.round(((m.impressions || 0) / maxImpr) * 100)));
                const netFol = (m.followers_gained || 0) - (m.followers_lost || 0);
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-300 font-bold">{m.week_of}</span>
                      <span className="text-blue-400">
                        {(m.impressions || 0).toLocaleString()} Impr • {(m.engagements || 0).toLocaleString()} Eng •{" "}
                        <b className={netFol >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {netFol >= 0 ? `+${netFol}` : netFol} Fol
                        </b>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Weekly Ledger Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase text-zinc-400">
            Weekly Performance Ledger ({assetMetrics.length} Reports)
          </h4>
          <div className="max-h-52 overflow-y-auto border border-zinc-900 rounded-2xl">
            <table className="w-full text-left text-xs font-mono text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                <tr>
                  <th className="p-2.5">Week Of</th>
                  <th className="p-2.5">Impr</th>
                  <th className="p-2.5">Eng</th>
                  <th className="p-2.5">Likes/Rep/Com</th>
                  <th className="p-2.5">Net Fol</th>
                  <th className="p-2.5">Total Fol</th>
                  <th className="p-2.5">Posts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 bg-black">
                {[...assetMetrics].reverse().map((m) => {
                  const net = (m.followers_gained || 0) - (m.followers_lost || 0);
                  return (
                    <tr key={m.id}>
                      <td className="p-2.5 text-white font-bold">{m.week_of}</td>
                      <td className="p-2.5 text-blue-400">{(m.impressions || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-purple-400">{(m.engagements || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-zinc-400">
                        {m.likes || 0}/{m.shares_reposts || 0}/{m.comments || 0}
                      </td>
                      <td className={`p-2.5 font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {net >= 0 ? `+${net}` : net}
                      </td>
                      <td className="p-2.5 text-white">{(m.total_followers || 0).toLocaleString()}</td>
                      <td className="p-2.5">{m.posts_published || 0}</td>
                    </tr>
                  );
                })}
                {assetMetrics.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-zinc-500">
                      No weekly reports logged for this Asset yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Interactive Multi-Step Campaign Dispatch Wizard (Shared by Admin & Team Leader)
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

  // Filter SMMs who manage at least one of the requested platforms (via profile platforms OR registered assets)
  const matchingSmms = smms.filter((s) => {
    const smmProfs: string[] = s.platforms || [];
    const smmAssetPlats = assets.filter((a) => a.smm_id === s.id).map((a) => a.platform);
    return selectedPlatforms.some((p) => smmProfs.includes(p) || smmAssetPlats.includes(p));
  });

  // Filter Team Leaders who have SMMs managing those requested platforms (or assets on those platforms)
  const matchingTls = teamLeaders.filter((tl) => {
    const tlSmms = matchingSmms.filter(
      (s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id))
    );
    const directTlAssets = assets.filter(
      (a) => a.team_leader_id === tl.id && selectedPlatforms.includes(a.platform)
    );
    return tlSmms.length > 0 || directTlAssets.length > 0;
  });

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) return alert("Select at least one Social Media platform.");
    if (targetMode === "tl" && selectedTlIds.length === 0) return alert("Select at least one Team Leader.");
    if (targetMode === "smm" && selectedSmmIds.length === 0) return alert("Select at least one SMM Handler.");
    if (!topic.trim() || !direction.trim()) return alert("Enter Campaign Topic and Direction.");

    setSubmitting(true);
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId,
        entity: "campaign",
        action: "dispatch",
        payload: {
          platforms: selectedPlatforms,
          targetMode,
          targetTlIds: selectedTlIds,
          targetSmmIds: selectedSmmIds,
          topic: topic.trim(),
          direction: direction.trim(),
        },
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setTopic("");
      setDirection("");
      onSuccess(`🎯 Campaign "${topic}" dispatched live to ${data.count} matching social media assets!`);
    } else {
      alert(data.error || "Failed to dispatch campaign.");
    }
  };

  return (
    <form onSubmit={handleDispatch} className="max-w-3xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
      <div className="border-b border-zinc-800 pb-4">
        <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
          Interactive Campaign Dispatcher
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">🎯 Give Campaign to Squads or SMMs</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Select target social platforms, choose Team Leaders or specific SMMs managing those platforms, and push key campaign objectives live.
        </p>
      </div>

      {/* STEP 1: SELECT SOCIAL MEDIA PLATFORMS */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-purple-300 block">
          Step 1: Which Social Media Platform(s) is this Campaign for? (Multiple allowed)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p);
            return (
              <button
                type="button"
                key={p}
                onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition-all ${
                  active
                    ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.35)]"
                    : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {active ? "✓ " : ""}{p}
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: CHOOSE TARGET MODE (TLs vs SMMs DIRECTLY) */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-blue-300 block">
          Step 2: Give Campaign to Team Leaders or Directly to SMMs?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setTargetMode("tl")}
            className={`py-3 px-4 rounded-xl text-xs font-bold border text-left transition-all ${
              targetMode === "tl"
                ? "bg-blue-600/25 border-blue-400 text-white"
                : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <div className="text-sm">🛡️ Give to Team Leader(s)</div>
            <div className="text-[11px] text-zinc-400 font-normal mt-0.5">
              Shows TLs who have SMMs managing {selectedPlatforms.join(", ").toUpperCase()} ({matchingTls.length} matching TLs)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("smm")}
            className={`py-3 px-4 rounded-xl text-xs font-bold border text-left transition-all ${
              targetMode === "smm"
                ? "bg-purple-600/25 border-purple-400 text-white"
                : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <div className="text-sm">👤 Give Directly to SMM Handler(s)</div>
            <div className="text-[11px] text-zinc-400 font-normal mt-0.5">
              Shows SMMs managing {selectedPlatforms.join(", ").toUpperCase()} ({matchingSmms.length} matching SMMs)
            </div>
          </button>
        </div>
      </div>

      {/* STEP 3: SELECT SPECIFIC TLs OR SMMs */}
      {targetMode === "tl" ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-emerald-400">
              Step 3: Select Team Leader(s) Managing {selectedPlatforms.join(", ").toUpperCase()} ({selectedTlIds.length} selected)
            </label>
            <button
              type="button"
              onClick={() => setSelectedTlIds(matchingTls.map((t) => t.id))}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Select All Matching TLs
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 bg-black rounded-2xl border border-zinc-900">
            {matchingTls.map((tl) => {
              const active = selectedTlIds.includes(tl.id);
              const tlMatchingSmms = matchingSmms.filter(
                (s) => s.team_leader_id === tl.id || (s.team_leader_ids && s.team_leader_ids.includes(tl.id))
              );
              return (
                <button
                  type="button"
                  key={tl.id}
                  onClick={() => toggleItem(tl.id, selectedTlIds, setSelectedTlIds)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? "bg-blue-600/30 border-blue-400 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {active ? "✓ " : ""}Commander {tl.full_name}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {tlMatchingSmms.length} matching SMMs • {tl.country}
                  </div>
                </button>
              );
            })}
            {matchingTls.length === 0 && (
              <div className="col-span-3 text-center py-4 text-xs text-zinc-500">
                No Team Leaders currently have SMMs assigned to {selectedPlatforms.join(", ").toUpperCase()}.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-emerald-400">
              Step 3: Select SMM Handler(s) Managing {selectedPlatforms.join(", ").toUpperCase()} ({selectedSmmIds.length} selected)
            </label>
            <button
              type="button"
              onClick={() => setSelectedSmmIds(matchingSmms.map((s) => s.id))}
              className="text-[11px] text-purple-400 hover:underline"
            >
              Select All Matching SMMs
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 bg-black rounded-2xl border border-zinc-900">
            {matchingSmms.map((s) => {
              const active = selectedSmmIds.includes(s.id);
              const count = assets.filter((a) => a.smm_id === s.id && selectedPlatforms.includes(a.platform)).length;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleItem(s.id, selectedSmmIds, setSelectedSmmIds)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? "bg-purple-600/30 border-purple-400 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {active ? "✓ " : ""}{s.full_name}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {count} matching Assets • {s.country}
                  </div>
                </button>
              );
            })}
            {matchingSmms.length === 0 && (
              <div className="col-span-3 text-center py-4 text-xs text-zinc-500">
                No SMM Handlers found for {selectedPlatforms.join(", ").toUpperCase()}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4 & 5: TOPIC & DIRECTION */}
      <div className="space-y-3 pt-2 border-t border-zinc-800">
        <div>
          <label className="text-xs font-bold uppercase text-zinc-300 block mb-1">
            Step 4: Campaign Topic / Title
          </label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Q4 Regional Awareness Surge"
            className="w-full rounded-xl bg-black border border-zinc-800 focus:border-purple-500 p-3.5 text-xs text-white outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-zinc-300 block mb-1">
            Step 5: Campaign Direction (Key Points, Objectives, Hashtags & Instructions)
          </label>
          <textarea
            rows={4}
            required
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="Write the exact campaign objectives, key talking points, required hashtags, and posting cadence..."
            className="w-full rounded-xl bg-black border border-zinc-800 focus:border-purple-500 p-3.5 text-xs text-white outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm shadow-xl transition-all"
      >
        {submitting ? "Dispatching Campaign..." : "🚀 Dispatch Campaign Live"}
      </button>
    </form>
  );
}
