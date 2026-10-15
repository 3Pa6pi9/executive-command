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
    name: "1. Obsidian Emerald",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    shellBg: "bg-black text-zinc-100",
    cardBorder: "border-emerald-500/40",
    accentBg: "bg-emerald-500 hover:bg-emerald-400 text-black",
    accentText: "text-emerald-400",
    glow: "shadow-[0_0_45px_-10px_rgba(16,185,129,0.4)]",
  },
  {
    id: "cyberpunk",
    name: "2. Cyberpunk Violet",
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
    shellBg: "bg-[#06030f] text-zinc-100",
    cardBorder: "border-fuchsia-500/40",
    accentBg: "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white",
    accentText: "text-fuchsia-400",
    glow: "shadow-[0_0_45px_-10px_rgba(217,70,239,0.45)]",
  },
  {
    id: "gold",
    name: "3. Sovereign Gold",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    shellBg: "bg-[#080704] text-zinc-100",
    cardBorder: "border-amber-500/40",
    accentBg: "bg-amber-500 hover:bg-amber-400 text-black",
    accentText: "text-amber-400",
    glow: "shadow-[0_0_45px_-10px_rgba(245,158,11,0.4)]",
  },
  {
    id: "cobalt",
    name: "4. Arctic Cobalt",
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    shellBg: "bg-[#030914] text-zinc-100",
    cardBorder: "border-sky-500/40",
    accentBg: "bg-sky-500 hover:bg-sky-400 text-black",
    accentText: "text-sky-400",
    glow: "shadow-[0_0_45px_-10px_rgba(14,165,233,0.4)]",
  },
  {
    id: "crimson",
    name: "5. Crimson Tactical",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    shellBg: "bg-[#0b0305] text-zinc-100",
    cardBorder: "border-rose-500/40",
    accentBg: "bg-rose-600 hover:bg-rose-500 text-white",
    accentText: "text-rose-400",
    glow: "shadow-[0_0_45px_-10px_rgba(244,63,94,0.4)]",
  },
];

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

// Complete, Clean CSV Exporter (Always includes Team Leader, SMM Handler, Platform, Country, Language, Asset ID + All 24 Metrics)
export function exportHorizonCSV({
  horizon = "weekly",
  sheetTab = "all",
  metrics,
  assets,
  profiles = [],
  projectFilter = "All",
  scopeLabel = "Admin_Control_Report",
}: {
  horizon?: TimeHorizon;
  sheetTab?: SheetTabOption;
  metrics: any[];
  assets: any[];
  profiles?: any[];
  projectFilter?: string;
  scopeLabel?: string;
}) {
  // 1. Achievements Sheet Format (with Team Leader, SMM Handler & Platform included)
  if (sheetTab === "achievements") {
    const headers = [
      "Date / Week",
      "Team Leader",
      "SMM Handler",
      "Platform",
      "Account Name (Asset ID)",
      "Country",
      "Language",
      "Profile Link",
      "Views / Impressions",
      "Likes",
      "Comments",
      "Shares / Reposts",
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

  // 2. Full Master Performance CSV Report (Row 1 is strictly clean column headers — no junk merged rows!)
  const headers = [
    "Horizon",
    "Period / Week Of",
    "Team Leader",
    "SMM Handler",
    "Platform",
    "Account Name (Asset ID)",
    "Status",
    "Country",
    "Language",
    "Campaign",
    "Profile Link",
    "Impressions",
    "Engagements",
    "Likes",
    "Reposts",
    "Comments",
    "Followers Gained",
    "Followers Lost",
    "Total Followers",
    "Posts Published",
    "Top Post Impr.",
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
    if (projectFilter !== "All" && (a.project_name || "General Campaign") !== projectFilter) return false;
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
          `"${asset.account_id || ""}"`,
          `"${(asset.status || "active").toUpperCase()}"`,
          `"${asset.country_language || "Global"}"`,
          `"${asset.language || "English"}"`,
          `"${asset.project_name || asset.tl_campaign || "General Campaign"}"`,
          `"${asset.profile_link || ""}"`,
          c.impr,
          c.eng,
          c.likes,
          c.reposts,
          c.comments,
          c.folGained,
          c.folLost,
          c.totalFol,
          c.posts,
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
  const totalImpr = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = metrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = metrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const totalFol = assets.reduce((sum, a) => {
    const aLogs = metrics.filter((m) => m.asset_id === a.id);
    const maxF = Math.max(0, ...aLogs.map((l) => Number(l.total_followers || 0)));
    return sum + maxF;
  }, 0);
  const activeCount = assets.filter((a) => a.status === "active").length;
  const uniquePlatforms = new Set(assets.map((a) => a.platform)).size;

  const defaults = [
    {
      id: "viral",
      title: "Viral Reach Titan",
      desc: "Reach 100,000+ Cumulative Impressions",
      icon: "🚀",
      unlocked: totalImpr >= 100000,
      progress: Math.min(100, Math.round((totalImpr / 100000) * 100)),
      stat: `${totalImpr.toLocaleString()} / 100,000 Impr`,
    },
    {
      id: "eng",
      title: "Engagement Architect",
      desc: "Generate 2,500+ Total Engagements",
      icon: "⚡",
      unlocked: totalEng >= 2500,
      progress: Math.min(100, Math.round((totalEng / 2500) * 100)),
      stat: `${totalEng.toLocaleString()} / 2,500 Eng`,
    },
    {
      id: "posts",
      title: "Relentless Cadence",
      desc: "Publish 250+ Total Posts",
      icon: "🔥",
      unlocked: totalPosts >= 250,
      progress: Math.min(100, Math.round((totalPosts / 250) * 100)),
      stat: `${totalPosts.toLocaleString()} / 250 Posts`,
    },
    {
      id: "omni",
      title: "Omni-Platform Force",
      desc: "Operate across 4+ Social Platforms",
      icon: "🌐",
      unlocked: uniquePlatforms >= 4,
      progress: Math.min(100, Math.round((uniquePlatforms / 4) * 100)),
      stat: `${uniquePlatforms} / 6 Platforms`,
    },
    {
      id: "shield",
      title: "Active Fleet Shield",
      desc: "Maintain 5+ Active Social Assets",
      icon: "🛡️",
      unlocked: activeCount >= 5,
      progress: Math.min(100, Math.round((activeCount / 5) * 100)),
      stat: `${activeCount} / 5 Active Assets`,
    },
  ];

  const customBuilt = (customMilestones || []).map((cm: any) => {
    const target = Math.max(1, Number(cm.target || 1000));
    const metricType = cm.metric || "engagements";
    const currentVal =
      metricType === "impressions"
        ? totalImpr
        : metricType === "followers"
        ? totalFol
        : metricType === "posts"
        ? totalPosts
        : metricType === "assets"
        ? activeCount
        : totalEng;

    return {
      id: cm.id || `custom-${cm.title}`,
      title: cm.title,
      desc: cm.desc || `Admin Milestone: ${target.toLocaleString()} ${metricType.toUpperCase()}`,
      icon: cm.icon || "👑",
      unlocked: currentVal >= target,
      progress: Math.min(100, Math.round((currentVal / target) * 100)),
      stat: `${currentVal.toLocaleString()} / ${target.toLocaleString()} ${metricType.toUpperCase()}`,
      isCustom: true,
    };
  });

  return [...customBuilt, ...defaults];
}
