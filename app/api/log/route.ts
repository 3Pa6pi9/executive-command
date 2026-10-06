import { NextResponse } from "next/server";
import { managerSupabase as supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { url, handler_name } = await request.json();
    
    if (!url || !handler_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // --- FACEBOOK API TIME-CHECK GATEKEEPER ---
    const fbAppId = process.env.FB_APP_ID;
    const fbSecret = process.env.FB_APP_SECRET;

    if (fbAppId && fbSecret) {
      try {
        const appToken = `${fbAppId}|${fbSecret}`;
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/?id=${encodeURIComponent(url)}&access_token=${appToken}`);
        const fbData = await fbRes.json();

        // If Facebook returns a valid timestamp, verify the age
        if (fbData.created_time || fbData.updated_time) {
          const postDate = new Date(fbData.created_time || fbData.updated_time);
          const now = new Date();
          const hoursOld = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursOld > 48) {
            return NextResponse.json({ 
              error: `Rejected: Post is ${Math.round(hoursOld)} hours old. (Max: 48 hours)` 
            }, { status: 400 });
          }
        }
      } catch (fbError) {
        // Silently continue if FB API blocks the read (e.g., due to Facebook's App Review limits)
        console.warn("Graph API Check Skipped:", fbError);
      }
    }

    // --- DATABASE INSERTION ---
    const { data, error } = await supabase
      .from("campaign_links")
      .insert([{ url, handler_name }]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
