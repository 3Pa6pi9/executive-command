export const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

export const AFRICAN_COUNTRIES = [
  "Kenya", "Nigeria", "Ghana", "South Africa",
  "Egypt", "Morocco", "Algeria", "Tunisia", "Uganda",
  "Tanzania", "Rwanda", "Senegal", "Cameroon", "Ivory Coast",
  "Zambia", "Zimbabwe", "DRC", "Sudan", "Angola"
];

export const EURASIA_SQUAD_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania",
  "France", "Afghan", "Crotia", "Serbia", "New Serbia",
  "Germany", "Kosavo", "Greece", "Hungary"
];

export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...EURASIA_SQUAD_COUNTRIES];

export const ASSET_LANGUAGES = [
  "English", "French", "Arabic", "Swahili", "Russian",
  "Belarusian", "Romanian", "German", "Serbian", "Croatian",
  "Albanian (Kosovo)", "Greek", "Hungarian", "Malay",
  "Pashto", "Dari", "Hausa", "Yoruba", "Igbo",
  "Zulu", "Afrikaans", "Kinyarwanda", "Wolof", "Lingala",
  "Portuguese", "Shona"
];

export type TimeHorizon = "weekly" | "monthly" | "quarterly" | "yearly";

export function normalizeAuthUsername(rawInput: string, defaultRoleTag?: "smm" | "tl" | "admin"): string {
  const clean = (rawInput || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!clean) return "";
  if (!clean.includes("@")) return `${clean}@${defaultRoleTag || "smm"}.executive.com`;
  if (clean.endsWith("@smm") || clean.endsWith("@tl") || clean.endsWith("@admin")) return `${clean}.executive.com`;
  const [localPart, domainPart = ""] = clean.split("@");
  return domainPart.includes(".") ? clean : `${localPart}@${domainPart}.executive.com`;
}

export function formatDisplayUsername(emailOrHandle?: string): string {
  if (!emailOrHandle) return "";
  return emailOrHandle.toLowerCase()
    .replace("@smm.executive.com", "@smm")
    .replace("@tl.executive.com", "@tl")
    .replace("@admin.executive.com", "@admin");
}

export function toLocalDatetimeInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export async function fetchAllRows(supabase: any, table: string, orderByCol = "created_at", filterCol?: string, filterVal?: any, maxRows = 25000): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [], from = 0;
  while (from < maxRows) {
    let q = supabase.from(table).select("*").order(orderByCol, { ascending: false }).range(from, from + PAGE - 1);
    if (filterCol && filterVal !== undefined) {
      if (Array.isArray(filterVal)) { if (!filterVal.length) return []; q = q.in(filterCol, filterVal); }
      else q = q.eq(filterCol, filterVal);
    }
    const { data, error } = await q;
    if (error || !data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function computeLive2FACode(rawSecret?: string): Promise<string> {
  if (!rawSecret) return "------";
  const cleaned = rawSecret.replace(/\s+/g, "").toUpperCase();
  if (/^\d{4,10}$/.test(cleaned)) return cleaned;
  return rawSecret.slice(0, 8);
}

export function parseBulkRows(rawText: string): string[][] {
  return rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const d = l.includes("\t") ? "\t" : ",";
    return l.split(d).map(c => c.trim().replace(/^"|"$/g, ""));
  });
}

