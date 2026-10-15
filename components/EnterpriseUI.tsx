"use client";

import { useState, useEffect } from "react";
import {
  PLATFORMS,
  ALL_COUNTRIES,
  ASSET_LANGUAGES,
  computeLive2FACode,
} from "@/lib/constants";

// 1. Fancy Multi-Select Dropdown for Strings (Countries, Platforms)
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
          <button type="button" onClick={() => onChange([...options])} className="text-[10px] text-purple-400 hover:underline">
            All
          </button>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-[10px] text-zinc-500 hover:text-red-400">
              Clear
            </button>
          )}
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
        <span className={`text-zinc-400 text-[10px] transition-transform duration-300 ${open ? "rotate-180 text-purple-400" : ""}`}>▼</span>
      </button>

      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
        <div className="overflow-hidden">
          <div className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2">
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
                      active
                        ? "bg-purple-600/30 border-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                        : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {active ? "✓ " : ""}{opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Fancy Multi-Select Dropdown for Relational Entities (SMMs, Team Leaders, Assets)
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
            <button type="button" onClick={() => onChange(items.map((i) => i.id))} className="text-[10px] text-blue-400 hover:underline">
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
        className="w-full min-h-[42px] text-left bg-black border border-zinc-800 hover:border-blue-500/50 rounded-xl px-3 py-2.5 text-xs text-zinc-200 flex justify-between items-center gap-2 transition-all duration-300"
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
        <span className={`text-zinc-400 text-[10px] transition-transform duration-300 ${open ? "rotate-180 text-blue-400" : ""}`}>▼</span>
      </button>

      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
        <div className="overflow-hidden">
          <div className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl space-y-2">
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
                      active
                        ? "bg-blue-600/30 border-blue-500 text-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                        : "bg-black border-zinc-800/80 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div className="truncate">{active ? "✓ " : ""}{it.label}</div>
                    {it.sub && <div className="text-[10px] text-zinc-500 truncate">{it.sub}</div>}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-3 text-xs text-zinc-500">No matching items found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Universal 15-Field Asset Editor Modal (Edits Every Single Detail of an Asset)
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
    await onSave({
      ...form,
      project_name: form.project_name || form.tl_campaign || "General Campaign",
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-zinc-950 border border-emerald-500/50 rounded-3xl p-4 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.2)] max-h-[92vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
              Complete 15-Field Asset Vault Editor
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
              ✎ Edit Every Detail — [{(form.platform || "").toUpperCase()}] {form.account_id}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-xl font-bold">
            ✕ Close
          </button>
        </div>

        {/* Row 1: Platform, Status, Country, Language */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">1. Platform (SM Type)</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white uppercase outline-none"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">2. Operational Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white font-bold outline-none"
            >
              <option value="active">● ACTIVE</option>
              <option value="suspended">⚠ SUSPENDED</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">3. Target Country</label>
            <select
              value={form.country_language}
              onChange={(e) => setForm({ ...form, country_language: e.target.value })}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            >
              {ALL_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">4. Operating Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            >
              {ASSET_LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Handle, Password, Profile Link, Bio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">5. Asset ID / @Handle</label>
            <input
              type="text"
              required
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              placeholder="@Handle or Username"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">6. Social Media Login Password</label>
            <input
              type="text"
              value={form.account_password}
              onChange={(e) => setForm({ ...form, account_password: e.target.value })}
              placeholder="Account Password"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-emerald-300 font-mono outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">7. Profile URL Link</label>
            <input
              type="url"
              value={form.profile_link}
              onChange={(e) => setForm({ ...form, profile_link: e.target.value })}
              placeholder="https://x.com/handle"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-blue-300 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">8. Asset Bio</label>
            <input
              type="text"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Bio written on profile"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Row 3: Recovery Email, Email Pass, 2FA, Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">9. Recovery Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@domain.com"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">10. Email Password</label>
            <input
              type="text"
              value={form.email_password}
              onChange={(e) => setForm({ ...form, email_password: e.target.value })}
              placeholder="Email Password"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-emerald-300 font-mono outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">11. 2FA Secret / Backup Key</label>
            <input
              type="text"
              value={form.two_fa_code}
              onChange={(e) => setForm({ ...form, two_fa_code: e.target.value })}
              placeholder="2FA Key"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-amber-300 font-mono outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">12. Linked Phone Number</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="+..."
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 focus:border-emerald-500 p-2.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Row 4: Ownership & Campaign Directives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">13. Assigned Team Leader</label>
            <select
              value={form.team_leader_id || ""}
              onChange={(e) => setForm({ ...form, team_leader_id: e.target.value })}
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
            >
              <option value="">Select Team Leader</option>
              {teamLeaders.map((tl) => (
                <option key={tl.id} value={tl.id}>Commander {tl.full_name}</option>
              ))}
            </select>
          </div>
          {canReassignSmm && (
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">14. Assigned SMM Handler</label>
              <select
                value={form.smm_id || ""}
                onChange={(e) => setForm({ ...form, smm_id: e.target.value })}
                className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
              >
                <option value="">Unassigned SMM</option>
                {smms.map((s) => (
                  <option key={s.id} value={s.id}>SMM: {s.full_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={canReassignSmm ? "" : "sm:col-span-2"}>
            <label className="text-[10px] uppercase font-bold text-zinc-400">15. Active Campaign / Project Name</label>
            <input
              type="text"
              value={form.project_name}
              onChange={(e) => setForm({ ...form, project_name: e.target.value, tl_campaign: e.target.value })}
              placeholder="Campaign Name"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-purple-300 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Campaign Direction / Objectives</label>
            <input
              type="text"
              value={form.tl_task}
              onChange={(e) => setForm({ ...form, tl_task: e.target.value })}
              placeholder="Key talking points & objectives"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-emerald-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400">Commander / Handler Notes</label>
            <input
              type="text"
              value={form.tl_comment}
              onChange={(e) => setForm({ ...form, tl_comment: e.target.value })}
              placeholder="Notes on this asset"
              className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-amber-300"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-800">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {saving ? "Saving All Asset Fields..." : "✓ Save All 15 Asset Fields Live"}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(asset.id)}
              className="px-5 py-3 bg-red-500/15 hover:bg-red-500 hover:text-black border border-red-500/30 text-red-400 font-bold rounded-xl text-xs transition-all"
            >
              🗑 Delete Asset
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// 4. Complete Asset Growth & Credential Inspector Modal
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-zinc-950 border border-purple-500/50 rounded-3xl p-4 sm:p-6 space-y-5 shadow-[0_0_60px_rgba(168,85,247,0.25)] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap justify-between items-start border-b border-zinc-800 pb-4 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-200 font-bold text-[10px] uppercase">
                {asset.platform}
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
              {revealSecrets ? "🙈 Mask Vault" : "🔓 Reveal Vault"}
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(asset);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-md"
              >
                ✎ Edit All 15 Fields
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-300 font-bold">
              ✕
            </button>
          </div>
        </div>

        {/* KPI Growth Strip */}
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
            <span className="text-[10px] text-zinc-500 block">TOTAL CADENCE</span>
            <span className="text-lg sm:text-xl font-bold text-amber-400">{totalPosts.toLocaleString()} Posts</span>
            <span className="block text-[10px] text-zinc-400 mt-0.5">
              ♥ {totalLikes} • ↻ {totalReposts} • 💬 {totalComments}
            </span>
          </div>
        </div>

        {/* Complete 9+ Credential Vault */}
        <div className="bg-black border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-purple-400">🔐 Complete Asset Details & Credential Vault</h3>
            <span className="text-[10px] text-zinc-500">Tap any box to copy to clipboard</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div onClick={() => copyVal(asset.account_id, "Handle")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">1. ASSET ID / HANDLE</span>
              <span className="text-white font-bold">{asset.account_id || "N/A"}</span>
            </div>
            <div onClick={() => copyVal(asset.account_password, "Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">2. ASSET PASSWORD</span>
              <span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>
                {asset.account_password || "N/A"}
              </span>
            </div>
            <div onClick={() => copyVal(asset.email, "Email")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">3. RECOVERY EMAIL</span>
              <span className="text-zinc-200 truncate block">{asset.email || "N/A"}</span>
            </div>
            <div onClick={() => copyVal(asset.email_password, "Email Password")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">4. EMAIL PASSWORD</span>
              <span className={revealSecrets ? "text-emerald-400 font-bold" : "blur-[4px] select-none"}>
                {asset.email_password || "N/A"}
              </span>
            </div>
            <div onClick={() => copyVal(live2fa, "2FA Code")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">5. LIVE 2FA / TOTP ({totpSec}s)</span>
              <span className="text-amber-300 font-bold">{asset.two_fa_code ? live2fa : "None"}</span>
            </div>
            <div onClick={() => copyVal(asset.phone_number, "Phone")} className="cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl hover:border-purple-500/40 transition-all">
              <span className="text-[10px] text-zinc-500 block">6. PHONE NUMBER</span>
              <span className="text-zinc-200">{asset.phone_number || "N/A"}</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block">7. COUNTRY & LANGUAGE</span>
              <span className="text-white">{asset.country_language || "N/A"} • {asset.language || "English"}</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl">
              <span className="text-[10px] text-zinc-500 block">8. ASSIGNED SMM & TL</span>
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
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Campaign Direction & Notes</span>
              <p className="text-zinc-200">{asset.tl_task || "No active campaign direction assigned yet."}</p>
              {asset.tl_comment && <p className="text-[11px] text-amber-300">💬 {asset.tl_comment}</p>}
            </div>
          </div>
        </div>

        {/* Trajectory Bars */}
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
                      <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 5. Comprehensive Summary Graphs Suite (Used by Admin, Team Leader, and SMM)
export function ExecutiveAnalyticsGraphs({
  assets,
  metrics,
  profiles = [],
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
  const netFollowers = scopedMetrics.reduce(
    (s, m) => s + (Number(m.followers_gained || 0) - Number(m.followers_lost || 0)),
    0
  );
  const avgEngRate = totalImpr > 0 ? ((totalEng / totalImpr) * 100).toFixed(2) : "0.00";
  const activeAssets = assets.filter((a) => a.status === "active").length;

  // Weekly Trend Aggregation
  const weekMap = new Map<string, { week: string; impr: number; eng: number; posts: number; netFol: number }>();
  for (const m of scopedMetrics) {
    const w = m.week_of || "Unknown";
    if (!weekMap.has(w)) weekMap.set(w, { week: w, impr: 0, eng: 0, posts: 0, netFol: 0 });
    const item = weekMap.get(w)!;
    item.impr += Number(m.impressions || 0);
    item.eng += Number(m.engagements || 0);
    item.posts += Number(m.posts_published || 0);
    item.netFol += Number(m.followers_gained || 0) - Number(m.followers_lost || 0);
  }
  const weeklySeries = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week)).slice(-10);
  const maxWeekImpr = Math.max(100, ...weeklySeries.map((w) => w.impr));

  // Platform Breakdown
  const platformStats = PLATFORMS.map((plat) => {
    const platAssets = assets.filter((a) => a.platform === plat);
    const platIds = new Set(platAssets.map((a) => a.id));
    const platLogs = scopedMetrics.filter((m) => platIds.has(m.asset_id));
    const impr = platLogs.reduce((s, m) => s + Number(m.impressions || 0), 0);
    const eng = platLogs.reduce((s, m) => s + Number(m.engagements || 0), 0);
    return { platform: plat, assetCount: platAssets.length, impr, eng };
  }).filter((p) => p.assetCount > 0 || p.impr > 0);
  const maxPlatImpr = Math.max(100, ...platformStats.map((p) => p.impr));

  // Country & Language Breakdown
  const countryMap = new Map<string, { country: string; assets: number; impr: number; eng: number }>();
  for (const a of assets) {
    const c = a.country_language || "Global";
    if (!countryMap.has(c)) countryMap.set(c, { country: c, assets: 0, impr: 0, eng: 0 });
    countryMap.get(c)!.assets += 1;
  }
  for (const m of scopedMetrics) {
    const a = assets.find((x) => x.id === m.asset_id);
    const c = a?.country_language || "Global";
    if (!countryMap.has(c)) countryMap.set(c, { country: c, assets: 0, impr: 0, eng: 0 });
    countryMap.get(c)!.impr += Number(m.impressions || 0);
    countryMap.get(c)!.eng += Number(m.engagements || 0);
  }
  const countryStats = Array.from(countryMap.values()).sort((a, b) => b.impr - a.impr).slice(0, 8);
  const maxCountryImpr = Math.max(100, ...countryStats.map((c) => c.impr));

  // Top Assets Leaderboard
  const assetLeaderboard = assets
    .map((a) => {
      const aLogs = scopedMetrics.filter((m) => m.asset_id === a.id);
      const impr = aLogs.reduce((s, m) => s + Number(m.impressions || 0), 0);
      const eng = aLogs.reduce((s, m) => s + Number(m.engagements || 0), 0);
      const fol = Math.max(0, ...aLogs.map((m) => Number(m.total_followers || 0)));
      return { asset: a, impr, eng, fol };
    })
    .sort((a, b) => b.impr - a.impr)
    .slice(0, 8);
  const maxAssetImpr = Math.max(100, ...assetLeaderboard.map((a) => a.impr));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPI Executive Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/40 rounded-2xl p-4 font-mono transition-all">
          <span className="text-[10px] text-zinc-500 block">TOTAL IMPRESSIONS</span>
          <span className="text-xl sm:text-2xl font-bold text-blue-400">{totalImpr.toLocaleString()}</span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">{scopedMetrics.length} Weekly Logs</span>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 hover:border-purple-500/40 rounded-2xl p-4 font-mono transition-all">
          <span className="text-[10px] text-zinc-500 block">TOTAL ENGAGEMENTS</span>
          <span className="text-xl sm:text-2xl font-bold text-purple-400">{totalEng.toLocaleString()}</span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">Avg Eng Rate: {avgEngRate}%</span>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 rounded-2xl p-4 font-mono transition-all">
          <span className="text-[10px] text-zinc-500 block">NET FOLLOWER GAIN</span>
          <span className={`text-xl sm:text-2xl font-bold ${netFollowers >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {netFollowers >= 0 ? `+${netFollowers.toLocaleString()}` : netFollowers.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Across {assets.length} Assets</span>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-4 font-mono transition-all">
          <span className="text-[10px] text-zinc-500 block">POSTS PUBLISHED</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-400">{totalPosts.toLocaleString()}</span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">{(totalPosts / 7).toFixed(1)} Avg Posts/Day</span>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl p-4 font-mono transition-all col-span-2 sm:col-span-1">
          <span className="text-[10px] text-zinc-500 block">FLEET UPTIME</span>
          <span className="text-xl sm:text-2xl font-bold text-cyan-400">
            {activeAssets} / {assets.length}
          </span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">Active Social Assets</span>
        </div>
      </div>

      {/* 1. Weekly Time-Series Trajectory Bar Chart */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold uppercase text-cyan-400">📈 1. {titlePrefix} Weekly Reach & Engagement Trajectory</h3>
            <p className="text-xs text-zinc-400">Week-over-Week impressions, engagements, and net follower velocity</p>
          </div>
        </div>
        {weeklySeries.length > 0 ? (
          <div className="space-y-3">
            {weeklySeries.map((w) => {
              const imprPct = Math.min(100, Math.max(4, Math.round((w.impr / maxWeekImpr) * 100)));
              const engPct = Math.min(100, Math.max(2, Math.round((w.eng / maxWeekImpr) * 100)));
              return (
                <div key={w.week} className="space-y-1.5 bg-black/60 border border-zinc-900 p-3 rounded-2xl">
                  <div className="flex flex-wrap justify-between text-xs font-mono gap-2">
                    <span className="text-white font-bold">📅 Week of {w.week}</span>
                    <div className="flex gap-3">
                      <span className="text-blue-400">{w.impr.toLocaleString()} Impr</span>
                      <span className="text-purple-400">{w.eng.toLocaleString()} Eng</span>
                      <span className={w.netFol >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {w.netFol >= 0 ? `+${w.netFol}` : w.netFol} Fol
                      </span>
                      <span className="text-amber-300">{w.posts} Posts</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-700" style={{ width: `${imprPct}%` }} />
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-700" style={{ width: `${engPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-zinc-500">No weekly metrics logged yet.</div>
        )}
      </div>

      {/* 2. Platform Distribution & Regional Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-purple-400">🌐 2. Platform Performance Matrix</h3>
          <div className="space-y-3">
            {platformStats.map((p) => {
              const pct = Math.min(100, Math.max(5, Math.round((p.impr / maxPlatImpr) * 100)));
              return (
                <div key={p.platform} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white font-bold uppercase">
                      {p.platform} <span className="text-zinc-500">({p.assetCount} Assets)</span>
                    </span>
                    <span className="text-purple-300">
                      {p.impr.toLocaleString()} Impr • {p.eng.toLocaleString()} Eng
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-emerald-400">🌍 3. Country & Regional Reach Distribution</h3>
          <div className="space-y-3">
            {countryStats.map((c) => {
              const pct = Math.min(100, Math.max(5, Math.round((c.impr / maxCountryImpr) * 100)));
              return (
                <div key={c.country} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white font-bold">
                      {c.country} <span className="text-zinc-500">({c.assets} Assets)</span>
                    </span>
                    <span className="text-emerald-300">
                      {c.impr.toLocaleString()} Impr • {c.eng.toLocaleString()} Eng
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Top Performing Assets Leaderboard */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase text-amber-400">🏆 4. Top Performing Social Media Assets (Tap to Inspect)</h3>
          <span className="text-[11px] text-zinc-500">Ranked by Cumulative Impressions</span>
        </div>
        <div className="space-y-2.5">
          {assetLeaderboard.map((item, idx) => {
            const pct = Math.min(100, Math.max(5, Math.round((item.impr / maxAssetImpr) * 100)));
            return (
              <div
                key={item.asset.id}
                onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                className="cursor-pointer bg-black/70 hover:bg-zinc-900/80 border border-zinc-900 hover:border-amber-500/40 p-3 rounded-2xl space-y-1.5 transition-all"
              >
                <div className="flex flex-wrap justify-between items-center text-xs font-mono gap-2">
                  <span className="text-white font-bold">
                    #{idx + 1} [{item.asset.platform.toUpperCase()}] {item.asset.account_id}{" "}
                    <span className="text-zinc-500">
                      ({item.asset.country_language} • {item.asset.language || "English"})
                    </span>
                  </span>
                  <span className="text-amber-300">
                    {item.impr.toLocaleString()} Impr • {item.eng.toLocaleString()} Eng • {item.fol.toLocaleString()} Fol
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 6. Deep Forensic Archive Vault Component (With JSON Diff Inspector, Category Filters & Instant Restore)
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = logs.filter((l) => {
    if (typeFilter !== "ALL" && l.entity_type !== typeFilter) return false;
    if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${l.actor_name || ""} ${l.summary || ""} ${l.entity_type || ""} ${JSON.stringify(l.record_snapshot || {})}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const exportArchiveCSV = () => {
    const headers = ["Timestamp", "Actor", "Role", "Action", "Entity Type", "Summary", "Full Snapshot JSON"];
    const rows = filtered.map((l) =>
      [
        `"${l.created_at || ""}"`,
        `"${l.actor_name || ""}"`,
        `"${l.actor_role || ""}"`,
        `"${l.action || ""}"`,
        `"${l.entity_type || ""}"`,
        `"${(l.summary || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(l.record_snapshot || {}).replace(/"/g, '""')}"`,
      ].join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Executive_Forensic_Archive_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl animate-in fade-in duration-300">
      <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-4 gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
            Immutable Forensic Audit & Snapshot Vault
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
            🗄 Executive Archive Vault ({filtered.length} / {logs.length} Snapshots)
          </h2>
          <p className="text-xs text-zinc-400">
            Click any archive row to unfold its complete field-by-field forensic snapshot, credentials, before/after state, or restore deleted records.
          </p>
        </div>
        <button
          type="button"
          onClick={exportArchiveCSV}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs shadow-md"
        >
          ⬇ Export Forensic Audit CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {["ALL", "EMPLOYEE", "ASSET", "METRIC"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              typeFilter === t ? "bg-amber-500 text-black border-amber-400" : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {t === "ALL" ? "All Entities" : t}
          </button>
        ))}
        <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />
        {["ALL", "CREATE", "UPDATE", "DELETE", "UPSERT", "RESTORE"].map((act) => (
          <button
            key={act}
            type="button"
            onClick={() => setActionFilter(act)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
              actionFilter === act ? "bg-purple-600 text-white border-purple-400" : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {act}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor, handle, email, country, password..."
          className="ml-auto w-full sm:w-72 rounded-xl bg-black border border-zinc-800 focus:border-amber-500 px-3 py-2 text-xs text-white outline-none"
        />
      </div>

      {/* Forensic Rows */}
      <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1">
        {filtered.map((log) => {
          const isOpen = expandedId === log.id;
          const snap = log.record_snapshot?.before || log.record_snapshot || {};
          const afterSnap = log.record_snapshot?.after || null;

          return (
            <div
              key={log.id}
              className={`rounded-2xl border transition-all duration-300 ${
                isOpen ? "bg-black border-amber-500/60 shadow-lg" : "bg-black/60 border-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div
                onClick={() => setExpandedId(isOpen ? null : log.id)}
                className="cursor-pointer p-3.5 sm:p-4 flex flex-wrap justify-between items-center gap-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      log.action === "DELETE"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : log.action === "UPDATE"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {log.entity_type} • {log.action}
                  </span>
                  <span className="text-xs font-bold text-white">{log.summary}</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-400">
                    By <b className="text-amber-300">{log.actor_name || "System"}</b> •{" "}
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "Live"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(log);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-[11px] transition-all"
                  >
                    ♻ Restore State
                  </button>
                  <span className="text-zinc-500">{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expandable Forensic Snapshot Drawer */}
              <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100 border-t border-zinc-800" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
                <div className="overflow-hidden">
                  <div className="p-4 bg-zinc-950/90 space-y-3 text-xs font-mono">
                    <div className="text-[10px] uppercase font-bold text-amber-400">
                      Forensic Record Snapshot (All Stored Fields & Credentials)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(snap).map(([k, v]) => (
                        <div key={k} className="bg-black border border-zinc-900 p-2.5 rounded-xl break-all">
                          <span className="text-[10px] text-zinc-500 uppercase block">{k}</span>
                          <span className="text-zinc-200 font-bold">
                            {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                          </span>
                        </div>
                      ))}
                    </div>
                    {afterSnap && (
                      <div className="pt-2 border-t border-zinc-800 space-y-2">
                        <div className="text-[10px] uppercase font-bold text-blue-400">Modified Fields (After Update)</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {Object.entries(afterSnap).map(([k, v]) => (
                            <div key={k} className="bg-blue-950/20 border border-blue-500/30 p-2 rounded-xl break-all">
                              <span className="text-[10px] text-blue-300 uppercase block">{k}</span>
                              <span className="text-white font-bold">
                                {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-xs text-zinc-500">No archive snapshots match your filter.</div>
        )}
      </div>
    </div>
  );
}

// 7. Interactive Multi-Step Campaign Dispatch Wizard
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
    <form onSubmit={handleDispatch} className="max-w-3xl mx-auto bg-zinc-950 border border-purple-500/40 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-300">
      <div className="border-b border-zinc-800 pb-4">
        <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
          Interactive Campaign Dispatcher
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">🎯 Give Campaign to Squads or SMMs</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Select target social platforms, choose Team Leaders or specific SMMs managing those platforms, and push key campaign objectives live.
        </p>
      </div>

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
                className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition-all active:scale-95 ${
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
              Shows TLs with SMMs managing {selectedPlatforms.join(", ").toUpperCase()} ({matchingTls.length} matching TLs)
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
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-zinc-800">
        <div>
          <label className="text-xs font-bold uppercase text-zinc-300 block mb-1">Step 4: Campaign Topic / Title</label>
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
            Step 5: Campaign Direction (Key Points, Objectives & Instructions)
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
