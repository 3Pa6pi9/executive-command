import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    let { url, handler_name, reach, views, likes, comments, shares, groups_joined, followers, platform } = await request.json();
    const authHeader = request.headers.get("Authorization");
    
    if (!url || !handler_name) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    if (!authHeader) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const secureSupabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    // Get max age limit from settings
    const { data: settings } = await secureSupabase.from("system_settings").select("max_post_age_hours").eq("id", 1).single();
    const maxAgeHours = settings?.max_post_age_hours || 24;

    const cleanUrl = url.trim();
    const targetPlatform = platform || "facebook";

    // 1. Anti-Cheat: Duplicate Check
    const { data: existing } = await secureSupabase.from("campaign_links").select("handler_name").eq("url", cleanUrl).single();
    if (existing) return NextResponse.json({ error: `Duplicate: Logged by ${existing.handler_name}` }, { status: 400 });

    // Parse initial manual numbers
    let finalReach = parseInt(reach) || 0;
    let finalViews = parseInt(views) || 0;
    let finalLikes = parseInt(likes) || 0;
    let finalComments = parseInt(comments) || 0;
    let finalShares = parseInt(shares) || 0;
    let finalGroups = parseInt(groups_joined) || 0;
    let finalFollowers = parseInt(followers) || 0;

    // 2. FACEBOOK API LOGIC (Age Verification only)
    if (targetPlatform === "facebook" && process.env.FB_APP_ID && process.env.FB_APP_SECRET) {
      try {
        const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/?id=${encodeURIComponent(cleanUrl)}&access_token=${appToken}`);
        const fbData = await fbRes.json();
        if (fbData.created_time || fbData.updated_time) {
          const hoursOld = (new Date().getTime() - new Date(fbData.created_time || fbData.updated_time).getTime()) / 3600000;
          if (hoursOld > maxAgeHours) return NextResponse.json({ error: `Rejected: Post is ${Math.round(hoursOld)}h old (Max ${maxAgeHours}h)` }, { status: 400 });
        }
      } catch (e) { console.warn("FB API Check Skipped"); }
    }

    // 3. TWITTER / X API LOGIC (The Magic Override Engine)
    if (targetPlatform === "twitter") {
      // Extract the exact Tweet ID from the URL (works for both x.com and twitter.com)
      const tweetIdMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
      if (!tweetIdMatch) return NextResponse.json({ error: "Invalid Twitter/X URL. You must submit a direct link to a post." }, { status: 400 });
      
      const tweetId = tweetIdMatch[1];
      const twitterToken = process.env.TWITTER_BEARER_TOKEN;
      
      if (twitterToken) {
        try {
          // Fetch real data from X
          const twRes = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=created_at,public_metrics`, {
            headers: { "Authorization": `Bearer ${twitterToken}` }
          });
          const twData = await twRes.json();
          
          if (twData.data) {
            // A. Check True Age
            if (twData.data.created_at) {
              const hoursOld = (new Date().getTime() - new Date(twData.data.created_at).getTime()) / 3600000;
              if (hoursOld > maxAgeHours) return NextResponse.json({ error: `Rejected: Tweet is ${Math.round(hoursOld)}h old (Max ${maxAgeHours}h)` }, { status: 400 });
            }
            
            // B. Auto-Override Numbers with absolute truth
            const metrics = twData.data.public_metrics;
            if (metrics) {
              finalReach = metrics.impression_count || finalReach;
              finalViews = metrics.impression_count || finalViews; // Twitter treats impressions as views
              finalLikes = metrics.like_count || finalLikes;
              finalComments = metrics.reply_count || finalComments;
              finalShares = (metrics.retweet_count + (metrics.quote_count || 0)) || finalShares;
              // Note: Followers cannot be pulled from this specific tweet endpoint, so we keep handler's manual input
            }
          } else if (twData.errors) {
             return NextResponse.json({ error: "Twitter API error: Tweet not found or account is private." }, { status: 400 });
          }
        } catch (e) { console.warn("Twitter API Check Skipped", e); }
      }
    }

    // 4. Save to Database
    const { data, error } = await secureSupabase.from("campaign_links").insert([{ 
      url: cleanUrl, handler_name, platform: targetPlatform,
      reach: finalReach, views: finalViews, likes: finalLikes,
      comments: finalComments, shares: finalShares, groups_joined: finalGroups,
      followers: finalFollowers
    }]);

    if (error) return NextResponse.json({ error: error.code === '23505' ? "Duplicate link detected." : "Database error." }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
