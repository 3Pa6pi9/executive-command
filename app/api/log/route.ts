import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { url, handler_name, reach, views, likes, comments, shares, groups_joined, followers, platform } = await request.json();
    const authHeader = request.headers.get("Authorization");
    
    if (!url || !handler_name) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    if (!authHeader) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const secureSupabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: settings } = await secureSupabase.from("system_settings").select("max_post_age_hours").eq("id", 1).single();
    const maxAgeHours = settings?.max_post_age_hours || 24;

    const fbAppId = process.env.FB_APP_ID;
    const fbSecret = process.env.FB_APP_SECRET;
    const appToken = fbAppId && fbSecret ? `${fbAppId}|${fbSecret}` : null;
    const cleanUrl = url.trim();
    const targetPlatform = platform || "facebook";

    const { data: existing } = await secureSupabase.from("campaign_links").select("handler_name").eq("url", cleanUrl).single();
    if (existing) return NextResponse.json({ error: `Duplicate: Logged by ${existing.handler_name}` }, { status: 400 });

    // Only run strict Meta Graph API age checks if it's a Facebook post
    if (targetPlatform === "facebook" && appToken) {
      try {
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/?id=${encodeURIComponent(cleanUrl)}&access_token=${appToken}`);
        const fbData = await fbRes.json();
        if (fbData.created_time || fbData.updated_time) {
          const hoursOld = (new Date().getTime() - new Date(fbData.created_time || fbData.updated_time).getTime()) / 3600000;
          if (hoursOld > maxAgeHours) return NextResponse.json({ error: `Rejected: Post is ${Math.round(hoursOld)}h old (Max ${maxAgeHours}h)` }, { status: 400 });
        }
      } catch (e) { console.warn("FB API Check Skipped"); }
    }

    const { data, error } = await secureSupabase.from("campaign_links").insert([{ 
      url: cleanUrl, handler_name, platform: targetPlatform,
      reach: parseInt(reach) || 0, views: parseInt(views) || 0, likes: parseInt(likes) || 0,
      comments: parseInt(comments) || 0, shares: parseInt(shares) || 0, groups_joined: parseInt(groups_joined) || 0,
      followers: parseInt(followers) || 0
    }]);

    if (error) return NextResponse.json({ error: error.code === '23505' ? "Duplicate link detected." : "Database error." }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
