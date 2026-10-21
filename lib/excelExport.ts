import * as XLSX from "xlsx";

const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

const HEADERS = [
  "Horizon", "Week / Period", "Team Leader", "SMM Handler", "Platform",
  "Account Name", "Username / ID", "Status", "Country", "Language",
  "Total Views", "Engagements", "Engagement Rate %", "Total Likes",
  "Shares / Reposts", "Comments", "Followers Gained", "Followers Lost",
  "Net Followers", "Total Followers", "Follower Growth %", "Total Posts",
  "Post Rate (Posts/Day)", "Top Post Views", "Profile Link"
];

function getBucket(dt: string, h: string): string {
  if (!dt || h === "weekly") return (dt || "Unknown").trim();
  const y = dt.slice(0, 4), m = parseInt(dt.slice(5, 7) || "1", 10);
  return h === "monthly" ? `${y}-${String(m).padStart(2, "0")}` : h === "quarterly" ? `${y}-Q${Math.ceil(m / 3)}` : y;
}

function aggregateLocal(metrics: any[], horizon: string) {
  const map = new Map<string, any>();
  for (const m of metrics || []) {
    if (!m) continue;
    const period = getBucket(m.week_of, horizon);
    const key = `${m.asset_id}__${period}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key, asset_id: m.asset_id, period, horizon,
        impressions: 0, engagements: 0, likes: 0, shares_reposts: 0, comments: 0,
        followers_gained: 0, followers_lost: 0, total_followers: 0,
        posts_published: 0, top_post_impressions: 0, weeks_counted: 0
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
  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}

function toRow(r: any, h: string, assets: any[], profiles: any[]) {
  const a = (assets || []).find((x: any) => x.id === r.asset_id) || {};
  const smm = (profiles || []).find((p: any) => p.id === a.smm_id) || {};
  const tl = (profiles || []).find((p: any) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
  const eng = r.impressions > 0 ? ((r.engagements / r.impressions) * 100).toFixed(2) : "0.00";
  const net = r.followers_gained - r.followers_lost;
  const grw = r.total_followers > 0 ? ((net / Math.max(1, r.total_followers - net)) * 100).toFixed(2) : "0.00";
  const days = Math.max(7, r.weeks_counted * 7);
  return {
    "Horizon": (h || "weekly").toUpperCase(),
    "Week / Period": r.period,
    "Team Leader": tl.full_name || "Unassigned",
    "SMM Handler": smm.full_name || "Unassigned",
    "Platform": (a.platform || "").toUpperCase(),
    "Account Name": a.bio || a.account_id || "",
    "Username / ID": a.account_id || "",
    "Status": a.status === "locked" || smm.is_locked ? "LOCKED" : (a.status || "active").toUpperCase(),
    "Country": a.country_language || "",
    "Language": a.language || "English",
    "Total Views": r.impressions,
    "Engagements": r.engagements,
    "Engagement Rate %": `${eng}%`,
    "Total Likes": r.likes,
    "Shares / Reposts": r.shares_reposts,
    "Comments": r.comments,
    "Followers Gained": r.followers_gained,
    "Followers Lost": r.followers_lost,
    "Net Followers": net,
    "Total Followers": r.total_followers,
    "Follower Growth %": `${grw}%`,
    "Total Posts": r.posts_published,
    "Post Rate (Posts/Day)": Number((r.posts_published / days).toFixed(2)),
    "Top Post Views": r.top_post_impressions,
    "Profile Link": a.profile_link || ""
  };
}

export function downloadMultiTabWorkbook({ horizon = "weekly", metrics = [], assets = [], profiles = [], scopeLabel = "Performance_Report" }: any) {
  const agg = aggregateLocal(metrics, horizon).filter((r: any) => (assets || []).some((x: any) => x.id === r.asset_id));
  const wb = XLSX.utils.book_new();
  const sh = (rows: any[]) => (rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([HEADERS]));

  XLSX.utils.book_append_sheet(wb, sh(agg.map((r: any) => toRow(r, horizon, assets, profiles))), "ALL PLATFORMS");
  for (const p of PLATFORMS) {
    const pr = agg
      .filter((r: any) => ((assets || []).find((x: any) => x.id === r.asset_id)?.platform || "").toLowerCase() === p)
      .map((r: any) => toRow(r, horizon, assets, profiles));
    XLSX.utils.book_append_sheet(wb, sh(pr), p.toUpperCase());
  }
  const dt = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `${scopeLabel}_${horizon.toUpperCase()}_${dt}.xlsx`);
}
