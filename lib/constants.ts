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
export type SheetTabOption = "all" | "twitter" | "facebook" | "instagram" | "tiktok" | "blog" | "medium" | "achievements";
export type AppThemeId = "emerald" | "cyberpunk" | "gold" | "cobalt" | "crimson";

export const APP_THEMES: {
  id: AppThemeId;
  name: string;
  badge: string;
  shellBg: string;
  cardBorder: string;
  accentBg: string;
  accentText: string;
  glow: string;
}[] = [
  {
    id: "emerald",
    name: "Theme: Obsidian Emerald",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    shellBg: "bg-black text-zinc-100",
    cardBorder: "border-emerald-500/40",
    accentBg: "bg-emerald-500 hover:bg-emerald-400 text-black",
    accentText: "text-emerald-400",
    glow: "shadow-[0_0_35px_-10px_rgba(16,185,129,0.35)]",
  },
  {
    id: "cyberpunk",
    name: "Theme: Royal Violet",
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
    shellBg: "bg-[#06030f] text-zinc-100",
    cardBorder: "border-fuchsia-500/40",
    accentBg: "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white",
    accentText: "text-fuchsia-400",
    glow: "shadow-[0_0_35px_-10px_rgba(217,70,239,0.4)]",
  },
  {
    id: "gold",
    name: "Theme: Executive Gold",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    shellBg: "bg-[#080704] text-zinc-100",
    cardBorder: "border-amber-500/40",
    accentBg: "bg-amber-500 hover:bg-amber-400 text-black",
    accentText: "text-amber-400",
    glow: "shadow-[0_0_35px_-10px_rgba(245,158,11,0.35)]",
  },
  {
    id: "cobalt",
    name: "Theme: Arctic Cobalt",
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    shellBg: "bg-[#030914] text-zinc-100",
    cardBorder: "border-sky-500/40",
    accentBg: "bg-sky-500 hover:bg-sky-400 text-black",
    accentText: "text-sky-400",
    glow: "shadow-[0_0_35px_-10px_rgba(14,165,233,0.35)]",
  },
  {
    id: "crimson",
    name: "Theme: Crimson Slate",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    shellBg: "bg-[#0b0305] text-zinc-100",
    cardBorder: "border-rose-500/40",
    accentBg: "bg-rose-600 hover:bg-rose-500 text-white",
    accentText: "text-rose-400",
    glow: "shadow-[0_0_35px_-10px_rgba(244,63,94,0.35)]",
  },
];

export function getAssetAccountName(asset: any): string {
  if (!asset) return "Unnamed Account";
  if (asset.account_name && String(asset.account_name).trim()) return String(asset.account_name).trim();
  if (asset.project_name && asset.project_name !== "General Campaign" && asset.project_name !== asset.tl_campaign) {
    return String(asset.project_name).trim();
  }
  return asset.account_id || "Account";
}

export function recordLocalArchiveEvent(entry: {
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  summary: string;
  record_snapshot?: any;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("executive_archive_events_v2");
    const list = raw ? JSON.parse(raw) : [];
    const newEvt = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      ...entry,
    };
    const next = [newEvt, ...list].slice(0, 400);
    localStorage.setItem("executive_archive_events_v2", JSON.stringify(next));
  } catch {}
}

