"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";
import { PLATFORMS, ALL_COUNTRIES, parseBulkRows } from "@/lib/constants";

export default function TeamLeaderPortal() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string | null>(null);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"squad" | "assets" | "bulk">("squad");
  const [searchQuery, setSearchQuery] = useState("");

  // Squad SMM CRUD Modals
  const [showCreateSmmModal, setShowCreateSmmModal] = useState(false);
  const [newSmmName, setNewSmmName] = useState("");
  const [newSmmEmail, setNewSmmEmail] = useState("");
  const [newSmmPass, setNewSmmPass] = useState("");
  const [newSmmCountry, setNewSmmCountry] = useState("Ethiopia");
  const [editingSmm, setEditingSmm] = useState<any>(null);

  // Squad Asset CRUD Modals
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [handoverType, setHandoverType] = useState<"credentials_only" | "account_only" | "full">("account_only");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignEmailPass, setAssignEmailPass] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignCountry, setAssignCountry] = useState("Ethiopia");
  const [assignProject, setAssignProject] = useState("General Campaign");

  // Bulk Data Entry State (Squad Assets or Squad SMMs)
  const [bulkType, setBulkType] = useState<"assets" | "smms">("assets");
  const [bulkRawText, setBulkRawText] = useState("");

  useEffect(() => {
    let channel: any;
    verifyTeamLeaderSession().then((tlId) => {
      if (!tlId) return;
      channel = supabase
        .channel("tl-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { triggerPulse(); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "social_assets" }, () => { triggerPulse(); loadSquadData(tlId); })
        .on("postgres_changes", { event: "*", schema: "public", table: "weekly_metrics" }, () => { triggerPulse(); loadSquadData(tlId); })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const triggerPulse = () => {
    setLiveSyncPulse(true);
    setTimeout(() => setLiveSyncPulse(false), 1200);
  };

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsCheckingAuth(false); return null; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      setAuthMsg("Unauthorized: Verified Team Leaders only.");
      setIsCheckingAuth(false);
      return null;
    }
    setTlProfile(prof);
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
    return prof.id;
  };

  const handleTLLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating Team Leader...");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return setAuthMsg(error.message);

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      return setAuthMsg("Security Block: Team Leader clearance required.");
    }
    setTlProfile(prof);
    await loadSquadData(prof.id);
  };

  const loadSquadData = async (tlId: string) => {
    const { data: mySmms } = await supabase.from("profiles").select("*").eq("role", "smm");
    const filteredSmms = (mySmms || []).filter(s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId)));
    setSquadMembers(filteredSmms);
    if (filteredSmms.length > 0 && !assignSmmId) setAssignSmmId(filteredSmms[0].id);

    const { data: assets } = await supabase.from("social_assets").select("*").order("created_at", { ascending: false });
    setSquadAssets(assets || []);

    const { data: metrics } = await supabase.from("weekly_metrics").select("*").order("week_of", { ascending: false });
    setSquadMetrics(metrics || []);
  };

  // SQUAD SMM CRUD
  const handleCreateSquadSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "create",
        payload: { email: newSmmEmail, password: newSmmPass, full_name: newSmmName, country: newSmmCountry }
      })
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`✓ Onboarded SMM ${newSmmName} into your squad!`);
      setNewSmmName(""); setNewSmmEmail(""); setNewSmmPass("");
      setShowCreateSmmModal(false);
      await loadSquadData(tlProfile.id);
    } else setStatusMsg("Error: " + data.error);
  };

  const handleUpdateSquadSmm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSmm) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "profile",
        action: "update",
        payload: { targetId: editingSmm.id, full_name: editingSmm.full_name, country: editingSmm.country, is_locked: editingSmm.is_locked }
      })
    });
    setStatusMsg("✓ Squad SMM updated!");
    setEditingSmm(null);
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveSmmFromSquad = async (smmId: string, smmName: string) => {
    if (!confirm(`Remove ${smmName} from your squad?`)) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "remove_from_squad", payload: { targetId: smmId, tlId: tlProfile.id } })
    });
    if (selectedSmm === smmId) setSelectedSmm(null);
    setStatusMsg(`Removed ${smmName} from squad.`);
    await loadSquadData(tlProfile.id);
  };

  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name} input ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
  };

  // SQUAD ASSET CRUD
  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: tlProfile.id,
        entity: "asset",
        action: "create",
        payload: {
          smm_id: assignSmmId,
          team_leader_id: tlProfile.id,
          platform: assignPlatform,
          account_id: handoverType === "credentials_only" ? "Pending Setup (Email Handover)" : (assignAccountId || "Pending"),
          account_password: handoverType === "credentials_only" ? null : assignPass,
          email: handoverType === "account_only" ? null : assignEmail,
          email_password: handoverType === "account_only" ? null : assignEmailPass,
          profile_link: assignLink || null,
          country_language: assignCountry,
          project_name: assignProject,
          status: "active"
        }
      })
    });
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignPass(""); setAssignEmail(""); setAssignEmailPass(""); setAssignLink("");
    setStatusMsg("✓ Asset created & handed over live!");
    await loadSquadData(tlProfile.id);
  };

  const handleFullUpdateSquadAsset = async (updatedAsset: any) => {
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "update", payload: updatedAsset })
    });
    setStatusMsg("✓ Asset updated & synced live!");
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Delete this Asset?")) return;
    await fetch("/api/crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "delete", payload: { id: assetId } })
    });
    setStatusMsg("🗑 Asset deleted.");
    await loadSquadData(tlProfile.id);
  };

  // BULK ENTRY FOR TEAM LEADER
  const handleTlBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseBulkRows(bulkRawText);
    if (rows.length === 0) return;

    if (bulkType === "assets") {
      const items = rows.map(r => ({
        smm_id: assignSmmId || (squadMembers[0]?.id ?? null),
        team_leader_id: tlProfile.id,
        account_id: r[0] || "Pending_Handle",
        account_password: r[1] || "",
        email: r[2] || "",
        email_password: r[3] || "",
        profile_link: r[4] || "",
        country_language: r[5] || assignCountry,
        platform: (r[6] || assignPlatform).toLowerCase(),
        project_name: r[7] || assignProject,
        status: "active"
      }));
      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: tlProfile.id, entity: "asset", action: "bulk_create", payload: { items } })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`⚡ Bulk assigned ${data.count} Assets to squad!`);
        setBulkRawText("");
        setActiveTab("assets");
        await loadSquadData(tlProfile.id);
      }
    } else {
      const empRows = rows.map(r => ({
        full_name: r[0] || "Squad SMM",
        email: r[1] || "",
        password: r[2] || "Welcome@2026!",
        country: r[3] || assignCountry
      })).filter(x => x.email.includes("@"));
      const res = await fetch("/api/crud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: tlProfile.id, entity: "profile", action: "bulk_create", payload: { rows: empRows } })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`⚡ Bulk onboarded ${data.createdCount} Squad SMMs!`);
        setBulkRawText("");
        setActiveTab("squad");
        await loadSquadData(tlProfile.id);
      }
    }
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Connecting Team Leader Realtime Stream...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold">Tier 2 — Squad Command</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
          </div>
          <form onSubmit={handleTLLogin} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500"></div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="josiah@executive.com" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-lg bg-black border border-zinc-800 p-3 text-sm text-white" />
            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm">Authenticate Team Leader</button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSmmObj = squadMembers.find(m => m.id === selectedSmm);
  const filteredAssets = selectedSmm ? squadAssets.filter(a => a.smm_id === selectedSmm) : squadAssets;
  const q = searchQuery.toLowerCase().trim();

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold">
                Tier 2 — Squad Command CRUD
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all ${liveSyncPulse ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 scale-105" : "bg-zinc-900 border-zinc-800 text-emerald-400"}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                ⚡ LIVE REALTIME SYNC
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Countries: {tlProfile.country} • Squad SMMs: {squadMembers.length} • Squad Assets: {squadAssets.length}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowCreateSmmModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs">
              + Onboard Squad SMM
            </button>
            <button onClick={() => setShowGiveModal(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs">
              + Create / Hand Over Asset
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* Mode Switcher & Search */}
        <div className="flex flex-wrap justify-between items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-2xl">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("squad")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "squad" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
              👥 Squad SMMs CRUD ({squadMembers.length})
            </button>
            <button onClick={() => setActiveTab("assets")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "assets" ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
              🗂 Squad Assets CRUD ({squadAssets.length})
            </button>
            <button onClick={() => setActiveTab("bulk")} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === "bulk" ? "bg-amber-500 text-black" : "bg-zinc-900 text-amber-400 border border-amber-500/30"}`}>
              ⚡ Bulk Data Entry
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search squad SMMs or @Handles..."
            className="w-64 rounded-xl bg-black border border-zinc-800 px-3 py-2 text-xs text-white outline-none"
          />
        </div>

        {/* TAB 1: SQUAD SMM CARDS */}
        {activeTab === "squad" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadMembers.filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.country || "").toLowerCase().includes(q)).map(smm => {
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmLogs = squadMetrics.filter(m => smmAssets.some(a => a.id === m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => setSelectedSmm(smm.id)}
                  className="group cursor-pointer rounded-2xl p-5 bg-zinc-950 border border-zinc-800 hover:border-blue-500 hover:-translate-y-1 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Assets</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                    >
                      {smm.is_locked ? "🔒 Locked" : "🔓 Open"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-xs">
                    <div className="space-x-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditingSmm({ ...smm })} className="text-emerald-400 hover:underline font-bold">✎ Edit SMM</button>
                      <button onClick={() => handleRemoveSmmFromSquad(smm.id, smm.full_name)} className="text-red-400 hover:underline font-bold">✕ Remove</button>
                    </div>
                    <span className="text-blue-400 font-bold">Inspect Assets →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: ALL SQUAD ASSETS CRUD */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {squadAssets.filter(a => !q || (a.account_id || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)).map(asset => (
              <AssetDirectiveCard
                key={asset.id}
                asset={asset}
                squadMembers={squadMembers}
                onFullSave={handleFullUpdateSquadAsset}
                onRemove={handleRemoveAsset}
              />
            ))}
          </div>
        )}

        {/* TAB 3: BULK DATA ENTRY FOR SQUAD */}
        {activeTab === "bulk" && (
          <form onSubmit={handleTlBulkImport} className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">⚡ Squad Bulk Data Importer</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBulkType("assets")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bulkType === "assets" ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
                  Bulk Hand Over Assets
                </button>
                <button type="button" onClick={() => setBulkType("smms")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bulkType === "smms" ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
                  Bulk Onboard Squad SMMs
                </button>
              </div>
            </div>
            <p className="text-xs font-mono text-amber-300">
              {bulkType === "assets"
                ? "Format per line: Asset_ID, Asset_Password, Email, Email_Password, Profile_Link, Country, Platform, Project"
                : "Format per line: Full_Name, Email, Password, Country"}
            </p>
            <textarea
              rows={7}
              required
              value={bulkRawText}
              onChange={(e) => setBulkRawText(e.target.value)}
              placeholder="Paste rows from Excel/Google Sheets or CSV..."
              className="w-full rounded-xl bg-black border border-zinc-800 p-4 text-xs font-mono text-white"
            />
            <button type="submit" className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl text-xs">
              ⚡ Execute Squad Bulk Import ({parseBulkRows(bulkRawText).length} Rows)
            </button>
          </form>
        )}

      </div>

      {/* MODAL: ONBOARD NEW SQUAD SMM */}
      {showCreateSmmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreateSmmModal(false)}>
          <form onSubmit={handleCreateSquadSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border border-blue-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-white">Onboard New Squad SMM</h3>
            <input type="text" required value={newSmmName} onChange={(e) => setNewSmmName(e.target.value)} placeholder="Handler Full Name" className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <input type="email" required value={newSmmEmail} onChange={(e) => setNewSmmEmail(e.target.value)} placeholder="smm@executive.com" className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <input type="text" required value={newSmmPass} onChange={(e) => setNewSmmPass(e.target.value)} placeholder="Initial Password" className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <select value={newSmmCountry} onChange={(e) => setNewSmmCountry(e.target.value)} className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white">
              {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg text-xs">Create & Assign SMM</button>
          </form>
        </div>
      )}

      {/* MODAL: EDIT SQUAD SMM */}
      {editingSmm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingSmm(null)}>
          <form onSubmit={handleUpdateSquadSmm} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Squad SMM</h3>
            <input type="text" required value={editingSmm.full_name || ""} onChange={(e) => setEditingSmm({ ...editingSmm, full_name: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <input type="text" required value={editingSmm.country || ""} onChange={(e) => setEditingSmm({ ...editingSmm, country: e.target.value })} className="w-full rounded bg-black border border-zinc-800 p-2.5 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Save Changes</button>
          </form>
        </div>
      )}

      {/* MODAL: CREATE / HAND OVER ASSET */}
      {showGiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowGiveModal(false)}>
          <form onSubmit={handleGiveAsset} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-emerald-400">Create / Hand Over Asset to Squad Manager</h3>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black rounded-lg border border-zinc-800">
              <button type="button" onClick={() => setHandoverType("account_only")} className={`py-1.5 text-[11px] font-bold rounded ${handoverType === "account_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>1. Username & Pass</button>
              <button type="button" onClick={() => setHandoverType("credentials_only")} className={`py-1.5 text-[11px] font-bold rounded ${handoverType === "credentials_only" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>2. Email & Pass Only</button>
              <button type="button" onClick={() => setHandoverType("full")} className={`py-1.5 text-[11px] font-bold rounded ${handoverType === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>3. Full Vault</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={assignCountry} onChange={(e) => setAssignCountry(e.target.value)} className="rounded bg-black border border-zinc-800 p-2 text-xs text-white">
                {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {(handoverType === "account_only" || handoverType === "full") && (
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset ID / @Handle" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
                <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              </div>
            )}
            {(handoverType === "credentials_only" || handoverType === "full") && (
              <div className="grid grid-cols-2 gap-2">
                <input type="email" required value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="Handover Email" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
                <input type="text" required value={assignEmailPass} onChange={(e) => setAssignEmailPass(e.target.value)} placeholder="Email Password" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
              </div>
            )}
            <input type="url" value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Asset Profile Link (Optional)" className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-black font-bold rounded-lg text-xs">Confirm Asset Handover</button>
          </form>
        </div>
      )}

      {/* SLIDE-OVER RIGHT PANEL FOR SELECTED SMM */}
      {activeSmmObj && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm" onClick={() => setSelectedSmm(null)}>
          <div className="w-full max-w-3xl bg-zinc-950 border-l border-blue-500/40 h-full overflow-y-auto p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-2xl font-bold text-white">{activeSmmObj.full_name}&apos;s Assets ({filteredAssets.length})</h2>
              <button onClick={() => setSelectedSmm(null)} className="px-3 py-1.5 rounded bg-zinc-900 text-xs text-zinc-300">✕ Close</button>
            </div>
            <div className="space-y-4">
              {filteredAssets.map(asset => (
                <AssetDirectiveCard
                  key={asset.id}
                  asset={asset}
                  squadMembers={squadMembers}
                  onFullSave={handleFullUpdateSquadAsset}
                  onRemove={handleRemoveAsset}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function AssetDirectiveCard({ asset, squadMembers, onFullSave, onRemove }: any) {
  const [formState, setFormState] = useState({ ...asset });
  const [showVaultEdit, setShowVaultEdit] = useState(false);

  useEffect(() => { setFormState({ ...asset }); }, [asset]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-emerald-400">({asset.country_language || "Ethiopia"})</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowVaultEdit(!showVaultEdit)} className="text-[11px] px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">
            {showVaultEdit ? "Hide Vault" : "✎ Edit Vault / Reassign"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 font-bold">🗑</button>
        </div>
      </div>

      {showVaultEdit && (
        <div className="p-3 bg-black border border-emerald-500/30 rounded-xl space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <select value={formState.smm_id || ""} onChange={(e) => setFormState({ ...formState, smm_id: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white">
              {squadMembers.map((m: any) => <option key={m.id} value={m.id}>SMM: {m.full_name}</option>)}
            </select>
            <select value={formState.country_language || "Ethiopia"} onChange={(e) => setFormState({ ...formState, country_language: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white">
              {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white uppercase">
              <option value="active">ACTIVE</option>
              <option value="suspended">SUSPENDED</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Asset ID" value={formState.account_id || ""} onChange={(e) => setFormState({ ...formState, account_id: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white" />
            <input type="text" placeholder="Asset Password" value={formState.account_password || ""} onChange={(e) => setFormState({ ...formState, account_password: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white" />
            <input type="email" placeholder="Asset Email" value={formState.email || ""} onChange={(e) => setFormState({ ...formState, email: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white" />
            <input type="text" placeholder="Email Password" value={formState.email_password || ""} onChange={(e) => setFormState({ ...formState, email_password: e.target.value })} className="rounded bg-zinc-950 border border-zinc-800 p-2 text-white" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="text" value={formState.tl_campaign || ""} onChange={(e) => setFormState({ ...formState, tl_campaign: e.target.value })} placeholder="Campaign" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={formState.tl_task || ""} onChange={(e) => setFormState({ ...formState, tl_task: e.target.value })} placeholder="Weekly Task" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={formState.tl_comment || ""} onChange={(e) => setFormState({ ...formState, tl_comment: e.target.value })} placeholder="TL Comment" className="rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
      </div>
      <button onClick={() => onFullSave(formState)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs">
        Save Asset & Directives Live
      </button>
    </div>
  );
}
