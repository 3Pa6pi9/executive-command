export const PLATFORMS = ["twitter","instagram","facebook","tiktok","blog","medium"];
export const AFRICAN_COUNTRIES = ["Kenya","Nigeria","Ghana","South Africa","Egypt","Morocco","Algeria","Tunisia","Uganda","Tanzania","Rwanda","Senegal","Cameroon","Ivory Coast","Zambia","Zimbabwe","DRC","Sudan","Angola"];
export const EURASIA_SQUAD_COUNTRIES = ["UK","Malaysia","Russia","Belurus","Romania","France","Afghan","Crotia","Serbia","New Serbia","Germany","Kosavo","Greece","Hungary"];
export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...EURASIA_SQUAD_COUNTRIES];
export type TimeHorizon = "weekly" | "monthly" | "quarterly" | "yearly";
export const ASSET_LANGUAGES = ["English","French","Arabic","Swahili","Russian","Belarusian","Romanian","German","Serbian","Croatian","Albanian (Kosovo)","Greek","Hungarian","Malay","Pashto","Dari","Hausa","Yoruba","Igbo","Zulu","Afrikaans","Kinyarwanda","Wolof","Lingala","Portuguese","Shona"];
export type AppThemeId = string;
export const APP_THEMES: any[] = [
  { id: "obsidian", name: "Obsidian", label: "Obsidian", icon: "🌑", shellBg: "bg-black text-zinc-100", cardBg: "bg-zinc-950 border-zinc-800" },
  { id: "midnight", name: "Midnight", label: "Midnight", icon: "🌌", shellBg: "bg-slate-950 text-slate-100", cardBg: "bg-slate-900 border-slate-800" },
  { id: "cyberpunk", name: "Cyberpunk", label: "Cyberpunk", icon: "⚡", shellBg: "bg-[#090414] text-purple-100", cardBg: "bg-[#120826] border-purple-500/30" },
  { id: "emerald", name: "Emerald", label: "Emerald", icon: "🌲", shellBg: "bg-[#020d08] text-emerald-50", cardBg: "bg-[#061a10] border-emerald-500/30" }
];
APP_THEMES.forEach((t: any) => Object.defineProperty(APP_THEMES, t.id, { value: t, enumerable: false }));
const _cache = new Map<string, { ts: number; data: any[] }>();
const _inflight = new Map<string, Promise<any[]>>();
export async function fetchAllRows(sb: any, tbl: string, ord = "created_at", fCol?: string, fVal?: any): Promise<any[]> {
  const key = `${tbl}_${ord}_${fCol}_${JSON.stringify(fVal || "")}`;
  const now = Date.now(), hit = _cache.get(key);
  if (hit && now - hit.ts < 600) return hit.data;
  if (_inflight.has(key)) return _inflight.get(key)!;
  const p = (async () => {
    let q = sb.from(tbl).select("*").order(ord, { ascending: false }).limit(5000);
    if (fCol && fVal !== undefined) q = Array.isArray(fVal) ? (fVal.length ? q.in(fCol, fVal) : q.limit(0)) : q.eq(fCol, fVal);
    const { data } = await q;
    const res = data || [];
    _cache.set(key, { ts: Date.now(), data: res });
    _inflight.delete(key);
    return res;
  })();
  _inflight.set(key, p);
  return p;
}
export function parseBulkRows(raw: string): string[][] {
  return raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(l.includes("\t") ? "\t" : ",").map(c => c.trim().replace(/^"|"$/g, "")));
}
export function getPeriodBucket(dt: string, h: TimeHorizon, ..._r: any[]): string {
  if (!dt || h === "weekly") return (dt || "Unknown").trim();
  const y = dt.slice(0, 4), m = parseInt(dt.slice(5, 7) || "1", 10);
  return h === "monthly" ? `${y}-${String(m).padStart(2, "0")}` : h === "quarterly" ? `${y}-Q${Math.ceil(m / 3)}` : y;
}
export function aggregateMetricsByHorizon(metrics: any[], horizon: TimeHorizon, ..._r: any[]) {
  const map = new Map<string, any>();
  for (const m of metrics) {
    const period = getPeriodBucket(m.week_of, horizon), key = `${m.asset_id}__${period}`;
    if (!map.has(key)) map.set(key, { id: key, asset_id: m.asset_id, period, horizon, impressions: 0, engagements: 0, likes: 0, shares_reposts: 0, comments: 0, followers_gained: 0, followers_lost: 0, total_followers: 0, posts_published: 0, top_post_impressions: 0, weeks_counted: 0 });
    const it = map.get(key);
    it.impressions += Number(m.impressions || 0); it.engagements += Number(m.engagements || 0);
    it.likes += Number(m.likes || 0); it.shares_reposts += Number(m.shares_reposts || 0); it.comments += Number(m.comments || 0);
    it.followers_gained += Number(m.followers_gained || 0); it.followers_lost += Number(m.followers_lost || 0);
    it.total_followers = Math.max(it.total_followers, Number(m.total_followers || 0));
    it.posts_published += Number(m.posts_published || 0); it.top_post_impressions = Math.max(it.top_post_impressions, Number(m.top_post_impressions || 0));
    it.weeks_counted += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}
export function exportHorizonCSV({ horizon, metrics, assets, profiles, projectFilter = "All", scopeLabel = "Executive_Command" }: any) {
  const rows = aggregateMetricsByHorizon(metrics, horizon).filter(r => {
    const a = assets.find((x: any) => x.id === r.asset_id);
    return a && (projectFilter === "All" || a.project_name === projectFilter);
  }).map(r => {
    const a = assets.find((x: any) => x.id === r.asset_id) || {};
    const smm = profiles.find((p: any) => p.id === a.smm_id) || {};
    const tl = profiles.find((p: any) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
    const eng = r.impressions > 0 ? ((r.engagements / r.impressions) * 100).toFixed(2) : "0.00";
    const net = r.followers_gained - r.followers_lost;
    return [`"${horizon.toUpperCase()}"`,`"${r.period}"`,`"${tl.full_name || "Unassigned"}"`,`"${smm.full_name || "Unassigned"}"`,`"${(a.platform || "").toUpperCase()}"`,`"${a.account_id || ""}"`,`"${(a.status || "active").toUpperCase()}"`,`"${a.country_language || ""}"`,`"${a.language || "English"}"`,`"${a.tl_campaign || a.project_name || "General"}"`,r.impressions,r.engagements,`${eng}%`,r.likes,r.shares_reposts,r.comments,r.followers_gained,r.followers_lost,net,r.total_followers,r.posts_published,r.top_post_impressions,`"${a.profile_link || ""}"`].join(",");
  });
  const hdr = ["Horizon","Period","Team Leader","SMM Handler","Platform","Asset Handle","Status","Country","Language","Campaign","Impressions","Engagements","Eng %","Likes","Reposts","Comments","Followers Gained","Followers Lost","Net Followers","Total Followers","Posts","Top Post Impr","Profile Link"].join(",");
  const el = document.createElement("a");
  el.href = URL.createObjectURL(new Blob(["\uFEFF" + [hdr, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }));
  el.download = `${scopeLabel}_${horizon.toUpperCase()}_Report.csv`;
  el.click();
}
export function computeAchievements(assets: any[], metrics: any[], ..._r: any[]) {
  const impr = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const eng = metrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const posts = metrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const active = assets.filter(a => a.status === "active").length;
  return [
    { id: "viral", title: "Viral Reach Titan", desc: "100,000+ Impressions", icon: "🚀", unlocked: impr >= 100000, progress: Math.min(100, Math.round((impr / 100000) * 100)), stat: `${impr.toLocaleString()} Impr` },
    { id: "eng", title: "Engagement Architect", desc: "1,000+ Engagements", icon: "⚡", unlocked: eng >= 1000, progress: Math.min(100, Math.round((eng / 1000) * 100)), stat: `${eng.toLocaleString()} Eng` },
    { id: "posts", title: "Relentless Cadence", desc: "250+ Posts Published", icon: "🔥", unlocked: posts >= 250, progress: Math.min(100, Math.round((posts / 250) * 100)), stat: `${posts.toLocaleString()} Posts` },
    { id: "shield", title: "Invincible Uptime Shield", desc: "5+ Active Assets", icon: "🛡️", unlocked: active >= 5, progress: Math.min(100, Math.round((active / 5) * 100)), stat: `${active} Active` }
  ];
}
export type SheetTabOption = string;
export function normalizeAuthUsername(raw: string, tag = "smm", ..._r: any[]): string {
  const c = (raw || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!c) return "";
  if (!c.includes("@")) return `${c}@${tag}.executive.com`;
  if (c.endsWith("@smm") || c.endsWith("@tl") || c.endsWith("@admin")) return `${c}.executive.com`;
  const [l, d = ""] = c.split("@");
  return d.includes(".") ? c : `${l}@${d}.executive.com`;
}
export function formatDisplayUsername(e?: string): string {
  return (e || "").toLowerCase().replace("@smm.executive.com","@smm").replace("@tl.executive.com","@tl").replace("@admin.executive.com","@admin");
}
export async function computeLive2FACode(s?: string): Promise<string> {
  return s ? s.replace(/\s+/g, "").slice(0, 8).toUpperCase() : "------";
}
