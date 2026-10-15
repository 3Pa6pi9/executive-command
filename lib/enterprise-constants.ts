import { managerSupabase as supabase } from "@/lib/supabase";

export const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

// Specific Sovereign African Countries (No generic "Africa" continent label)
export const AFRICAN_COUNTRIES = [
  "Ethiopia", "Kenya", "Nigeria", "Ghana", "South Africa",
  "Egypt", "Morocco", "Tanzania", "Uganda", "Rwanda",
  "Senegal", "Cameroon", "Algeria", "Tunisia", "Côte d'Ivoire",
  "Zambia", "Zimbabwe", "Angola", "Mozambique", "DRC"
];

// European & Asian Countries from Organizational Hierarchy
export const EURASIA_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belarus", "Romania",
  "France", "Afghanistan", "Croatia", "Serbia", "New Serbia",
  "Germany", "Kosovo", "Greece", "Hungary"
];

export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...EURASIA_COUNTRIES];

// Maximum-Security Authenticated API Caller (Injects Cryptographic Supabase JWT Bearer Token)
export async function secureCrudRequest(body: {
  entity: "profile" | "asset" | "metric";
  action: string;
  payload: any;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  const actorId = session?.user?.id || "";

  const res = await fetch("/api/crud", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ ...body, actorId })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Operation failed");
  return data;
}

// Time-Horizon Bucket Helper (Weekly, Monthly, Quarterly, Yearly)
export function getTimeBucketKey(dateStr: string, horizon: "weekly" | "monthly" | "quarterly" | "yearly"): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return dateStr;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;

  if (horizon === "weekly") return dateStr;
  if (horizon === "monthly") return `${year}-${String(month).padStart(2, "0")}`;
  if (horizon === "quarterly") {
    const q = Math.ceil(month / 3);
    return `${year}-Q${q}`;
  }
  return `${year}`;
}

export function getDaysInBucket(horizon: "weekly" | "monthly" | "quarterly" | "yearly"): number {
  if (horizon === "weekly") return 7;
  if (horizon === "monthly") return 30;
  if (horizon === "quarterly") return 90;
  return 365;
}

// Multi-Horizon CSV Rollup & Export Engine
export function exportEnterpriseCSV({
  horizon,
  periodFilter,
  metrics,
  assets,
  profiles,
  filePrefix = "Executive_Command"
}: {
  horizon: "weekly" | "monthly" | "quarterly" | "yearly";
  periodFilter?: string;
  metrics: any[];
  assets: any[];
  profiles: any[];
  filePrefix?: string;
}) {
  const headers = [
    "Time Horizon", "Period", "Project / Campaign", "Team Leader", "SMM Handler",
    "Countries", "Platform", "Asset ID", "Asset Status", "Profile Link",
    "Impressions", "Engagements", "Engagement Rate %", "Likes", "Reposts / Shares",
    "Comments", "Followers Gained", "Followers Lost", "Net Follower Growth",
    "Latest Total Followers", "Posts Published", "Posts / Day", "Top Post Impressions", "Weeks Logged"
  ];

  // Group metrics by (asset_id + periodBucket)
  const grouped = new Map<string, any>();

  for (const m of metrics) {
    if (m.is_archived) continue;
    const asset = assets.find(a => a.id === m.asset_id);
    if (!asset) continue;

    const bucket = getTimeBucketKey(m.week_of, horizon);
    if (periodFilter && periodFilter !== "ALL" && bucket !== periodFilter) continue;

    const key = `${asset.id}__${bucket}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        bucket,
        asset,
        impressions: 0,
        engagements: 0,
        likes: 0,
        shares_reposts: 0,
        comments: 0,
        followers_gained: 0,
        followers_lost: 0,
        total_followers: m.total_followers || 0,
        latest_week: m.week_of,
        posts_published: 0,
        top_post_impressions: 0,
        weeks_count: 0
      });
    }

    const g = grouped.get(key)!;
    g.impressions += Number(m.impressions || 0);
    g.engagements += Number(m.engagements || 0);
    g.likes += Number(m.likes || 0);
    g.shares_reposts += Number(m.shares_reposts || 0);
    g.comments += Number(m.comments || 0);
    g.followers_gained += Number(m.followers_gained || 0);
    g.followers_lost += Number(m.followers_lost || 0);
    g.posts_published += Number(m.posts_published || 0);
    g.top_post_impressions = Math.max(g.top_post_impressions, Number(m.top_post_impressions || 0));
    g.weeks_count += 1;

    if (m.week_of >= g.latest_week) {
      g.latest_week = m.week_of;
      g.total_followers = Number(m.total_followers || g.total_followers);
    }
  }

  const daysDivisor = getDaysInBucket(horizon);
  const rows: string[] = [];

  Array.from(grouped.values())
    .sort((a, b) => b.bucket.localeCompare(a.bucket))
    .forEach(g => {
      const asset = g.asset;
      const smm = profiles.find(p => p.id === asset.smm_id) || {};
      const tl = profiles.find(p => p.id === (asset.team_leader_id || smm.team_leader_id)) || {};
      const engRate = g.impressions > 0 ? ((g.engagements / g.impressions) * 100).toFixed(2) : "0.00";
      const netFol = g.followers_gained - g.followers_lost;
      const postsPerDay = (g.posts_published / daysDivisor).toFixed(2);

      rows.push([
        `"${horizon.toUpperCase()}"`,
        `"${g.bucket}"`,
        `"${(asset.project_name || "General Campaign").replace(/"/g, '""')}"`,
        `"${(tl.full_name || "Unassigned").replace(/"/g, '""')}"`,
        `"${(smm.full_name || "Unassigned").replace(/"/g, '""')}"`,
        `"${(asset.country_language || smm.country || "").replace(/"/g, '""')}"`,
        `"${(asset.platform || "").toUpperCase()}"`,
        `"${(asset.account_id || "").replace(/"/g, '""')}"`,
        `"${(asset.status || "active").toUpperCase()}"`,
        `"${(asset.profile_link || "").replace(/"/g, '""')}"`,
        g.impressions,
        g.engagements,
        engRate,
        g.likes,
        g.shares_reposts,
        g.comments,
        g.followers_gained,
        g.followers_lost,
        netFol,
        g.total_followers,
        g.posts_published,
        postsPerDay,
        g.top_post_impressions,
        g.weeks_count
      ].join(","));
    });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${filePrefix}_${horizon.toUpperCase()}_${periodFilter || "ALL"}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
