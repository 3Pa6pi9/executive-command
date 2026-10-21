"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PLATFORMS, ALL_COUNTRIES, ASSET_LANGUAGES, isPhoneInput, exportHorizonCSV } from "@/lib/constants";
import { adminSupabase, tlSupabase, managerSupabase } from "@/lib/supabase";

type UIArchitecture = "terminal" | "kanban" | "bento" | "spreadsheet" | "warroom" | "classic";

const UI_PARADIGMS: { id: UIArchitecture; icon: string; name: string; subtitle: string }[] = [
  { id: "terminal", icon: "⚡", name: "1. Split-Pane Terminal", subtitle: "3-Pane Bloomberg / Linear Command Deck" },
  { id: "kanban", icon: "🗂️", name: "2. Kanban Pipeline", subtitle: "Tactical Platform & Lock Board" },
  { id: "bento", icon: "⌘", name: "3. Spotlight Bento OS", subtitle: "Omni-Search + Spatial Modular Canvas" },
  { id: "spreadsheet", icon: "📊", name: "4. Master Spreadsheet", subtitle: "Airtable All-In-One Editable Matrix" },
  { id: "warroom", icon: "🌐", name: "5. 360° Squad War Room", subtitle: "Regional Squad & Post Rate Telemetry" },
  { id: "classic", icon: "🏛️", name: "Classic Portal", subtitle: "Original Tab Layout (Fixed)" }
];

