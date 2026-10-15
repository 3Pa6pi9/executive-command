import * as XLSX from "xlsx";
import { PLATFORMS, aggregateMetricsByHorizon } from "./constants";

const EMPTY_HEADERS = [
  "Horizon","Week / Period","Team Leader","SMM Handler","Platform",
  "Account Name","Status","Country","Language","Campaign",
  "Impressions","Engagements","Engagement Rate %","Likes","Shares / Reposts",
  "Comments","Followers Gained","Followers Lost","Net Followers",
  "Total Followers","Follower Growth %","Posts Published","Posts / Day",
  "Top Post Impr.","Profile Link"
];

function buildRow(r: any, horizon: string, assets: any[], profiles: any[]) {
  const a = assets.find((x: any) => x.id === r.asset_id) || {};
  const smm = profiles.find((p: any) => p.id === a.smm_id) || {};
  const tl = profiles.find((p: any) => p.id === (a.team_leader_id || smm.team_leader_id)) || {};
  const eng = r.impressions > 0 ? ((r.engagements / r.impressions) * 100).toFixed(2) : "0.00";
  const net = r.followers_gained - r.followers_lost;
  const base = Math.max(1, r.total_followers - net);
  const grw = r.total_followers > 0 ? ((net / base) * 100).toFixed(2) : "0.00";
  const days = Math.max(7, r.weeks_counted * 7);
  return {
    "Horizon": horizon.toUpperCase(), "Week / Period": r.period,
    "Team Leader": tl.full_name || "Unassigned", "SMM Handler": smm.full_name || "Unassigned",
    "Platform": (a.platform || "").toUpperCase(), "Account Name": a.account_id || "",
    "Status": (a.status || "active").toUpperCase(), "Country": a.country_language || "",
    "Language": a.language || "English", "Campaign": a.tl_campaign || a.project_name || "General",
    "Impressions": r.impressions, "Engagements": r.engagements, "Engagement Rate %": `${eng}%`,
    "Likes": r.likes, "Shares / Reposts": r.shares_reposts, "Comments": r.comments,
    "Followers Gained": r.followers_gained, "Followers Lost": r.followers_lost,
    "Net Followers": net, "Total Followers": r.total_followers, "Follower Growth %": `${grw}%`,
    "Posts Published": r.posts_published, "Posts / Day": Number((r.posts_published / days).toFixed(2)),
    "Top Post Impr.": r.top_post_impressions, "Profile Link": a.profile_link || ""
  };
}

export function downloadMultiTabWorkbook({ horizon, metrics, assets, profiles, projectFilter = "All", scopeLabel = "Executive_Command" }: any) {
  const agg = aggregateMetricsByHorizon(metrics, horizon).filter((r: any) => {
    const a = assets.find((x: any) => x.id === r.asset_id);
    return a && (projectFilter === "All" || a.project_name === projectFilter);
  });

  const wb = XLSX.utils.book_new();
  const toSheet = (rows: any[]) => rows.length
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([EMPTY_HEADERS]);

  const allRows = agg.map((r: any) => buildRow(r, horizon, assets, profiles));
  XLSX.utils.book_append_sheet(wb, toSheet(allRows), "ALL PLATFORMS");

  for (const plat of PLATFORMS) {
    const platRows = agg
      .filter((r: any) => {
        const a = assets.find((x: any) => x.id === r.asset_id);
        return (a?.platform || "").toLowerCase() === plat;
      })
      .map((r: any) => buildRow(r, horizon, assets, profiles));
    XLSX.utils.book_append_sheet(wb, toSheet(platRows), plat.toUpperCase());
  }

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `${scopeLabel}_${horizon.toUpperCase()}_${dateStr}.xlsx`);
}
