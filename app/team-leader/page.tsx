"use client";

import { useState, useEffect } from "react";
import { managerSupabase as supabase } from "@/lib/supabase";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

export default function TeamLeaderDashboard() {
  const [tlProfile, setTlProfile] = useState<any>(null);
  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [selectedSmm, setSelectedSmm] = useState<string>("all");
  const [squadAssets, setSquadAssets] = useState<any[]>([]);
  const [squadMetrics, setSquadMetrics] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  // Give / Assign New Social Media Account to Manager State
  const [showGiveModal, setShowGiveModal] = useState(false);
  const [assignSmmId, setAssignSmmId] = useState("");
  const [assignPlatform, setAssignPlatform] = useState("twitter");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [assignPass, setAssignPass] = useState("");
  const [assignProject, setAssignProject] = useState("General Campaign");

  useEffect(() => {
    initTL();
  }, []);

  const initTL = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!prof) return;
    setTlProfile(prof);
    await loadSquadData(prof.id);
  };

  const loadSquadData = async (tlId: string) => {
    const { data: allSmms } = await supabase.from("profiles").select("*").eq("role", "smm");
    const mySmms = (allSmms || []).filter(s => s.team_leader_id === tlId || (s.team_leader_ids && s.team_leader_ids.includes(tlId)));
    setSquadMembers(mySmms);
    if (mySmms.length > 0 && !assignSmmId) setAssignSmmId(mySmms[0].id);

    const smmIds = mySmms.map(s => s.id);
    if (smmIds.length > 0) {
      const { data: assets } = await supabase.from("social_assets").select("*").in("smm_id", smmIds).order("created_at", { ascending: false });
      setSquadAssets(assets || []);
      const assetIds = (assets || []).map(a => a.id);
      if (assetIds.length > 0) {
        const { data: metrics } = await supabase.from("weekly_metrics").select("*").in("asset_id", assetIds).order("week_of", { ascending: false });
        setSquadMetrics(metrics || []);
      }
    }
  };

  // Toggle Lock Manager's Weekly Input
  const handleToggleLock = async (smm: any) => {
    await supabase.from("profiles").update({ is_locked: !smm.is_locked }).eq("id", smm.id);
    setStatusMsg(`${smm.full_name}'s weekly metric input is now ${!smm.is_locked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
    await loadSquadData(tlProfile.id);
  };

  // Save Tasks, Campaigns, & Comments on Asset
  const handleUpdateAssetDirectives = async (assetId: string, tl_campaign: string, tl_task: string, tl_comment: string) => {
    await supabase.from("social_assets").update({ tl_campaign, tl_task, tl_comment }).eq("id", assetId);
    setStatusMsg("Campaign, Task, and Comment updated on asset!");
    await loadSquadData(tlProfile.id);
  };

  // Remove Social Media Account from Manager
  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this social media account from the manager?")) return;
    await supabase.from("social_assets").delete().eq("id", assetId);
    setStatusMsg("Social media asset removed.");
    await loadSquadData(tlProfile.id);
  };

  // Give Social Media Account to Manager
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
    setStatusMsg("New social media account assigned to manager!");
    await loadSquadData(tlProfile.id);
  };

  const filteredAssets = selectedSmm === "all" ? squadAssets : squadAssets.filter(a => a.smm_id === selectedSmm);

  if (!tlProfile) return <div className="flex min-h-screen items-center justify-center bg-black text-blue-400 font-mono">Loading Team Leader Command...</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-zinc-800 pb-5 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold">Team Leader Portal</span>
            <h1 className="text-3xl font-bold text-white mt-2">Commander {tlProfile.full_name}</h1>
            <p className="text-xs text-zinc-400">Region: {tlProfile.country} • Active Managers: {squadMembers.length} • Managed Assets: {squadAssets.length}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowGiveModal(!showGiveModal)} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg text-xs hover:bg-emerald-400">+ Give Account to Manager</button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400">Sign Out</button>
          </div>
        </div>

        {statusMsg && <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center font-bold">{statusMsg}</div>}

        {/* Modal to Give Social Media Account to a Manager */}
        {showGiveModal && (
          <form onSubmit={handleGiveAsset} className="bg-zinc-950 border border-emerald-500/40 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 uppercase">Assign / Give Social Media Account to Manager</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select value={assignSmmId} onChange={(e) => setAssignSmmId(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white">
                {squadMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select value={assignPlatform} onChange={(e) => setAssignPlatform(e.target.value)} className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white uppercase">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="text" required value={assignAccountId} onChange={(e) => setAssignAccountId(e.target.value)} placeholder="Account ID / @Handle" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              <input type="url" required value={assignLink} onChange={(e) => setAssignLink(e.target.value)} placeholder="Profile Link" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
              <input type="text" required value={assignPass} onChange={(e) => setAssignPass(e.target.value)} placeholder="Account Password" className="rounded-lg bg-black border border-zinc-800 p-2.5 text-sm text-white" />
            </div>
            <button type="submit" className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-lg text-xs">Confirm Assignment</button>
          </form>
        )}

        {/* 1. Managers Under Team Leader & Lock Weekly Input Toggle */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">1. Squad Managers & Weekly Input Lock Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {squadMembers.map(smm => {
              const smmAssets = squadAssets.filter(a => a.smm_id === smm.id);
              const smmAssetIds = smmAssets.map(a => a.id);
              const smmLogs = squadMetrics.filter(m => smmAssetIds.includes(m.asset_id));
              const totalImpr = smmLogs.reduce((acc, x) => acc + (x.impressions || 0), 0);
              const totalEng = smmLogs.reduce((acc, x) => acc + (x.engagements || 0), 0);

              return (
                <div key={smm.id} onClick={() => setSelectedSmm(selectedSmm === smm.id ? "all" : smm.id)} className={`cursor-pointer bg-zinc-950 border p-5 rounded-xl transition-all ${selectedSmm === smm.id ? "border-blue-500 shadow-lg shadow-blue-500/10" : "border-zinc-800 hover:border-zinc-700"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white">{smm.full_name}</h3>
                      <p className="text-xs text-zinc-400">{smm.country} • {smmAssets.length} Accounts</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(smm); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${smm.is_locked ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                    >
                      {smm.is_locked ? "🔒 Locked (Unlock)" : "🔓 Open (Lock Input)"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800 text-xs font-mono">
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL IMPR.</span><span className="text-blue-400 font-bold text-base">{totalImpr.toLocaleString()}</span></div>
                    <div><span className="text-zinc-500 block text-[10px]">TOTAL ENG.</span><span className="text-purple-400 font-bold text-base">{totalEng.toLocaleString()}</span></div>
                  </div>
                </div>
              );
            })}
            {squadMembers.length === 0 && <div className="col-span-3 text-zinc-500 text-sm p-6 bg-zinc-950 border border-zinc-800 rounded-xl">No SMMs have signed up under your Team Leader profile yet.</div>}
          </div>
        </div>

        {/* 2. Manager Assets: Tasks, Campaigns, Comments & Account Removal */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">2. Squad Social Media Assets — Tasks, Campaigns & Comments</h2>
            {selectedSmm !== "all" && <button onClick={() => setSelectedSmm("all")} className="text-xs text-blue-400 underline">Show All Squad Assets</button>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssets.map(asset => {
              const owner = squadMembers.find(m => m.id === asset.smm_id);
              const assetLogs = squadMetrics.filter(m => m.asset_id === asset.id);
              const latest = assetLogs[0];

              return (
                <AssetDirectiveCard
                  key={asset.id}
                  asset={asset}
                  ownerName={owner?.full_name || "SMM"}
                  latestMetric={latest}
                  onSave={handleUpdateAssetDirectives}
                  onRemove={handleRemoveAsset}
                />
              );
            })}
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

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">{asset.platform}</span>
          <span className="font-bold text-white">{asset.account_id}</span>
          <span className="text-xs text-zinc-400 ml-2">({ownerName})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${asset.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{asset.status.toUpperCase()}</span>
          <button onClick={() => onRemove(asset.id)} className="text-xs text-red-400 hover:underline ml-2">Remove</button>
        </div>
      </div>

      {latestMetric ? (
        <div className="grid grid-cols-4 gap-2 bg-zinc-900 p-3 rounded-lg text-xs font-mono">
          <div><span className="text-[10px] text-zinc-500 block">WEEK</span>{latestMetric.week_of}</div>
          <div><span className="text-[10px] text-zinc-500 block">IMPR</span><span className="text-blue-400">{latestMetric.impressions}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">ENG</span><span className="text-purple-400">{latestMetric.engagements}</span></div>
          <div><span className="text-[10px] text-zinc-500 block">FOLLOWERS</span><span className="text-emerald-400">{latestMetric.total_followers}</span></div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">No weekly metrics logged yet.</div>
      )}

      <div className="space-y-2 pt-2">
        <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Assign Campaign (e.g. Sahara Voice Umbrella)" className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Assign Weekly Task (e.g. Publish 15 threads)" className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave Comment / Feedback on Asset" className="w-full rounded bg-black border border-zinc-800 p-2 text-xs text-white" />
        <button onClick={() => onSave(asset.id, campaign, task, comment)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs transition-all">Save Directives & Comments</button>
      </div>
    </div>
  );
}