export function ExecutiveOverlay() {
  const [pathname, setPathname] = useState("");
  const [uiMode, setUiMode] = useState<UIArchitecture>("terminal");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [weekOf, setWeekOf] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [vault, setVault] = useState<{
    logs: any[];
    passwords: Record<string, string>;
    emails: Record<string, string>;
    profiles: any[];
    assets: any[];
    metrics: any[];
  }>({
    logs: [],
    passwords: {},
    emails: {},
    profiles: [],
    assets: [],
    metrics: []
  });

  // Editable weekly metrics draft map: { [assetId]: { posts_published, impressions, likes, comments, shares_reposts, total_followers, followers_gained, followers_lost, top_post_impressions } }
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [revealedPwIds, setRevealedPwIds] = useState<Record<string, boolean>>({});

  // Inspector & Modal States
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [showSnapPass, setShowSnapPass] = useState(false);
  const [staffNewPass, setStaffNewPass] = useState("");

  // Full 14-Field Add Asset Form State
  const [assetPlatform, setAssetPlatform] = useState("twitter");
  const [assetTlId, setAssetTlId] = useState("");
  const [assetSmmId, setAssetSmmId] = useState("");
  const [assetCountry, setAssetCountry] = useState("Kenya");
  const [assetLang, setAssetLang] = useState("English");
  const [assetProject, setAssetProject] = useState("General Campaign");
  const [assetName, setAssetName] = useState("");
  const [assetHandle, setAssetHandle] = useState("");
  const [assetPass, setAssetPass] = useState("");
  const [showAssetPass, setShowAssetPass] = useState(false);
  const [assetEmail, setAssetEmail] = useState("");
  const [assetEmailPass, setAssetEmailPass] = useState("");
  const [showAssetEmailPass, setShowAssetEmailPass] = useState(false);
  const [assetUrl, setAssetUrl] = useState("");
  const [asset2FA, setAsset2FA] = useState("");
  const [assetLocked, setAssetLocked] = useState(false);

  // Full Add Employee (Both SMM & TL) Form State
  const [empRole, setEmpRole] = useState<"smm" | "team_leader" | "admin">("smm");
  const [empName, setEmpName] = useState("");
  const [empUsername, setEmpUsername] = useState("");
  const [empPass, setEmpPass] = useState("Welcome@2026!");
  const [showEmpPass, setShowEmpPass] = useState(false);
  const [empCountry, setEmpCountry] = useState("Kenya");
  const [empTlId, setEmpTlId] = useState("");
  const [empSquadSmmIds, setEmpSquadSmmIds] = useState<string[]>([]);
  const [empPlatforms, setEmpPlatforms] = useState<string[]>(["twitter", "instagram", "facebook", "tiktok"]);
  const [empLocked, setEmpLocked] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4200);
  };

  const toggleRevealPw = (id: string) => {
    setRevealedPwIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadVault = async () => {
    try {
      const r = await fetch("/api/crud", { cache: "no-store" });
      const j = await r.json();
      if (j) {
        (window as any).__pwMap = j.passwords || {};
        (window as any).__emailMap = j.emails || {};
        (window as any).__auditLogsCache = j.logs || [];
        const tls = (j.profiles || []).filter((p: any) => p.role === "team_leader");
        const smms = (j.profiles || []).filter((p: any) => p.role === "smm");
        if (!assetTlId && tls[0]?.id) setAssetTlId(tls[0].id);
        if (!assetSmmId && smms[0]?.id) setAssetSmmId(smms[0].id);
        if (!empTlId && tls[0]?.id) setEmpTlId(tls[0].id);
        setVault({
          logs: j.logs || [],
          passwords: j.passwords || {},
          emails: j.emails || {},
          profiles: j.profiles || [],
          assets: j.assets || [],
          metrics: j.metrics || []
        });
      }
    } catch (_e) {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    setPathname(path);
    const savedUi = (localStorage.getItem("exec_ui_architecture") as UIArchitecture) || "terminal";
    setUiMode(savedUi);

    // Detect logged-in user for role-scoped views (/smm or /team-leader)
    const client = path.startsWith("/admin")
      ? adminSupabase
      : path.startsWith("/team-leader")
      ? tlSupabase
      : managerSupabase;
    client.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setCurrentUserId(data.session.user.id);
    }).catch(() => {});

    loadVault();
  }, []);

  const switchUiMode = (mode: UIArchitecture) => {
    setUiMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("exec_ui_architecture", mode);
    }
  };

  // Sync draft metric inputs whenever assets, metrics, or weekOf changes
  useEffect(() => {
    const next: Record<string, any> = {};
    for (const a of vault.assets) {
      if (!a?.id) continue;
      const ex = vault.metrics.find((m: any) => m && m.asset_id === a.id && m.week_of === weekOf) || {};
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
  }, [vault.assets.length, vault.metrics.length, weekOf]);

  const updateDraftCell = (assetId: string, field: string, val: string) => {
    setDrafts((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [field]: val }
    }));
  };

  const buildMetricRow = (a: any) => {
    const d = drafts[a.id] || {};
    const likes = Math.max(0, Number(d.likes || 0) || 0);
    const comments = Math.max(0, Number(d.comments || 0) || 0);
    const shares = Math.max(0, Number(d.shares_reposts || 0) || 0);
    return {
      asset_id: a.id,
      week_of: weekOf,
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

  const handleSaveSingleAssetMetric = async (a: any) => {
    const ownerSmm = vault.profiles.find((p: any) => p.id === a.smm_id);
    if (a.status === "locked" || a.is_locked || ownerSmm?.is_locked) {
      notify("🔒 This asset is currently locked! Unlock it first to save metrics.");
      return;
    }
    setSavingRowId(a.id);
    try {
      const row = buildMetricRow(a);
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUserId || "admin", entity: "metric", action: "bulk_upsert", payload: { rows: [row] } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save metric");
      await loadVault();
      notify(`✓ Saved weekly post rate & performance for ${a.bio || a.account_id}!`);
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setSavingRowId(null);
    }
  };

  const handleSaveAllVisibleMetrics = async (assetsToSave: any[]) => {
    setBusy(true);
    try {
      const unlocked = assetsToSave.filter((a: any) => {
        const ownerSmm = vault.profiles.find((p: any) => p.id === a.smm_id);
        return a?.id && a.status !== "locked" && !a.is_locked && !ownerSmm?.is_locked;
      });
      const rows = unlocked.map((a: any) => buildMetricRow(a));
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUserId || "admin", entity: "metric", action: "bulk_upsert", payload: { rows } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to save weekly metrics");
      await loadVault();
      notify(`✓ Saved weekly performance & post rate for ${j.count || rows.length} accounts!`);
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLockAll = async (lockState: boolean) => {
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUserId || "admin", entity: "profile", action: "lock_all", payload: { is_locked: lockState } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Lock operation failed");
      await loadVault();
      notify(lockState ? `🔒 Locked all ${j.count || ""} staff & ${j.assetCount || ""} assets!` : `🔓 Unlocked all staff & social assets!`);
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStaffLock = async (staff: any) => {
    const nextLock = !staff.is_locked;
    setBusy(true);
    try {
      await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId || "admin",
          entity: "profile",
          action: "toggle_lock",
          payload: { targetId: staff.id, is_locked: nextLock }
        })
      });
      await loadVault();
      notify(nextLock ? `🔒 Locked ${staff.full_name} & their assets!` : `🔓 Unlocked ${staff.full_name} & their assets!`);
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAssetLock = async (asset: any) => {
    const isCurrentlyLocked = asset.status === "locked" || asset.is_locked;
    const nextLock = !isCurrentlyLocked;
    setBusy(true);
    try {
      await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId || "admin",
          entity: "asset",
          action: "toggle_lock",
          payload: { id: asset.id, is_locked: nextLock }
        })
      });
      await loadVault();
      notify(nextLock ? `🔒 Locked asset ${asset.bio || asset.account_id}!` : `🔓 Unlocked asset ${asset.bio || asset.account_id}!`);
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResetStaffPassword = async (staffId: string, newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 6) {
      notify("⚠️ Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId || "admin",
          entity: "profile",
          action: "update",
          payload: { targetId: staffId, newPassword: newPassword.trim() }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to update password");
      setStaffNewPass("");
      await loadVault();
      notify("✓ Password updated and synced to credential vault!");
    } catch (e: any) {
      notify(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAdminCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const isFbPhone = assetPlatform === "facebook" && isPhoneInput(assetEmail);
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId || "admin",
          entity: "asset",
          action: "create",
          payload: {
            platform: assetPlatform,
            team_leader_id: assetTlId || null,
            smm_id: assetSmmId || currentUserId || null,
            country_language: assetCountry,
            language: assetLang,
            project_name: assetProject,
            bio: assetName || assetHandle,
            account_id: assetHandle,
            account_password: assetPass,
            email: assetEmail,
            email_password: isFbPhone ? "" : assetEmailPass,
            profile_link: assetUrl,
            two_fa_code: asset2FA,
            status: assetLocked ? "locked" : "active"
          }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to add asset");
      notify(`✓ Added [${assetPlatform.toUpperCase()}] ${assetName || assetHandle}!`);
      setShowAddAsset(false);
      setAssetName(""); setAssetHandle(""); setAssetPass(""); setAssetEmail(""); setAssetEmailPass(""); setAssetUrl(""); setAsset2FA("");
      await loadVault();
    } catch (err: any) {
      notify(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAdminCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId || "admin",
          entity: "profile",
          action: "create",
          payload: {
            role: empRole,
            full_name: empName,
            email: empUsername || empName.toLowerCase().replace(/\s+/g, ""),
            password: empPass,
            country: empCountry,
            team_leader_id: empRole === "smm" ? empTlId || null : null,
            assignedSmmIds: empRole === "team_leader" ? empSquadSmmIds : [],
            platforms: empPlatforms,
            is_locked: empLocked
          }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to add employee");
      notify(`✓ Created ${empRole.toUpperCase()} account for ${empName}!`);
      setShowAddEmp(false);
      setEmpName(""); setEmpUsername("");
      await loadVault();
    } catch (err: any) {
      notify(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreLog = async (logId: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUserId || "admin", entity: "audit", action: "restore", payload: { logId } })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to restore snapshot");
      notify("♻️ Restored snapshot record to live database!");
      setSelectedLog(null);
      await loadVault();
    } catch (err: any) {
      notify(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Scope data by Portal Role (/admin sees all, /team-leader sees squad, /smm sees own assets)
  const isAdminPage = pathname.startsWith("/admin");
  const isTlPage = pathname.startsWith("/team-leader");
  const isSmmPage = pathname.startsWith("/smm");

  const scopedAssets = useMemo(() => {
    let list = vault.assets || [];
    if (isSmmPage && currentUserId) {
      const myAssets = list.filter((a: any) => a.smm_id === currentUserId);
      if (myAssets.length > 0) list = myAssets;
    } else if (isTlPage && currentUserId) {
      const mySquadSmms = new Set(
        (vault.profiles || []).filter((p: any) => p.team_leader_id === currentUserId).map((p: any) => p.id)
      );
      const tlAssets = list.filter((a: any) => a.team_leader_id === currentUserId || mySquadSmms.has(a.smm_id));
      if (tlAssets.length > 0) list = tlAssets;
    }
    if (platformFilter !== "all") {
      list = list.filter((a: any) => (a.platform || "").toLowerCase() === platformFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a: any) => {
        const smm = vault.profiles.find((p: any) => p.id === a.smm_id);
        return (
          (a.bio || "").toLowerCase().includes(q) ||
          (a.account_id || "").toLowerCase().includes(q) ||
          (a.platform || "").toLowerCase().includes(q) ||
          (a.country_language || "").toLowerCase().includes(q) ||
          (smm?.full_name || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [vault.assets, vault.profiles, isSmmPage, isTlPage, currentUserId, platformFilter, searchQuery]);

  const tls = vault.profiles.filter((p: any) => p.role === "team_leader");
  const smms = vault.profiles.filter((p: any) => p.role === "smm");
  const lockedSmmCount = smms.filter((s: any) => s.is_locked).length;
  const lockedAssetCount = vault.assets.filter((a: any) => a.status === "locked" || a.is_locked).length;

  // Total Post Rate & Performance Aggregations
  const totalPosts = vault.metrics.reduce((s, m) => s + Number(m?.posts_published || 0), 0);
  const totalViews = vault.metrics.reduce((s, m) => s + Number(m?.impressions || 0), 0);
  const totalLikes = vault.metrics.reduce((s, m) => s + Number(m?.likes || m?.engagements || 0), 0);
  const totalFollowers = vault.assets.reduce((sum, a) => {
    const maxF = vault.metrics.filter((m) => m?.asset_id === a.id).reduce((mx, x) => Math.max(mx, Number(x?.total_followers || 0)), 0);
    return sum + maxF;
  }, 0);

  return (
    <>
      {/* TOAST BANNER */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3.5 rounded-2xl bg-emerald-500 text-black font-extrabold text-xs shadow-2xl border-2 border-white/30">
          {toast}
        </div>
      )}

      {/* TOP DOCKED UI ARCHITECTURE SWITCHER BAR (Visible even in Classic Mode) */}
      <div className="inline-flex flex-wrap items-center gap-1.5 bg-zinc-950/95 border border-purple-500/40 rounded-full px-2.5 py-1 shadow-xl">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 px-1.5">🎛️ Switch UI:</span>
        {UI_PARADIGMS.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => switchUiMode(u.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all ${
              uiMode === u.id
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-105"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
            title={u.subtitle}
          >
            {u.icon} {u.name}
          </button>
        ))}
      </div>

      {/* FULL-VIEWPORT MULTI-ARCHITECTURE WORKSPACE ENGINE (When uiMode !== "classic") */}
      {uiMode !== "classic" && (
        <div className="fixed inset-0 z-[90] bg-[#05060a] text-zinc-100 flex flex-col overflow-hidden font-sans">
          {/* MASTER TOP COMMAND HEADER */}
          <header className="shrink-0 bg-[#0b0d14] border-b border-zinc-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500 flex items-center justify-center font-black text-sm text-white shadow-lg">
                EC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-tight text-white">EXECUTIVE COMMAND OS</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-extrabold uppercase">
                    {isAdminPage ? "👑 Master Admin" : isTlPage ? "🛡️ Team Leader" : "👤 SMM Workspace"}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Active Architecture: <b className="text-emerald-400">{UI_PARADIGMS.find((x) => x.id === uiMode)?.name}</b> — {UI_PARADIGMS.find((x) => x.id === uiMode)?.subtitle}
                </div>
              </div>
            </div>

            {/* 5 UI PARADIGM SWITCHER PILLS */}
            <div className="flex flex-wrap items-center gap-1 bg-black/80 border border-zinc-800 p-1 rounded-2xl">
              {UI_PARADIGMS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => switchUiMode(u.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all ${
                    uiMode === u.id
                      ? "bg-gradient-to-r from-purple-600 to-emerald-500 text-white shadow-md"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  {u.icon} {u.name}
                </button>
              ))}
            </div>

            {/* GLOBAL ACTION CONTROLS */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddAsset(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg transition-all"
              >
                + Add Asset
              </button>
              {isAdminPage && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAddEmp(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg transition-all"
                  >
                    + Add Employee (SMM / TL)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleLockAll(true)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-extrabold text-xs transition-all"
                  >
                    🔒 Lock All ({lockedSmmCount}/{smms.length} SMMs)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleLockAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs transition-all"
                  >
                    🔓 Unlock All
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  exportHorizonCSV({
                    horizon: "weekly",
                    metrics: vault.metrics,
                    assets: scopedAssets,
                    profiles: vault.profiles,
                    scopeLabel: "Executive_Command_Report"
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs"
              >
                📥 Export Excel
              </button>
            </div>
          </header>

          {/* SUB-BAR: OMNI-SEARCH, PLATFORM FILTER, WEEK SELECTOR & TELEMETRY */}
          <div className="shrink-0 bg-[#080a10] border-b border-zinc-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search accounts, @handles, SMMs, countries..."
                className="w-64 rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
              />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="rounded-xl bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white uppercase font-bold"
              >
                <option value="all">All Platforms ({scopedAssets.length})</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 bg-black border border-zinc-800 rounded-xl px-2.5 py-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Reporting Week:</span>
                <input
                  type="date"
                  value={weekOf}
                  onChange={(e) => setWeekOf(e.target.value)}
                  className="bg-transparent text-xs text-emerald-400 font-mono font-bold outline-none"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSaveAllVisibleMetrics(scopedAssets)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs"
              >
                💾 Save All Weekly Post Rate & Performance ({scopedAssets.length})
              </button>
            </div>

            {/* LIVE POST RATE & PERFORMANCE RIBBON */}
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div><span className="text-zinc-500">Accounts:</span> <b className="text-white">{scopedAssets.length}</b> <span className="text-red-400">({lockedAssetCount} 🔒)</span></div>
              <div><span className="text-zinc-500">Post Rate Volume:</span> <b className="text-emerald-400">{totalPosts.toLocaleString()} Posts</b></div>
              <div><span className="text-zinc-500">Performance Views:</span> <b className="text-purple-400">{totalViews.toLocaleString()}</b></div>
              <div><span className="text-zinc-500">Total Likes:</span> <b className="text-pink-400">{totalLikes.toLocaleString()}</b></div>
              <div><span className="text-zinc-500">Followers:</span> <b className="text-blue-400">{totalFollowers.toLocaleString()}</b></div>
            </div>
          </div>

          {/* =================================================================
              UI ARCHITECTURE 1: ⚡ SPLIT-PANE TERMINAL (3-PANE COMMAND DECK)
             ================================================================= */}
          {uiMode === "terminal" && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
              {/* LEFT PANE (3 Cols): Staff Roster, Passwords (👁) & Lock Controls (🔒) */}
              <div className="lg:col-span-3 flex flex-col overflow-hidden bg-[#07090f]">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-purple-300">👥 Staff & Credentials ({vault.profiles.length})</span>
                  {isAdminPage && (
                    <button type="button" onClick={() => setShowAddEmp(true)} className="text-[11px] font-bold text-emerald-400 hover:underline">
                      + Add Staff
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {vault.profiles.map((p: any) => {
                    const pw = vault.passwords[p.id] || "Welcome@2026!";
                    const em = vault.emails[p.id] || p.email || "";
                    const isRev = revealedPwIds[p.id];
                    const ownedCount = vault.assets.filter((a: any) => a.smm_id === p.id || a.team_leader_id === p.id).length;
                    return (
                      <div key={p.id} className={`p-3 rounded-2xl border transition-all ${p.is_locked ? "bg-red-950/20 border-red-500/40" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-white truncate">{p.full_name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[9px] font-bold uppercase text-purple-300">{p.role === "team_leader" ? "TL" : p.role}</span>
                              {p.is_locked ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold">🔒 LOCKED</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">🟢 ACTIVE</span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{em} · {p.country} · {ownedCount} Assets</div>
                          </div>
                          {isAdminPage && p.role !== "admin" && (
                            <button
                              type="button"
                              onClick={() => handleToggleStaffLock(p)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${
                                p.is_locked ? "bg-emerald-500 text-black" : "bg-red-500/20 border border-red-500/40 text-red-300"
                              }`}
                            >
                              {p.is_locked ? "🔓 Unlock" : "🔒 Lock"}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">
                            PW: <code className="text-emerald-400 font-mono font-bold ml-1" style={{ filter: isRev ? "none" : "blur(4px)" }}>{pw}</code>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => toggleRevealPw(p.id)} className="px-2 py-0.5 rounded bg-zinc-900 text-purple-300 text-[10px] font-bold">
                              👁 {isRev ? "Hide" : "Show"}
                            </button>
                            <button type="button" onClick={() => setSelectedStaff(p)} className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px] font-bold">
                              ⚙️ Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CENTER PANE (6 Cols): Live Assets & Inline Weekly Post Rate / Performance Matrix */}
              <div className="lg:col-span-6 flex flex-col overflow-hidden bg-[#05060a]">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    📊 Live Assets & Weekly Post Rate Matrix ({scopedAssets.length})
                  </span>
                  <span className="text-[11px] text-zinc-400">Edit any cell inline → Click 💾 Save</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {scopedAssets.map((a: any) => {
                    const d = drafts[a.id] || {};
                    const smm = vault.profiles.find((p: any) => p.id === a.smm_id);
                    const tl = vault.profiles.find((p: any) => p.id === (a.team_leader_id || smm?.team_leader_id));
                    const isLocked = a.status === "locked" || a.is_locked || smm?.is_locked;
                    const isSaved = vault.metrics.some((m: any) => m && m.asset_id === a.id && m.week_of === weekOf);
                    const isPwRev = revealedPwIds[a.id];
                    return (
                      <div key={a.id} className={`p-3.5 rounded-2xl border transition-all ${isLocked ? "bg-red-950/15 border-red-500/40" : "bg-zinc-950 border-zinc-800"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-900">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-extrabold uppercase">
                              {a.platform}
                            </span>
                            <span className="text-xs font-extrabold text-white">{a.bio || a.account_id}</span>
                            <span className="text-[11px] text-zinc-400 font-mono">({a.account_id})</span>
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-[9px] font-extrabold uppercase">🔒 LOCKED</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-extrabold uppercase">🟢 ACTIVE</span>
                            )}
                            {isSaved && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">✓ Saved ({weekOf})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400">SMM: <b className="text-zinc-200">{smm?.full_name || "Unassigned"}</b> · TL: <b className="text-zinc-200">{tl?.full_name || "—"}</b></span>
                            <button type="button" onClick={() => toggleRevealPw(a.id)} className="px-2 py-0.5 rounded bg-zinc-900 text-purple-300 text-[10px] font-bold">
                              👁 {isPwRev ? "Hide PW" : "PW"}
                            </button>
                            {isAdminPage && (
                              <button
                                type="button"
                                onClick={() => handleToggleAssetLock(a)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${isLocked ? "bg-emerald-500 text-black" : "bg-red-500/20 text-red-300"}`}
                              >
                                {isLocked ? "🔓 Unlock" : "🔒 Lock"}
                              </button>
                            )}
                          </div>
                        </div>

                        {isPwRev && (
                          <div className="my-2 p-2.5 rounded-xl bg-black border border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div><span className="text-zinc-500">Acct PW:</span> <code className="text-emerald-400 font-mono">{a.account_password || "—"}</code></div>
                            <div><span className="text-zinc-500">Email/Phone:</span> <code className="text-white font-mono">{a.email || "—"}</code></div>
                            <div><span className="text-zinc-500">Email PW:</span> <code className="text-emerald-400 font-mono">{a.email_password || "—"}</code></div>
                            <div><span className="text-zinc-500">2FA:</span> <code className="text-amber-300 font-mono">{a.two_fa_code || "—"}</code></div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 pt-2 items-end">
                          {[
                            ["posts_published", "Posts (Rate)"],
                            ["impressions", "Views"],
                            ["likes", "Likes"],
                            ["comments", "Comments"],
                            ["shares_reposts", "Shares"],
                            ["total_followers", "Followers"],
                            ["followers_gained", "+Gained"],
                            ["followers_lost", "-Lost"]
                          ].map(([field, label]) => (
                            <div key={field}>
                              <label className="text-[9px] uppercase text-zinc-500 font-bold block truncate">{label}</label>
                              <input
                                type="number"
                                min="0"
                                disabled={isLocked}
                                value={d[field] ?? ""}
                                onChange={(e) => updateDraftCell(a.id, field, e.target.value)}
                                placeholder="0"
                                className="w-full mt-0.5 rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none disabled:opacity-40"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            disabled={isLocked || savingRowId === a.id}
                            onClick={() => handleSaveSingleAssetMetric(a)}
                            className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-extrabold text-[11px]"
                          >
                            {savingRowId === a.id ? "⏳" : "💾 Save"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT PANE (3 Cols): Live Forensic Activity Archive (Click any row for Full Dossier) */}
              <div className="lg:col-span-3 flex flex-col overflow-hidden bg-[#07090f]">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">📜 Activity Archive ({vault.logs.length})</span>
                  <span className="text-[10px] text-zinc-400">Click row for Dossier</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {vault.logs.slice(0, 120).map((l: any) => (
                    <div
                      key={l.id}
                      onClick={() => {
                        setShowSnapPass(false);
                        setSelectedLog(l);
                      }}
                      className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 cursor-pointer transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-extrabold uppercase">{l.action}</span>
                        <span className="text-zinc-500 font-mono">{l.created_at ? new Date(l.created_at).toLocaleString() : ""}</span>
                      </div>
                      <div className="text-xs font-bold text-white line-clamp-2">{l.summary}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>By: <b className="text-zinc-200">{l.actor_name}</b></span>
                        <span className="text-emerald-400 font-bold">Inspect Dossier →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              UI ARCHITECTURE 2: 🗂️ KANBAN PIPELINE BOARD (BY PLATFORM)
             ================================================================= */}
          {uiMode === "kanban" && (
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-[#05060a]">
              <div className="flex gap-4 h-full min-w-max">
                {PLATFORMS.map((plat) => {
                  const colAssets = scopedAssets.filter((a: any) => (a.platform || "").toLowerCase() === plat);
                  return (
                    <div key={plat} className="w-80 flex flex-col bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                      <div className="p-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-white">{plat} PIPELINE</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold">{colAssets.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {colAssets.map((a: any) => {
                          const d = drafts[a.id] || {};
                          const smm = vault.profiles.find((p: any) => p.id === a.smm_id);
                          const isLocked = a.status === "locked" || a.is_locked || smm?.is_locked;
                          const isSaved = vault.metrics.some((m: any) => m && m.asset_id === a.id && m.week_of === weekOf);
                          return (
                            <div key={a.id} className={`p-3.5 rounded-2xl border space-y-2.5 ${isLocked ? "bg-red-950/20 border-red-500/40" : "bg-zinc-950 border-zinc-800"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-extrabold text-white">{a.bio || a.account_id}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono">{a.account_id} · {a.country_language}</div>
                                </div>
                                {isLocked ? (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-extrabold">🔒 LOCKED</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-extrabold">🟢 ACTIVE</span>
                                )}
                              </div>

                              <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                                <span>Handler: <b className="text-white">{smm?.full_name || "Unassigned"}</b></span>
                                {isSaved && <span className="text-blue-400 font-bold">✓ Week Saved</span>}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <div>
                                  <label className="text-[9px] uppercase text-zinc-500 font-bold">Posts (Post Rate)</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={d.posts_published ?? ""}
                                    onChange={(e) => updateDraftCell(a.id, "posts_published", e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase text-zinc-500 font-bold">Performance Views</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={d.impressions ?? ""}
                                    onChange={(e) => updateDraftCell(a.id, "impressions", e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase text-zinc-500 font-bold">Likes</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={d.likes ?? ""}
                                    onChange={(e) => updateDraftCell(a.id, "likes", e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase text-zinc-500 font-bold">Followers</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={d.total_followers ?? ""}
                                    onChange={(e) => updateDraftCell(a.id, "total_followers", e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isLocked || savingRowId === a.id}
                                  onClick={() => handleSaveSingleAssetMetric(a)}
                                  className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-extrabold text-[11px]"
                                >
                                  {savingRowId === a.id ? "⏳..." : "💾 Save Week"}
                                </button>
                                {isAdminPage && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAssetLock(a)}
                                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-zinc-200"
                                  >
                                    {isLocked ? "🔓 Unlock" : "🔒 Lock"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              UI ARCHITECTURE 3: ⌘ SPOTLIGHT BENTO OS (SPATIAL MODULAR CANVAS)
             ================================================================= */}
          {uiMode === "bento" && (
            <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-br from-[#0c0a20] via-[#05060d] to-black space-y-5">
              {/* Top Spatial KPI Bento Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl">
                  <div className="text-[10px] uppercase font-extrabold text-purple-300">Active Social Assets</div>
                  <div className="text-3xl font-black text-white mt-1">{scopedAssets.length}</div>
                  <div className="text-xs text-zinc-400 mt-1">{lockedAssetCount} Locked · {scopedAssets.length - lockedAssetCount} Open</div>
                </div>
                <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl">
                  <div className="text-[10px] uppercase font-extrabold text-emerald-300">Post Rate & Volume</div>
                  <div className="text-3xl font-black text-emerald-400 mt-1">{totalPosts.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400 mt-1">Published posts across platforms</div>
                </div>
                <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl">
                  <div className="text-[10px] uppercase font-extrabold text-blue-300">Performance Views</div>
                  <div className="text-3xl font-black text-blue-400 mt-1">{totalViews.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400 mt-1">{totalLikes.toLocaleString()} cumulative likes</div>
                </div>
                <div className="p-5 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl">
                  <div className="text-[10px] uppercase font-extrabold text-amber-300">Audience Footprint</div>
                  <div className="text-3xl font-black text-amber-400 mt-1">{totalFollowers.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400 mt-1">Total combined followers</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Bento Module A: Quick Weekly Performance Logger */}
                <div className="lg:col-span-2 p-5 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">⚡ Spatial Post Rate & Performance Logger</h3>
                    <span className="text-xs text-emerald-400 font-mono">Week: {weekOf}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                    {scopedAssets.map((a: any) => {
                      const d = drafts[a.id] || {};
                      const smm = vault.profiles.find((p: any) => p.id === a.smm_id);
                      const isLocked = a.status === "locked" || a.is_locked || smm?.is_locked;
                      return (
                        <div key={a.id} className={`p-4 rounded-2xl border space-y-2 ${isLocked ? "bg-red-950/20 border-red-500/40" : "bg-black/60 border-white/10"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black uppercase text-purple-400">{a.platform}</span>
                              <h4 className="text-xs font-extrabold text-white">{a.bio || a.account_id}</h4>
                            </div>
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold">🔒 LOCKED</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleAssetMetric(a)}
                                className="px-3 py-1 rounded-lg bg-emerald-500 text-black font-extrabold text-[10px]"
                              >
                                💾 Save
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              ["posts_published", "Posts"],
                              ["impressions", "Views"],
                              ["likes", "Likes"],
                              ["total_followers", "Follows"]
                            ].map(([f, lbl]) => (
                              <div key={f}>
                                <label className="text-[9px] text-zinc-400 uppercase">{lbl}</label>
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  value={d[f] ?? ""}
                                  onChange={(e) => updateDraftCell(a.id, f, e.target.value)}
                                  placeholder="0"
                                  className="w-full rounded bg-zinc-950 border border-zinc-800 px-1.5 py-1 text-xs text-white font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bento Module B: Forensic Activity Feed */}
                <div className="p-5 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">📜 Forensic Archive Stream</h3>
                  <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                    {vault.logs.slice(0, 60).map((l: any) => (
                      <div
                        key={l.id}
                        onClick={() => {
                          setShowSnapPass(false);
                          setSelectedLog(l);
                        }}
                        className="p-3 rounded-2xl bg-black/60 border border-white/10 hover:border-purple-400 cursor-pointer space-y-1"
                      >
                        <div className="flex justify-between text-[10px]">
                          <span className="text-purple-300 font-extrabold">{l.action}</span>
                          <span className="text-zinc-500">{l.actor_name}</span>
                        </div>
                        <div className="text-xs font-bold text-white">{l.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              UI ARCHITECTURE 4: 📊 MASTER SPREADSHEET MATRIX (AIRTABLE GRID)
             ================================================================= */}
          {uiMode === "spreadsheet" && (
            <div className="flex-1 overflow-auto bg-[#05060a] p-4">
              <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950 shadow-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e121b] border-b border-zinc-800 text-[10px] uppercase font-extrabold text-zinc-400">
                      <th className="p-3">#</th>
                      <th className="p-3">Platform</th>
                      <th className="p-3">Account Name & Handle</th>
                      <th className="p-3">SMM Handler</th>
                      <th className="p-3">Credentials (👁)</th>
                      <th className="p-3">Lock Status</th>
                      <th className="p-2">Posts (Rate)</th>
                      <th className="p-2">Views</th>
                      <th className="p-2">Likes</th>
                      <th className="p-2">Comments</th>
                      <th className="p-2">Shares</th>
                      <th className="p-2">Followers</th>
                      <th className="p-2">+Gained</th>
                      <th className="p-2">-Lost</th>
                      <th className="p-3">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {scopedAssets.map((a: any, idx: number) => {
                      const d = drafts[a.id] || {};
                      const smm = vault.profiles.find((p: any) => p.id === a.smm_id);
                      const isLocked = a.status === "locked" || a.is_locked || smm?.is_locked;
                      const isRev = revealedPwIds[a.id];
                      const isSaved = vault.metrics.some((m: any) => m && m.asset_id === a.id && m.week_of === weekOf);
                      return (
                        <tr key={a.id} className={isLocked ? "bg-red-950/20" : "hover:bg-zinc-900/40"}>
                          <td className="p-3 font-mono text-zinc-500">{idx + 1}</td>
                          <td className="p-3 uppercase font-extrabold text-purple-300">{a.platform}</td>
                          <td className="p-3">
                            <div className="font-extrabold text-white">{a.bio || a.account_id}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{a.account_id} · {a.country_language}</div>
                          </td>
                          <td className="p-3 text-zinc-300 font-medium">{smm?.full_name || "Unassigned"}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <code className="text-emerald-400 font-mono text-[11px]" style={{ filter: isRev ? "none" : "blur(4px)" }}>
                                {a.account_password || "—"}
                              </code>
                              <button type="button" onClick={() => toggleRevealPw(a.id)} className="px-2 py-0.5 rounded bg-zinc-900 text-purple-300 text-[10px] font-bold">
                                👁
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {isLocked ? (
                                <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-[9px] font-extrabold">🔒 LOCKED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-extrabold">🟢 ACTIVE</span>
                              )}
                              {isAdminPage && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAssetLock(a)}
                                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-white"
                                >
                                  {isLocked ? "🔓 Unlock" : "🔒 Lock"}
                                </button>
                              )}
                            </div>
                          </td>
                          {["posts_published", "impressions", "likes", "comments", "shares_reposts", "total_followers", "followers_gained", "followers_lost"].map((f) => (
                            <td key={f} className="p-1.5">
                              <input
                                type="number"
                                min="0"
                                disabled={isLocked}
                                value={d[f] ?? ""}
                                onChange={(e) => updateDraftCell(a.id, f, e.target.value)}
                                placeholder="0"
                                className="w-20 rounded-lg bg-black border border-zinc-800 px-2 py-1 text-xs text-white font-mono focus:border-emerald-500 outline-none disabled:opacity-40"
                              />
                            </td>
                          ))}
                          <td className="p-3">
                            <button
                              type="button"
                              disabled={isLocked || savingRowId === a.id}
                              onClick={() => handleSaveSingleAssetMetric(a)}
                              className={`px-3 py-1.5 rounded-lg font-extrabold text-[10px] ${
                                isSaved ? "bg-blue-500/20 border border-blue-500/40 text-blue-300" : "bg-emerald-500 text-black"
                              }`}
                            >
                              {savingRowId === a.id ? "⏳" : isSaved ? "✓ Saved" : "💾 Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              UI ARCHITECTURE 5: 🌐 360° SQUAD WAR ROOM (REGIONAL TELEMETRY)
             ================================================================= */}
          {uiMode === "warroom" && (
            <div className="flex-1 overflow-y-auto p-5 bg-[#030907] space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tls.map((tl: any) => {
                  const squadSmms = smms.filter((s: any) => s.team_leader_id === tl.id || (s.team_leader_ids || []).includes(tl.id));
                  const squadSmmIds = new Set(squadSmms.map((s: any) => s.id));
                  const squadAssets = vault.assets.filter((a: any) => a.team_leader_id === tl.id || squadSmmIds.has(a.smm_id));
                  const squadAssetIds = new Set(squadAssets.map((a: any) => a.id));
                  const squadMetrics = vault.metrics.filter((m: any) => squadAssetIds.has(m?.asset_id));
                  const sqPosts = squadMetrics.reduce((s, m) => s + Number(m?.posts_published || 0), 0);
                  const sqViews = squadMetrics.reduce((s, m) => s + Number(m?.impressions || 0), 0);
                  const tlPw = vault.passwords[tl.id] || "Welcome@2026!";
                  const isRev = revealedPwIds[tl.id];

                  return (
                    <div key={tl.id} className="p-5 rounded-3xl bg-[#071611] border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.08)] space-y-4">
                      <div className="flex items-start justify-between border-b border-emerald-500/20 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-extrabold text-emerald-400">🛡️ Team Leader Squad</span>
                          <h3 className="text-base font-black text-white">{tl.full_name}</h3>
                          <div className="text-[11px] text-zinc-400 font-mono">{vault.emails[tl.id]} · {tl.country}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <code className="text-emerald-300 font-mono text-xs" style={{ filter: isRev ? "none" : "blur(4px)" }}>{tlPw}</code>
                          <button type="button" onClick={() => toggleRevealPw(tl.id)} className="px-2 py-1 rounded bg-black/60 text-emerald-300 text-[10px] font-bold">
                            👁
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-2xl bg-black/50 border border-emerald-500/20">
                          <div className="text-[10px] text-zinc-400 uppercase">SMMs</div>
                          <div className="text-lg font-black text-white">{squadSmms.length}</div>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-black/50 border border-emerald-500/20">
                          <div className="text-[10px] text-zinc-400 uppercase">Assets</div>
                          <div className="text-lg font-black text-emerald-400">{squadAssets.length}</div>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-black/50 border border-emerald-500/20">
                          <div className="text-[10px] text-zinc-400 uppercase">Post Rate</div>
                          <div className="text-lg font-black text-purple-300">{sqPosts}</div>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-300 flex justify-between">
                        <span>Total Squad Performance Views:</span>
                        <b className="text-emerald-400 font-mono">{sqViews.toLocaleString()}</b>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {squadSmms.map((s: any) => (
                          <div key={s.id} className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-white">{s.full_name}</span>
                              <span className="text-[10px] text-zinc-400 ml-2">({vault.assets.filter((a: any) => a.smm_id === s.id).length} assets)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {s.is_locked ? (
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold">🔒 LOCKED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">🟢 ACTIVE</span>
                              )}
                              {isAdminPage && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStaffLock(s)}
                                  className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] font-bold text-white"
                                >
                                  {s.is_locked ? "🔓 Unlock" : "🔒 Lock"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL A: STAFF CREDENTIAL & LOCK INSPECTOR
         ===================================================================== */}
      {selectedStaff && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setSelectedStaff(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border border-purple-500/40 rounded-3xl p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-purple-400">{selectedStaff.role} Profile</span>
                <h3 className="text-lg font-extrabold text-white">{selectedStaff.full_name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedStaff(null)} className="px-3 py-1 rounded-xl bg-zinc-900 text-zinc-300 text-xs">✕</button>
            </div>

            <div className="p-3.5 rounded-2xl bg-black border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Login Username:</span>
                <code className="text-white font-mono font-bold">{vault.emails[selectedStaff.id] || selectedStaff.email}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Current Password:</span>
                <div className="flex items-center gap-2">
                  <code className="text-emerald-400 font-mono font-bold" style={{ filter: revealedPwIds[selectedStaff.id] ? "none" : "blur(4px)" }}>
                    {vault.passwords[selectedStaff.id] || "Welcome@2026!"}
                  </code>
                  <button type="button" onClick={() => toggleRevealPw(selectedStaff.id)} className="px-2 py-0.5 rounded bg-zinc-900 text-purple-300 text-[10px] font-bold">
                    👁 {revealedPwIds[selectedStaff.id] ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-zinc-400">Account Lock State:</span>
                <button
                  type="button"
                  onClick={() => handleToggleStaffLock(selectedStaff)}
                  className={`px-3 py-1 rounded-lg font-extrabold text-xs ${selectedStaff.is_locked ? "bg-emerald-500 text-black" : "bg-red-500/20 text-red-300 border border-red-500/40"}`}
                >
                  {selectedStaff.is_locked ? "🔓 Unlock Account" : "🔒 Lock Account"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Reset Password</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={staffNewPass}
                  onChange={(e) => setStaffNewPass(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="flex-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleResetStaffPassword(selectedStaff.id, staffNewPass)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs"
                >
                  Save PW
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL B: COMPLETE 14-FIELD "+ ADD ASSET" BUILDER
         ===================================================================== */}
      {showAddAsset && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setShowAddAsset(false)}>
          <form
            onSubmit={handleAdminCreateAsset}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400">Complete Social Asset Provisioning</span>
                <h3 className="text-lg font-extrabold text-white">Add New Social Media Asset (All 14 Details)</h3>
              </div>
              <button type="button" onClick={() => setShowAddAsset(false)} className="px-3 py-1 rounded-xl bg-zinc-900 text-zinc-300 text-xs">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Platform</label>
                <select value={assetPlatform} onChange={(e) => setAssetPlatform(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white uppercase">
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">2. Assigned Team Leader</label>
                <select value={assetTlId} onChange={(e) => setAssetTlId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  <option value="">-- Select Team Leader --</option>
                  {tls.map((tl: any) => <option key={tl.id} value={tl.id}>{tl.full_name} ({tl.country})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">3. Assigned SMM Handler</label>
                <select value={assetSmmId} onChange={(e) => setAssetSmmId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  <option value="">-- Select SMM Handler --</option>
                  {smms.map((s: any) => <option key={s.id} value={s.id}>{s.full_name} {s.is_locked ? "(🔒 Locked)" : ""}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">4. Target Country</label>
                <select value={assetCountry} onChange={(e) => setAssetCountry(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">5. Operating Language</label>
                <select value={assetLang} onChange={(e) => setAssetLang(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  {ASSET_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">6. Campaign / Project</label>
                <input type="text" value={assetProject} onChange={(e) => setAssetProject(e.target.value)} placeholder="General Campaign" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">7. Account Display Name / Bio</label>
                <input type="text" required value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Daily News Kenya" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">8. Username / @Handle / Account ID</label>
                <input type="text" required value={assetHandle} onChange={(e) => setAssetHandle(e.target.value)} placeholder={assetPlatform === "twitter" ? "@username" : "Account Username / ID"} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">9. Account Login Password</label>
                  <button type="button" onClick={() => setShowAssetPass(!showAssetPass)} className="text-[10px] text-purple-400 font-bold">👁 {showAssetPass ? "Hide" : "Show"}</button>
                </div>
                <input type={showAssetPass ? "text" : "password"} required value={assetPass} onChange={(e) => setAssetPass(e.target.value)} placeholder="Account Login Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">10. {assetPlatform === "facebook" ? "Facebook Email or Phone Number" : "Linked Recovery Email"}</label>
                <input type="text" value={assetEmail} onChange={(e) => setAssetEmail(e.target.value)} placeholder={assetPlatform === "facebook" ? "Email or +254... Phone Number" : "account@email.com"} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!(assetPlatform === "facebook" && isPhoneInput(assetEmail)) ? (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">11. Linked Email Password</label>
                    <button type="button" onClick={() => setShowAssetEmailPass(!showAssetEmailPass)} className="text-[10px] text-purple-400 font-bold">👁 {showAssetEmailPass ? "Hide" : "Show"}</button>
                  </div>
                  <input type={showAssetEmailPass ? "text" : "password"} value={assetEmailPass} onChange={(e) => setAssetEmailPass(e.target.value)} placeholder="Email Password" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
                </div>
              ) : (
                <div className="flex items-center px-3 py-2 mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
                  ✓ Phone number entered — no email password required
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">12. 2FA Secret / Backup Code</label>
                <input type="text" value={asset2FA} onChange={(e) => setAsset2FA(e.target.value)} placeholder="JBSWY3DPEHPK3PXP (Optional)" className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">13. Profile URL</label>
                <input type="url" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="https://..." className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white" />
              </div>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black border border-zinc-800 text-xs text-white cursor-pointer">
                <input type="checkbox" checked={assetLocked} onChange={(e) => setAssetLocked(e.target.checked)} className="rounded" />
                <span>14. Lock Asset Immediately (<b className="text-red-400">🔒 LOCKED</b>)</span>
              </label>
            </div>

            <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all">
              {busy ? "⏳ Saving Asset..." : "✓ Save & Provision Complete Asset"}
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL C: COMPLETE "+ ADD EMPLOYEE (SMM & TEAM LEADER)" BUILDER
         ===================================================================== */}
      {showAddEmp && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setShowAddEmp(false)}>
          <form
            onSubmit={handleAdminCreateEmployee}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-purple-500/40 rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-purple-400">Master Admin Staff Onboarding</span>
                <h3 className="text-lg font-extrabold text-white">Add New Employee (SMM Handler or Team Leader)</h3>
              </div>
              <button type="button" onClick={() => setShowAddEmp(false)} className="px-3 py-1 rounded-xl bg-zinc-900 text-zinc-300 text-xs">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-black p-1.5 rounded-2xl border border-zinc-800">
              <button type="button" onClick={() => setEmpRole("smm")} className={`py-2 rounded-xl text-xs font-extrabold transition-all ${empRole === "smm" ? "bg-emerald-500 text-black" : "text-zinc-400"}`}>
                👤 SMM Handler
              </button>
              <button type="button" onClick={() => setEmpRole("team_leader")} className={`py-2 rounded-xl text-xs font-extrabold transition-all ${empRole === "team_leader" ? "bg-blue-600 text-white" : "text-zinc-400"}`}>
                🛡️ Team Leader (TL)
              </button>
              <button type="button" onClick={() => setEmpRole("admin")} className={`py-2 rounded-xl text-xs font-extrabold transition-all ${empRole === "admin" ? "bg-purple-600 text-white" : "text-zinc-400"}`}>
                👑 Master Admin
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">1. Full Name</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => {
                    setEmpName(e.target.value);
                    const first = e.target.value.trim().split(/\s+/)[0] || "";
                    if (first) {
                      setEmpUsername(`${first.toLowerCase()}@${empRole === "team_leader" ? "tl" : empRole === "admin" ? "admin" : "smm"}`);
                    }
                  }}
                  placeholder="Full Legal / Display Name"
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">2. Login Username</label>
                <input
                  type="text"
                  required
                  value={empUsername}
                  onChange={(e) => setEmpUsername(e.target.value)}
                  placeholder={empRole === "team_leader" ? "name@tl" : "name@smm"}
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">3. Login Password</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowEmpPass(!showEmpPass)} className="text-[10px] text-purple-400 font-bold">👁 {showEmpPass ? "Hide" : "Show"}</button>
                    <button type="button" onClick={() => setEmpPass(`Exec@${Math.floor(1000 + Math.random() * 9000)}!`)} className="text-[10px] text-emerald-400 font-bold">🎲 Generate</button>
                  </div>
                </div>
                <input
                  type={showEmpPass ? "text" : "password"}
                  required
                  value={empPass}
                  onChange={(e) => setEmpPass(e.target.value)}
                  className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">4. Operating Country / Squad Region</label>
                <select value={empCountry} onChange={(e) => setEmpCountry(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {empRole === "smm" && (
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">5. Assigned Team Leader</label>
                <select value={empTlId} onChange={(e) => setEmpTlId(e.target.value)} className="w-full mt-1 rounded-xl bg-black border border-zinc-800 p-2.5 text-xs text-white">
                  <option value="">-- Select Supervising Team Leader --</option>
                  {tls.map((tl: any) => <option key={tl.id} value={tl.id}>{tl.full_name} ({tl.country})</option>)}
                </select>
              </div>
            )}

            {empRole === "team_leader" && (
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-400">5. Assign Squad SMMs Under This Team Leader ({empSquadSmmIds.length} Selected)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 p-3 rounded-xl bg-black border border-zinc-800 max-h-36 overflow-y-auto">
                  {smms.map((s: any) => {
                    const checked = empSquadSmmIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setEmpSquadSmmIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                          }
                        />
                        <span className="truncate">{s.full_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">6. Authorized Platforms</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PLATFORMS.map((p) => {
                  const active = empPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEmpPlatforms((prev) => (active ? prev.filter((x) => x !== p) : [...prev, p]))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase border transition-all ${
                        active ? "bg-purple-600/30 border-purple-500 text-white" : "bg-black border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {active ? "✓ " : ""}{p}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black border border-zinc-800 text-xs text-white cursor-pointer">
              <input type="checkbox" checked={empLocked} onChange={(e) => setEmpLocked(e.target.checked)} />
              <span>7. Start Account in Locked State (<b className="text-red-400">🔒 LOCKED</b>)</span>
            </label>

            <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-all">
              {busy ? "⏳ Creating Employee..." : `✓ Create ${empRole === "team_leader" ? "Team Leader" : empRole === "admin" ? "Admin" : "SMM"} Account`}
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL D: PROFESSIONAL FORENSIC ACTIVITY ARCHIVE DOSSIER
         ===================================================================== */}
      {selectedLog && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setSelectedLog(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-zinc-950 border border-purple-500/40 rounded-3xl p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-extrabold uppercase">
                    {selectedLog.action || "AUDIT"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold uppercase">
                    {selectedLog.entity_type || "RECORD"}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : "Recorded Event"}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-1.5">{selectedLog.summary}</h3>
              </div>
              <button type="button" onClick={() => setSelectedLog(null)} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 text-xs">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-black border border-zinc-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-500">Executed By (Actor)</div>
                <div className="text-sm font-extrabold text-white">{selectedLog.actor_name || "Master Admin"}</div>
                <div className="text-[11px] text-purple-400 uppercase font-bold">Role: {selectedLog.actor_role || "Administrator"}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black border border-zinc-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-500">Target Record Identifier</div>
                <div className="text-sm font-extrabold text-emerald-400 truncate">
                  {selectedLog.record_snapshot?.bio || selectedLog.record_snapshot?.full_name || selectedLog.record_snapshot?.account_id || selectedLog.entity_id || "System Record"}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">ID: {selectedLog.entity_id || selectedLog.id}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-200">Complete Recorded Snapshot Details</span>
                <button
                  type="button"
                  onClick={() => setShowSnapPass(!showSnapPass)}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold"
                >
                  👁 {showSnapPass ? "Hide Sensitive Credentials" : "Show Credentials"}
                </button>
              </div>
              <div className="divide-y divide-zinc-900 bg-black text-xs">
                {Object.entries(selectedLog.record_snapshot || {}).map(([k, v]) => {
                  if (v === null || v === undefined || v === "" || k === "id") return null;
                  const isSecret = k.toLowerCase().includes("password") || k.toLowerCase().includes("two_fa");
                  const label = k
                    .replace(/^_resolved_/, "")
                    .replace(/^_/, "")
                    .replace(/_/g, " ")
                    .toUpperCase();
                  const valStr = typeof v === "object" ? JSON.stringify(v) : String(v);
                  return (
                    <div key={k} className="grid grid-cols-3 px-4 py-2.5 hover:bg-zinc-950">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{label}</span>
                      <span
                        className="col-span-2 font-mono text-zinc-100 break-all"
                        style={isSecret && !showSnapPass ? { filter: "blur(5px)" } : undefined}
                      >
                        {valStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(selectedLog, null, 2));
                  notify("📋 Copied full forensic audit report!");
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200"
              >
                📋 Copy Audit Report
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRestoreLog(selectedLog.id)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs"
              >
                ♻️ Restore Record Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
