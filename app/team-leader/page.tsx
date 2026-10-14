"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";
import Link from "next/link";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];
const HIERARCHY_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania", "France", 
  "Afghan", "Crotia", "SA", "Serbia", "New Serbia", "Germany", 
  "Kosavo", "Greece", "Hungary", "Africa"
];

export default function TeamLeaderPortal() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tlName, setTlName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Africa"]);
  const [authMsg, setAuthMsg] = useState("");

  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string | null>(null);
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignProject, setAssignProject] = useState("General Campaign");

  useEffect(() => {
    verifyTeamLeaderSession();
  }, []);

  const verifyTeamLeaderSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsCheckingAuth(false);
      return;
    }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof || prof.role !== "team_leader") {
      await supabase.auth.signOut();
      setAuthMsg("Unauthorized: Only verified Team Leaders can access this portal.");
      setIsCheckingAuth(false);
      return;
    }

    setTlProfile(prof);
    setIsCheckingAuth(false);
    await loadSquadData(prof.id);
  };

  const handleTLAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("Authenticating Team Leader...");

    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setAuthMsg(error.message);

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      if (!prof || prof.role !== "team_leader") {
        await supabase.auth.signOut();
        return setAuthMsg("Security Block: SMMs and non-TL accounts are strictly forbidden from the Team Leader portal.");
      }

      setTlProfile(prof);
      await loadSquadData(prof.id);
    } else {
      if (selectedCountries.length === 0) return setAuthMsg("Select at least one Country.");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: "team_leader",
          full_name: tlName,
          country: selectedCountries.join(", ")
        })
      });
      const data = await res.json();
      if (res.ok) {
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
        await verifyTeamLeaderSession();
      } else {
        setAuthMsg(data.error || "Failed to register Team Leader.");
      }
    }
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

  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name}'s weekly Asset metric input is now ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
    await loadSquadData(tlProfile.id);
  };

  const handleUpdateAssetDirectives = async (assetId: string, tl_campaign: string, tl_task: string, tl_comment: string) => {
    await supabase.from("social_assets").update({ tl_campaign, tl_task, tl_comment }).eq("id", assetId);
    setStatusMsg("Directives & comments saved to Asset!");
    await loadSquadData(tlProfile.id);
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this Asset from the manager?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    setStatusMsg("Asset removed.");
    await loadSquadData(tlProfile.id);
  };

  const handleGiveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("social_assets").insert([{
      smm_id: assignSmmId,
      team_leader_id: tlProfile.id,
      platform: assignPlatform,
      account_id: assignAccountId,
      profile_link: assignLink,
      account_password: assignPass,
      project_name: assignProject,
      status: "active"
    }]);
    setShowGiveModal(false);
    setAssignAccountId(""); setAssignLink(""); setAssignPass("");
    setStatusMsg("New Asset assigned to manager!");
    await loadSquadData(tlProfile.id);
  };

  if (isCheckingAuth) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono text-sm animate-pulse">Verifying Team Leader Clearance...</div>;

  if (!tlProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-zinc-100 font-sans">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full font-bold shadow-[0_0_15px_rgba(59,130,246,0.25)]">Tier 2 — Squad Command</span>
            <h1 className="text-3xl font-bold text-white mt-3">Team Leader Portal</h1>
            <p className="text-xs text-zinc-500 mt-1">Restricted strictly to verified Agency Team Leaders</p>
          </div>

          <form onSubmit={handleTLAuth} className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/40 rounded-2xl p-8 space-y-4 shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500"></div>
            {!isLoginMode && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Name</label>
                  <input type="text" required value={tlName} onChange={(e) => setTlName(e.target.value)} placeholder="e.g. Josiah, Jeff, Ali" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Assigned Countries</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {HIERARCHY_COUNTRIES.map(c => (
                      <button type="button" key={c} onClick={() => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border truncate transition-all ${selectedCountries.includes(c) ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-black border-zinc-800 text-zinc-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Team Leader Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="josiah@executive.com" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-400">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 rounded-lg bg-black border border-zinc-800 focus:border-blue-500 p-3 text-sm text-white outline-none" />
            </div>

            {authMsg && <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">{authMsg}</div>}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-3 rounded-lg text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.35)]">
              {isLoginMode ? "Authenticate Team Leader" : "Complete Team Leader Creation"}
            </button>

            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthMsg(""); }} className="text-xs text-zinc-400 hover:text-white underline">
                {isLoginMode ? "Create New Team Leader Account" : "Return to Team Leader Login"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-purple-400 transition-colors">← Return to SMM Handler Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSmmObj = squadMembers.find(m => m.id === selectedSmm);
  const filteredAssets = selectedSmm ? squadAssets.filter(a => a.smm_id === selectedSmm) : [];

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
              Tier 2 — Team Leader Command
            </span>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Assigned Countries: {tlProfile.country} • Squad SMMs: {squadMembers.length} • Total Squad Assets: {squadAssets.length}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowGiveModal(!showGiveModal)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 hover:-translate-y-0.5 active:scale-95 text-black font-bold rounded-lg text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              + Give Asset to Manager
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setTlProfile(null); }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-lg text-xs text-zinc-400 hover:text-red-400 transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center font-bold animate-pulse">{statusMsg}</div>}

        {/* Animated Give Asset Modal Drawer */}
        <div className={`grid transition-all duration-500 ease-in-out ${showGiveModal ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            <form onSubmit={handleGiveAsset} autoComplete="off" className="bg-zinc-950 border border-emerald-500/40 p-6 rounded-2xl space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-emerald-400 uppercase">Give / Assign Asset to Squad Manager</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white">
                  {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white uppercase">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Asset ID / @Handle" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                <input type="url" required value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Asset Profile Link" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
                <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Asset Password" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              </div>
              <button type="submit" className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all">Confirm Assignment</button>
            </form>
          </div>
        </div>

        {/* 1. Squad Managers Grid */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
              1. Squad Managers Signed Under You (Click Manager Card to Unfold Their Assets)
            </h2>
            {selectedSmm && (
              <button onClick={() => setSelectedSmm(null)} className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800 transition-all">
                ✕ Collapse Asset Drawer
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadMembers.map(smm => {
              const isSelected = selectedSmm === smm.id;
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmAssetIds = smmAssets.map(a => a.id);
              const smmLogs = squadMetrics.filter(m => smmAssetIds.includes(m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div
                  key={smm.id}
                  onClick={() => setSelectedSmm(isSelected ? null : smm.id)}
                  className={`group cursor-pointer rounded-2xl p-5 border transition-all duration-300 transform ${
                    isSelected
                      ? "bg-gradient-to-b from-blue-950/40 to-zinc-950 border-blue-500 -translate-y-1.5 shadow-[0_12px_35px_-10px_rgba(59,130,246,0.45)] ring-1 ring-blue-400/50"
                      : "bg-zinc-950 border-zinc-800 hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-xl"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Assets</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                        smm.is_locked
                          ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                      }`}
                    >
                      {smm.is_locked ? "🔒 Locked (Tap to Unlock)" : "🔓 Open (Tap to Lock)"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-[11px] text-zinc-400 group-hover:text-blue-300">
                    <span>{isSelected ? "Asset Drawer Open Below" : `Click to Inspect ${smmAssets.length} Assets`}</span>
                    <span className={`transition-transform duration-300 ${isSelected ? "rotate-180 text-blue-400" : "group-hover:translate-x-1"}`}>
                      {isSelected ? "▲" : "→"}
                    </span>
                  </div>
                </div>
              );
            })}
            {squadMembers.length === 0 && <div className="col-span-3 text-zinc-500 text-sm p-6 bg-zinc-950 border border-zinc-800 rounded-xl">No SMMs have registered under your Team Leader profile yet.</div>}
          </div>
        </div>

        {/* 2. Animated Expandable Drawer for Selected Manager's Assets */}
        <div className={`grid transition-all duration-500 ease-in-out ${selectedSmm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
          <div className="overflow-hidden">
            {activeSmmObj && (
              <div className="bg-zinc-950/95 border border-blue-500/40 rounded-2xl p-6 space-y-5 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      Unfolded Manager Asset Vault
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      {activeSmmObj.full_name}&apos;s Managed Assets ({filteredAssets.length})
                    </h2>
                    <p className="text-xs text-zinc-400">Assign weekly campaigns, tasks, and comments or inspect credentials</p>
                  </div>
                  <button onClick={() => setSelectedSmm(null)} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                    Collapse Drawer ▲
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAssets.map(asset => {
                    const latest = squadMetrics.filter(m => m.asset_id === asset.id)[0];
                    return (
                      <AssetDirectiveCard
                        key={asset.id}
                        asset={asset}
                        ownerName={activeSmmObj.full_name}
                        latestMetric={latest}
                        onSave={handleUpdateAssetDirectives}
                        onRemove={handleRemoveAsset}
                      />
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                      {activeSmmObj.full_name} has not registered any Social Media Assets yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function AssetDirectiveCard({ asset, ownerName, latestMetric, onSave, onRemove }: any) {
  const [campaign, setCampaign] = useState(asset.tl_campaign || "");
  const [task, setTask] = useState(asset.tl_task || "");
  const [comment, setComment] = useState(asset.tl_comment || "");
  const [showVault, setShowVault] = useState(false);

  return (
    <div className="bg-black border border-zinc-800 hover:border-blue-500/40 rounded-xl p-5 space-y-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">ASSET: {asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-zinc-500 ml-2">({ownerName})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVault(!showVault)} className="text-[10px] px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 transition-all">
            {showVault ? "🙈 Hide Vault" : "👁 View Vault"}
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 hover:underline ml-1">Remove</button>
        </div>
      </div>

      {/* Animated Vault Slide-Down */}
      <div className={`grid transition-all duration-300 ease-in-out ${showVault ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}>
        <div className="overflow-hidden">
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 space-y-1">
            <div><b>Asset Profile:</b> <a href={asset.profile_link} target="_blank" className="text-blue-400 underline">{asset.profile_link}</a></div>
            <div><b>Asset Pass:</b> <span className="text-emerald-400">{asset.account_password}</span></div>
            <div><b>Asset Email:</b> {asset.email} (<b>Pass:</b> {asset.email_password})</div>
            <div><b>Asset 2FA:</b> {asset.two_fa_code || "None"} • <b>Phone:</b> {asset.phone_number || "N/A"}</div>
          </div>
        </div>
      </div>

      {latestMetric ? (
        <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 p-3 rounded-lg text-xs font-mono">
          <div><span className="text-[10px] text-zinc-500 block">WEEK</span>{latestMetric.week_of}</div>
          <div><span className="text-[10px] text-zinc-500 block">IMPR</span><span className="text-blue-400 font-bold">{latestMetric.impressions.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">ENG</span><span className="text-purple-400 font-bold">{latestMetric.engagements.toLocaleString()}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">FOLLOWERS</span><span className="text-emerald-400 font-bold">{latestMetric.total_followers.toLocaleString()}</span></div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">No weekly metrics logged for this Asset yet.</div>
      )}

      <div className="space-y-2 pt-1">
        <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Assign Campaign to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Assign Weekly Task to Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave Comment on Asset" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-500 p-2 text-xs text-white outline-none transition-all" />
        <button onClick={() => onSave(asset.id, campaign, task, comment)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-lg text-xs transition-all">
          Save Directives & Comments
        </button>
      </div>
    </div>
  );
}
