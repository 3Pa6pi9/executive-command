import { downloadMultiTabWorkbook } from "./excelExport";
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
export function exportHorizonCSV(args: any) {
  return downloadMultiTabWorkbook(args);
}
export function computeAchievements(assets: any[], metrics: any[], ..._r: any[]) {
  const validIds = new Set(assets.map(a => a.id));
  const mList = metrics.filter(m => !validIds.size || validIds.has(m.asset_id));
  const views = mList.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const likes = mList.reduce((s, m) => s + Number(m.likes || m.engagements || 0), 0);
  const posts = mList.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const gained = mList.reduce((s, m) => s + Number(m.followers_gained || 0), 0);
  const lost = mList.reduce((s, m) => s + Number(m.followers_lost || 0), 0);
  const net = gained - lost;
  const fols = assets.reduce((s, a) => s + mList.filter(m => m.asset_id === a.id).reduce((mx, x) => Math.max(mx, Number(x.total_followers || 0)), 0), 0);
  return [
    { id: "acc", title: "Total Managed Accounts", desc: "Active social media accounts in scope", icon: "🗂", unlocked: assets.length > 0, progress: 100, stat: `${assets.length.toLocaleString()} Accounts` },
    { id: "posts", title: "Total Published Posts", desc: "Cumulative posts published across accounts", icon: "📝", unlocked: posts > 0, progress: Math.min(100, Math.round((posts / 250) * 100)), stat: `${posts.toLocaleString()} Total Posts` },
    { id: "views", title: "Total Views", desc: "Cumulative content views across all platforms", icon: "👁", unlocked: views > 0, progress: Math.min(100, Math.round((views / 100000) * 100)), stat: `${views.toLocaleString()} Total Views` },
    { id: "likes", title: "Total Likes", desc: "Cumulative audience likes and interactions", icon: "❤️", unlocked: likes > 0, progress: Math.min(100, Math.round((likes / 5000) * 100)), stat: `${likes.toLocaleString()} Total Likes` },
    { id: "fols", title: "Total Followers", desc: "Combined current follower count across accounts", icon: "👥", unlocked: fols > 0, progress: Math.min(100, Math.round((fols / 25000) * 100)), stat: `${fols.toLocaleString()} Total Followers` },
    { id: "net", title: "Followers Gained / Lost", desc: `+${gained.toLocaleString()} gained / -${lost.toLocaleString()} lost`, icon: "📈", unlocked: net >= 0, progress: 100, stat: `${net >= 0 ? "+" : ""}${net.toLocaleString()} Net Followers` }
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
