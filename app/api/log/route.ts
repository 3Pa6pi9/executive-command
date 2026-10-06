import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { url, handler_name } = await request.json();
    const authHeader = request.headers.get("Authorization");
    
    if (!url || !handler_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing session token." }, { status: 401 });
    }

    // Create a secure Supabase client that uses the Manager's specific auth token to pass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const secureSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // --- FACEBOOK API TIME-CHECK GATEKEEPER ---
    const fbAppId = process.env.FB_APP_ID;
    const fbSecret = process.env.FB_APP_SECRET;

    if (fbAppId && fbSecret) {
      try {
        const appToken = `${fbAppId}|${fbSecret}`;
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/?id=${encodeURIComponent(url)}&access_token=${appToken}`);
        const fbData = await fbRes.json();

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
        console.warn("Graph API Check Skipped:", fbError);
      }
    }

    // --- DATABASE INSERTION (Now authorized!) ---
    const { data, error } = await secureSupabase
      .from("campaign_links")
      .insert([{ url, handler_name }]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