export function getPeriodBucket(dateStr: string, horizon: TimeHorizon): string {
  if (!dateStr) return "Unknown";
  const clean = dateStr.trim();
  if (horizon === "weekly") return clean;
  const y = clean.slice(0, 4), m = parseInt(clean.slice(5, 7) || "1", 10);
  if (horizon === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  if (horizon === "quarterly") return `${y}-Q${Math.ceil(m / 3)}`;
  return y;
}

export function aggregateMetricsByHorizon(metrics: any[], horizon: TimeHorizon) {
  const map = new Map<string, any>();
  for (const m of metrics) {
    const period = getPeriodBucket(m.week_of, horizon);
    const key = `${m.asset_id}__${period}`;
    if (!map.has(key)) {
      map.set(key, { id: key, asset_id: m.asset_id, period, horizon, impressions: 0, engagements: 0, likes: 0, shares_reposts: 0, comments: 0, followers_gained: 0, followers_lost: 0, total_followers: 0, posts_published: 0, top_post_impressions: 0, weeks_counted: 0 });
    }
    const it = map.get(key);
    it.impressions += Number(m.impressions || 0);
    it.engagements += Number(m.engagements || 0);
    it.likes += Number(m.likes || 0);
    it.shares_reposts += Number(m.shares_reposts || 0);
    it.comments += Number(m.comments || 0);
    it.followers_gained += Number(m.followers_gained || 0);
    it.followers_lost += Number(m.followers_lost || 0);
    it.total_followers = Math.max(it.total_followers, Number(m.total_followers || 0));
    it.posts_published += Number(m.posts_published || 0);
    it.top_post_impressions = Math.max(it.top_post_impressions, Number(m.top_post_impressions || 0));
    it.weeks_counted += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}

export function exportHorizonCSV({ horizon, metrics, assets, profiles, projectFilter = "All", scopeLabel = "Enterprise" }: any) {
  const aggregated = aggregateMetricsByHorizon(metrics, horizon).filter(r => {
    const a = assets.find((x: any) => x.id === r.asset_id);
    return a && (projectFilter === "All" || a.project_name === projectFilter);
  });
  const headers = ["Horizon", "Period", "Project", "Team Leader", "SMM Handler", "Platform", "Asset ID", "Status", "Country", "Language", "Profile Link", "Impressions", "Engagements", "Eng %", "Likes", "Reposts", "Comments", "Net Followers", "Total Followers", "Posts"];
  const rows = aggregated.map(r => {
    const a = assets.find((x: any) => x.id === r.asset_id) || {};
    const smm = profiles.find((p: any) => p.id === a.smm_id) || {};
    const tl = profiles.find((p: any) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
    const engPct = r.impressions > 0 ? ((r.engagements / r.impressions) * 100).toFixed(2) : "0.00";
    return [`"${horizon.toUpperCase()}"`, `"${r.period}"`, `"${a.project_name || ""}"`, `"${tl.full_name || ""}"`, `"${smm.full_name || ""}"`, `"${a.platform || ""}"`, `"${a.account_id || ""}"`, `"${a.status || ""}"`, `"${a.country_language || ""}"`, `"${a.language || "English"}"`, `"${a.profile_link || ""}"`, r.impressions, r.engagements, engPct, r.likes, r.shares_reposts, r.comments, r.followers_gained - r.followers_lost, r.total_followers, r.posts_published].join(",");
  });
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${scopeLabel}_${horizon.toUpperCase()}_Report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function computeAchievements(assets: any[], metrics: any[]) {
  const totalImpr = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = metrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = metrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const activeCount = assets.filter(a => a.status === "active").length;
  const uniquePlatforms = new Set(assets.map(a => a.platform)).size;
  return [
    { id: "viral", title: "Viral Reach Titan", desc: "100,000+ Impressions", icon: "🚀", unlocked: totalImpr >= 100000, progress: Math.min(100, Math.round((totalImpr / 100000) * 100)), stat: `${totalImpr.toLocaleString()} Impr` },
    { id: "eng", title: "Engagement Architect", desc: "1,000+ Engagements", icon: "⚡", unlocked: totalEng >= 1000, progress: Math.min(100, Math.round((totalEng / 1000) * 100)), stat: `${totalEng.toLocaleString()} Eng` },
    { id: "posts", title: "Relentless Cadence", desc: "250+ Posts Published", icon: "🔥", unlocked: totalPosts >= 250, progress: Math.min(100, Math.round((totalPosts / 250) * 100)), stat: `${totalPosts.toLocaleString()} Posts` },
    { id: "omni", title: "Omni-Platform Commander", desc: "4+ Active Platforms", icon: "🌐", unlocked: uniquePlatforms >= 4, progress: Math.min(100, Math.round((uniquePlatforms / 4) * 100)), stat: `${uniquePlatforms}/6 Platforms` },
    { id: "shield", title: "Invincible Uptime Shield", desc: "5+ Active Assets", icon: "🛡️", unlocked: activeCount >= 5, progress: Math.min(100, Math.round((activeCount / 5) * 100)), stat: `${activeCount} Active` }
  ];
}
