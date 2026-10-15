export const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

export const AFRICAN_COUNTRIES = [
  "Ethiopia", "Kenya", "Nigeria", "Ghana", "South Africa",
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

export type TimeHorizon = "weekly" | "monthly" | "quarterly" | "yearly";

export function parseBulkRows(rawText: string): string[][] {
  return rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const delimiter = line.includes("\t") ? "\t" : ",";
      return line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ""));
    });
}

// Converts a YYYY-MM-DD date string into Weekly, Monthly, Quarterly, or Yearly bucket key
export function getPeriodBucket(dateStr: string, horizon: TimeHorizon): string {
  if (!dateStr) return "Unknown";
  const clean = dateStr.trim();
  if (horizon === "weekly") return clean;
  const year = clean.slice(0, 4);
  const month = parseInt(clean.slice(5, 7) || "1", 10);
  if (horizon === "monthly") return `${year}-${String(month).padStart(2, "0")}`;
  if (horizon === "quarterly") {
    const q = Math.ceil(month / 3);
    return `${year}-Q${q}`;
  }
  return year;
}

// Aggregates raw weekly_metrics rows by (asset_id + period bucket) for Weekly/Monthly/Quarterly/Yearly views & CSVs
export function aggregateMetricsByHorizon(metrics: any[], horizon: TimeHorizon) {
  const map = new Map<string, any>();

  for (const m of metrics) {
    const period = getPeriodBucket(m.week_of, horizon);
    const key = `${m.asset_id}__${period}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        asset_id: m.asset_id,
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
        weeks_counted: 0
      });
    }
    const item = map.get(key);
    item.impressions += Number(m.impressions || 0);
    item.engagements += Number(m.engagements || 0);
    item.likes += Number(m.likes || 0);
    item.shares_reposts += Number(m.shares_reposts || 0);
    item.comments += Number(m.comments || 0);
    item.followers_gained += Number(m.followers_gained || 0);
    item.followers_lost += Number(m.followers_lost || 0);
    item.total_followers = Math.max(item.total_followers, Number(m.total_followers || 0));
    item.posts_published += Number(m.posts_published || 0);
    item.top_post_impressions = Math.max(item.top_post_impressions, Number(m.top_post_impressions || 0));
    item.weeks_counted += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}

// Universal Multi-Horizon CSV Exporter (Weekly, Monthly, Quarterly, Yearly)
export function exportHorizonCSV({
  horizon,
  metrics,
  assets,
  profiles,
  projectFilter = "All",
  scopeLabel = "Enterprise"
}: {
  horizon: TimeHorizon;
  metrics: any[];
  assets: any[];
  profiles: any[];
  projectFilter?: string;
  scopeLabel?: string;
}) {
  const aggregated = aggregateMetricsByHorizon(metrics, horizon);

  const filtered = aggregated.filter(row => {
    const asset = assets.find(a => a.id === row.asset_id);
    if (!asset) return false;
    if (projectFilter !== "All" && asset.project_name !== projectFilter) return false;
    return true;
  });

  const headers = [
    "Horizon", "Period", "Project", "Team Leader", "SMM Handler", "Platform",
    "Asset ID (@Handle)", "Status", "Country", "Profile Link",
    "Impressions", "Engagements", "Engagement %", "Likes", "Reposts", "Comments",
    "Followers Gained", "Followers Lost", "Net Followers", "Peak Total Followers",
    "Posts Published", "Posts/Day", "Top Post Impr."
  ];

  const rows = filtered.map(r => {
    const asset = assets.find(a => a.id === r.asset_id) || {};
    const smm = profiles.find(p => p.id === asset.smm_id) || {};
    const tl = profiles.find(p => p.id === (asset.team_leader_id || smm.team_leader_id)) || {};
    const engPct = r.impressions > 0 ? ((r.engagements / r.impressions) * 100).toFixed(2) : "0.00";
    const netFol = r.followers_gained - r.followers_lost;
    const days = Math.max(7, r.weeks_counted * 7);
    const postsDay = (r.posts_published / days).toFixed(2);

    return [
      `"${horizon.toUpperCase()}"`,
      `"${r.period}"`,
      `"${asset.project_name || "General Campaign"}"`,
      `"${tl.full_name || "Unassigned"}"`,
      `"${smm.full_name || "SMM"}"`,
      `"${(asset.platform || "").toUpperCase()}"`,
      `"${asset.account_id || ""}"`,
      `"${asset.status || ""}"`,
      `"${asset.country_language || ""}"`,
      `"${asset.profile_link || ""}"`,
      r.impressions,
      r.engagements,
      engPct,
      r.likes,
      r.shares_reposts,
      r.comments,
      r.followers_gained,
      r.followers_lost,
      netFol,
      r.total_followers,
      r.posts_published,
      postsDay,
      r.top_post_impressions
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${scopeLabel}_${horizon.toUpperCase()}_Report_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Computes Achievements & Badges for any set of Assets & Metrics
export function computeAchievements(assets: any[], metrics: any[]) {
  const totalImpr = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const totalEng = metrics.reduce((s, m) => s + Number(m.engagements || 0), 0);
  const totalPosts = metrics.reduce((s, m) => s + Number(m.posts_published || 0), 0);
  const totalFollowers = assets.reduce((s, a) => {
    const aLogs = metrics.filter(m => m.asset_id === a.id);
    const maxFol = aLogs.reduce((max, x) => Math.max(max, Number(x.total_followers || 0)), 0);
    return s + maxFol;
  }, 0);
  const avgEngRate = totalImpr > 0 ? (totalEng / totalImpr) * 100 : 0;
  const activeCount = assets.filter(a => a.status === "active").length;
  const uniquePlatforms = new Set(assets.map(a => a.platform)).size;

  return [
    {
      id: "viral_titan",
      title: "Viral Reach Titan",
      desc: "Surpass 100,000 cumulative impressions across managed assets",
      icon: "🚀",
      unlocked: totalImpr >= 100000,
      progress: Math.min(100, Math.round((totalImpr / 100000) * 100)),
      stat: `${totalImpr.toLocaleString()} / 100,000 Impr.`
    },
    {
      id: "engagement_elite",
      title: "Engagement Architect",
      desc: "Maintain an average engagement rate above 5.0% with 1,000+ engagements",
      icon: "⚡",
      unlocked: avgEngRate >= 5 && totalEng >= 1000,
      progress: Math.min(100, Math.round((avgEngRate / 5) * 100)),
      stat: `${avgEngRate.toFixed(2)}% Avg Eng Rate`
    },
    {
      id: "community_builder",
      title: "Audience Empire",
      desc: "Reach 25,000+ total followers across active social assets",
      icon: "👑",
      unlocked: totalFollowers >= 25000,
      progress: Math.min(100, Math.round((totalFollowers / 25000) * 100)),
      stat: `${totalFollowers.toLocaleString()} / 25,000 Followers`
    },
    {
      id: "prolific_publisher",
      title: "Relentless Cadence",
      desc: "Publish 250+ tracked posts across campaign weeks",
      icon: "🔥",
      unlocked: totalPosts >= 250,
      progress: Math.min(100, Math.round((totalPosts / 250) * 100)),
      stat: `${totalPosts.toLocaleString()} / 250 Posts`
    },
    {
      id: "omni_channel",
      title: "Omni-Platform Commander",
      desc: "Operate active assets across at least 4 distinct social networks",
      icon: "🌐",
      unlocked: uniquePlatforms >= 4,
      progress: Math.min(100, Math.round((uniquePlatforms / 4) * 100)),
      stat: `${uniquePlatforms} / 6 Platforms Active`
    },
    {
      id: "iron_shield",
      title: "Invincible Uptime Shield",
      desc: "Maintain 5+ active social media assets with zero suspensions",
      icon: "🛡️",
      unlocked: activeCount >= 5 && assets.every(a => a.status === "active"),
      progress: Math.min(100, Math.round((activeCount / 5) * 100)),
      stat: `${activeCount} Active Assets`
    }
  ];
}