export function mergeArchiveEvents(serverLogs: any[]): any[] {
  if (typeof window === "undefined") return serverLogs || [];
  try {
    const raw = localStorage.getItem("executive_archive_events_v2");
    const localList: any[] = raw ? JSON.parse(raw) : [];
    const combined = [...localList, ...(serverLogs || [])];
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const item of combined) {
      const sig = `${item.action}-${item.entity_type}-${item.summary}-${(item.created_at || "").slice(0, 16)}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        deduped.push(item);
      }
    }
    return deduped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } catch {
    return serverLogs || [];
  }
}

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
  return emailOrHandle
    .toLowerCase()
    .replace("@smm.executive.com", "@smm")
    .replace("@tl.executive.com", "@tl")
    .replace("@admin.executive.com", "@admin");
}

export async function fetchAllRows(
  supabase: any,
  table: string,
  orderByCol = "created_at",
  filterCol?: string,
  filterVal?: any,
  maxRows = 25000
): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [],
    from = 0;
  while (from < maxRows) {
    let q = supabase.from(table).select("*").order(orderByCol, { ascending: false }).range(from, from + PAGE - 1);
    if (filterCol && filterVal !== undefined) {
      if (Array.isArray(filterVal)) {
        if (!filterVal.length) return [];
        q = q.in(filterCol, filterVal);
      } else q = q.eq(filterCol, filterVal);
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
  return rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const d = l.includes("\t") ? "\t" : ",";
      return l.split(d).map((c) => c.trim().replace(/^"|"$/g, ""));
    });
}

export function getPeriodBucket(dateStr: string, horizon: TimeHorizon): string {
  if (!dateStr) return "Unknown";
  const clean = dateStr.trim();
  if (horizon === "weekly") return clean;
  const y = clean.slice(0, 4);
  const m = parseInt(clean.slice(5, 7) || "1", 10);
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
      map.set(key, {
        id: key,
        asset_id: m.asset_id,
        week_of: period,
        period,
        horizon,
        impressions: 0,
        engagements: 0,
        likes: 0,
        shares_reposts: 0,
        comments: 0,
        followers_gained: 0,
        followers_lost: 0,
        total_followers: 0,
        posts_published: 0,
        top_post_impressions: 0,
        weeks_counted: 0,
      });
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
  return Array.from(map.values());
}

export function computeRowMetricsAndScores(curr: any, prev: any | null) {
  const impr = Number(curr.impressions || 0);
  const eng = Number(curr.engagements || 0);
  const likes = Number(curr.likes || 0);
  const reposts = Number(curr.shares_reposts || 0);
  const comments = Number(curr.comments || 0);
  const folGained = Number(curr.followers_gained || 0);
  const folLost = Number(curr.followers_lost || 0);
  const totalFol = Number(curr.total_followers || 0);
  const posts = Number(curr.posts_published || 0);
  const topImpr = Number(curr.top_post_impressions || 0);
  const days = (curr.weeks_counted || 1) * 7;

  const engPct = impr > 0 ? (eng / impr) * 100 : 0;
  const netFol = folGained - folLost;
  const growthPct = totalFol > 0 ? (netFol / totalFol) * 100 : 0;
  const postsPerDay = posts / days;
  const reachEffPct = totalFol > 0 ? (impr / totalFol) * 100 : 0;
  const avgPostImpr = posts > 0 ? impr / posts : 0;
  const topLiftX = avgPostImpr > 0 ? topImpr / avgPostImpr : 0;

  const engageScore = Math.min(100, Math.max(0, Math.round(engPct * 15)));
  const growthScore = Math.min(100, Math.max(0, Math.round(50 + growthPct * 2)));
  const consistencyScore = Math.min(100, Math.max(0, Math.round((postsPerDay / 3) * 100)));
  const reachScore = Math.min(100, Math.max(0, Math.round(Math.min(100, reachEffPct / 5))));
  const topScore = Math.min(100, Math.max(0, Math.round(Math.min(100, topLiftX * 25))));
  const overallScore = Math.round(
    engageScore * 0.25 + growthScore * 0.2 + consistencyScore * 0.2 + reachScore * 0.2 + topScore * 0.15
  );

  let viewsWow = "0.00%";
  let engageWow = "0.00%";
  let folWow = "0";
  if (prev) {
    const prevImpr = Number(prev.impressions || 0);
    const prevEng = Number(prev.engagements || 0);
    const prevEngPct = prevImpr > 0 ? (prevEng / prevImpr) * 100 : 0;
    const prevTotalFol = Number(prev.total_followers || 0);

    if (prevImpr > 0) viewsWow = `${(((impr - prevImpr) / prevImpr) * 100).toFixed(2)}%`;
    engageWow = `${(engPct - prevEngPct).toFixed(2)}%`;
    const fDelta = totalFol - prevTotalFol;
    folWow = fDelta >= 0 ? `+${fDelta}` : String(fDelta);
  }

  return {
    impr,
    eng,
    likes,
    reposts,
    comments,
    folGained,
    folLost,
    totalFol,
    posts,
    topImpr,
    engPct: `${engPct.toFixed(2)}%`,
    netFol,
    growthPct: `${growthPct.toFixed(2)}%`,
    postsPerDay: postsPerDay.toFixed(2),
    reachEffPct: `${reachEffPct.toFixed(1)}%`,
    topLiftX: topLiftX.toFixed(2),
    engageScore,
    growthScore,
    consistencyScore,
    reachScore,
    topScore,
    overallScore,
    viewsWow,
    engageWow,
    folWow,
  };
}

// Clean CSV Exporter (Campaign column removed; includes Account Name, Username, Handler, Team Leader, Platform & Metrics)
export function exportHorizonCSV({
  horizon = "weekly",
  sheetTab = "all",
  metrics,
  assets,
  profiles = [],
  scopeLabel = "Performance_Report",
}: {
  horizon?: TimeHorizon;
  sheetTab?: SheetTabOption;
  metrics: any[];
  assets: any[];
  profiles?: any[];
  projectFilter?: string;
  scopeLabel?: string;
}) {
  if (sheetTab === "achievements") {
    const headers = [
      "Date",
      "Team Leader",
      "SMM Handler",
      "Platform",
      "Account Name",
      "Username",
      "Country",
      "Language",
      "Profile Link",
      "Total Views",
      "Total Likes",
      "Comments",
      "Reposts",
    ];
    const rows = metrics.map((m) => {
      const a = assets.find((x) => x.id === m.asset_id) || {};
      const smm = profiles.find((p) => p.id === a.smm_id) || {};
      const tl = profiles.find((p) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
      return [
        `"${m.week_of || ""}"`,
        `"${tl.full_name || "Unassigned"}"`,
        `"${smm.full_name || "SMM Handler"}"`,
        `"${(a.platform || "").toUpperCase()}"`,
        `"${getAssetAccountName(a)}"`,
        `"${a.account_id || ""}"`,
        `"${a.country_language || ""}"`,
        `"${a.language || "English"}"`,
        `"${a.profile_link || ""}"`,
        m.impressions || 0,
        m.likes || 0,
        m.comments || 0,
        m.shares_reposts || 0,
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${scopeLabel}_Achievements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const headers = [
    "Horizon",
    "Week Of",
    "Team Leader",
    "SMM Handler",
    "Platform",
    "Account Name",
    "Username",
    "Status",
    "Country",
    "Language",
    "Profile Link",
    "Total Posts",
    "Total Views",
    "Total Likes",
    "Engagements",
    "Reposts",
    "Comments",
    "Followers Gained",
    "Followers Lost",
    "Total Followers",
    "Top Post Views",
    "Engagement %",
    "Net Followers",
    "Growth %",
    "Posts/Day",
    "Reach Eff %",
    "Top Lift x",
    "Engage Score",
    "Growth Score",
    "Consistency Score",
    "Reach Score",
    "Top Score",
    "OVERALL Score",
    "Views Δ% WoW",
    "Engage Δ% WoW",
    "Followers Δ WoW",
  ];

  const scopedAssets = assets.filter((a) => {
    if (sheetTab !== "all" && (a.platform || "").toLowerCase() !== sheetTab.toLowerCase()) return false;
    return true;
  });

  const aggregatedPool = aggregateMetricsByHorizon(metrics, horizon);
  const rows: string[] = [];

  for (const asset of scopedAssets) {
    const smm = profiles.find((p) => p.id === asset.smm_id) || {};
    const tl = profiles.find((p) => p.id === (asset.team_leader_id || smm.team_leader_id)) || {};

    const assetLogs = aggregatedPool
      .filter((m) => m.asset_id === asset.id)
      .sort((a, b) => (a.week_of || "").localeCompare(b.week_of || ""));

    for (let i = 0; i < assetLogs.length; i++) {
      const curr = assetLogs[i];
      const prev = i > 0 ? assetLogs[i - 1] : null;
      const c = computeRowMetricsAndScores(curr, prev);

      rows.push(
        [
          `"${horizon.toUpperCase()}"`,
          `"${curr.week_of || ""}"`,
          `"${tl.full_name || "Unassigned"}"`,
          `"${smm.full_name || "SMM Handler"}"`,
          `"${(asset.platform || "").toUpperCase()}"`,
          `"${getAssetAccountName(asset)}"`,
          `"${asset.account_id || ""}"`,
          `"${(asset.status || "active").toUpperCase()}"`,
          `"${asset.country_language || "Global"}"`,
          `"${asset.language || "English"}"`,
          `"${asset.profile_link || ""}"`,
          c.posts,
          c.impr,
          c.likes,
          c.eng,
          c.reposts,
          c.comments,
          c.folGained,
          c.folLost,
          c.totalFol,
          c.topImpr,
          `"${c.engPct}"`,
          c.netFol,
          `"${c.growthPct}"`,
          c.postsPerDay,
          `"${c.reachEffPct}"`,
          c.topLiftX,
          c.engageScore,
          c.growthScore,
          c.consistencyScore,
          c.reachScore,
          c.topScore,
          c.overallScore,
          `"${c.viewsWow}"`,
          `"${c.engageWow}"`,
          `"${c.folWow}"`,
        ].join(",")
      );
    }
  }

  const platLabel = sheetTab === "all" ? "All_Platforms" : sheetTab.toUpperCase();
  const csvContent = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${scopeLabel}_${platLabel}_${horizon.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function computeAchievements(assets: any[], metrics: any[], customMilestones: any[] = []) {
  const assetIds = new Set(assets.map((a) => a.id));
  const scopedMetrics = metrics.filter((m) => assetIds.has(m.asset_id));

  const totalImpr = scopedMetrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = scopedMetrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = scopedMetrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const totalLikes = scopedMetrics.reduce((s, m) => s + Number(m.likes || 0), 0);

  const totalFol = assets.reduce((sum, a) => {
    const aLogs = scopedMetrics
      .filter((m) => m.asset_id === a.id)
      .sort((x, y) => (y.week_of || "").localeCompare(x.week_of || ""));
    return sum + Number(aLogs[0]?.total_followers || 0);
  }, 0);

  const activeCount = assets.filter((a) => a.status === "active").length;
  const uniquePlatforms = new Set(assets.map((a) => a.platform)).size;

  const defaults = [
    {
      id: "viral",
      title: "100K Views Milestone",
      desc: "Reach 100,000+ Total Views",
      icon: "🚀",
      unlocked: totalImpr >= 100000,
      progress: Math.min(100, Math.round((totalImpr / 100000) * 100)),
      stat: `${totalImpr.toLocaleString()} / 100,000 Views`,
    },
    {
      id: "eng",
      title: "Engagement Milestone",
      desc: "Generate 2,500+ Total Engagements",
      icon: "⚡",
      unlocked: totalEng >= 2500,
      progress: Math.min(100, Math.round((totalEng / 2500) * 100)),
      stat: `${totalEng.toLocaleString()} / 2,500 Engagements`,
    },
    {
      id: "posts",
      title: "Publishing Volume",
      desc: "Publish 250+ Total Posts",
      icon: "🔥",
      unlocked: totalPosts >= 250,
      progress: Math.min(100, Math.round((totalPosts / 250) * 100)),
      stat: `${totalPosts.toLocaleString()} / 250 Posts`,
    },
    {
      id: "omni",
      title: "Multi-Platform Coverage",
      desc: "Manage accounts across 4+ Platforms",
      icon: "🌐",
      unlocked: uniquePlatforms >= 4,
      progress: Math.min(100, Math.round((uniquePlatforms / 4) * 100)),
      stat: `${uniquePlatforms} / 6 Platforms`,
    },
    {
      id: "shield",
      title: "Active Account Capacity",
      desc: "Maintain 5+ Active Accounts",
      icon: "🛡️",
      unlocked: activeCount >= 5,
      progress: Math.min(100, Math.round((activeCount / 5) * 100)),
      stat: `${activeCount} / 5 Active Accounts`,
    },
  ];

  const customBuilt = (customMilestones || []).map((cm: any) => {
    const target = Math.max(1, Number(cm.target || 1000));
    const metricType = cm.metric || "engagements";
    const currentVal =
      metricType === "impressions" || metricType === "views"
        ? totalImpr
        : metricType === "likes"
        ? totalLikes
        : metricType === "followers"
        ? totalFol
        : metricType === "posts"
        ? totalPosts
        : metricType === "assets" || metricType === "accounts"
        ? activeCount
        : totalEng;

    return {
      id: cm.id || `custom-${cm.title}`,
      title: cm.title,
      desc: cm.desc || `Target: ${target.toLocaleString()} ${metricType.toUpperCase()}`,
      icon: cm.icon || "🏆",
      unlocked: currentVal >= target,
      progress: Math.min(100, Math.round((currentVal / target) * 100)),
      stat: `${currentVal.toLocaleString()} / ${target.toLocaleString()} ${metricType.toUpperCase()}`,
      isCustom: true,
    };
  });

  return [...customBuilt, ...defaults];
}
