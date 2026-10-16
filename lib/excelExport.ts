import * as XLSX from "xlsx";
import { PLATFORMS, aggregateMetricsByHorizon } from "./constants";

const HEADERS = [
  "Horizon","Week / Period","Team Leader","SMM Handler","Platform",
  "Account Name","Username / ID","Status","Country","Language",
  "Total Views","Engagements","Engagement Rate %","Total Likes",
  "Shares / Reposts","Comments","Followers Gained","Followers Lost",
  "Net Followers","Total Followers","Follower Growth %","Total Posts",
  "Posts / Day","Top Post Views","Profile Link"
];
function toRow(r: any, h: string, assets: any[], profiles: any[]) {
  const a = assets.find((x: any) => x.id === r.asset_id) || {};
  const smm = profiles.find((p: any) => p.id === a.smm_id) || {};
  const tl = profiles.find((p: any) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
  const net = r.followers_gained - r.followers_lost;
  return {
    "Horizon": h.toUpperCase(), "Week / Period": r.period,
    "Team Leader": tl.full_name || "Unassigned", "SMM Handler": smm.full_name || "Unassigned",
    "Platform": (a.platform || "").toUpperCase(), "Account Name": a.bio || a.account_id || "",
    "Username / ID": a.account_id || "", "Status": (a.status || "active").toUpperCase(),
    "Country": a.country_language || "", "Language": a.language || "English",
    "Total Views": r.impressions, "Engagements": r.engagements, "Total Likes": r.likes,
    "Shares / Reposts": r.shares_reposts, "Comments": r.comments,
    "Followers Gained": r.followers_gained, "Followers Lost": r.followers_lost,
    "Net Followers": net, "Total Followers": r.total_followers, "Total Posts": r.posts_published,
    "Top Post Views": r.top_post_impressions, "Profile Link": a.profile_link || ""
  };
}
export function downloadMultiTabWorkbook({ horizon, metrics, assets, profiles }: any) {
  const agg = aggregateMetricsByHorizon(metrics, horizon).filter((r: any) => assets.some((x: any) => x.id === r.asset_id));
  const wb = XLSX.utils.book_new();
  const sh = (rows: any[]) => rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([HEADERS]);
  XLSX.utils.book_append_sheet(wb, sh(agg.map((r: any) => toRow(r, horizon, assets, profiles))), "ALL PLATFORMS");
  for (const p of PLATFORMS) {
    const pr = agg.filter((r: any) => (assets.find((x: any) => x.id === r.asset_id)?.platform || "").toLowerCase() === p).map((r: any) => toRow(r, horizon, assets, profiles));
    XLSX.utils.book_append_sheet(wb, sh(pr), p.toUpperCase());
  }
  XLSX.writeFile(wb, `Performance_Report_${horizon.toUpperCase()}.xlsx`);
}
