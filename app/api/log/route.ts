import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    let { url, handler_name, reach, views, likes, comments, shares, groups_joined, followers, platform, post_count, total_engagement } = await request.json();
    const authHeader = request.headers.get("Authorization");
    
    if (!url || !handler_name) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    if (!authHeader) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const secureSupabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const cleanUrl = url.trim();
    const targetPlatform = platform || "facebook";

    const { data, error } = await secureSupabase.from("campaign_links").insert([{ 
      url: cleanUrl, handler_name, platform: targetPlatform,
      reach: parseInt(reach) || 0, views: parseInt(views) || 0, likes: parseInt(likes) || 0,
      comments: parseInt(comments) || 0, shares: parseInt(shares) || 0, groups_joined: parseInt(groups_joined) || 0,
      followers: parseInt(followers) || 0, post_count: parseInt(post_count) || 0, total_engagement: parseInt(total_engagement) || 0
    }]);

    if (error) return NextResponse.json({ error: "Database error." }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
