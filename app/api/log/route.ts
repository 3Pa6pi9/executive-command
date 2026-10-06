import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { urls, handler_name } = await request.json();
    const authHeader = request.headers.get("Authorization");
    
    if (!urls || !Array.isArray(urls) || !handler_name) {
      return NextResponse.json({ error: "Missing required fields or invalid format." }, { status: 400 });
    }
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing session token." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const secureSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Fetch the dynamic max post age setting from the database
    const { data: settings } = await secureSupabase.from("system_settings").select("max_post_age_hours").eq("id", 1).single();
    const maxAgeHours = settings?.max_post_age_hours || 24;

    const fbAppId = process.env.FB_APP_ID;
    const fbSecret = process.env.FB_APP_SECRET;
    const appToken = fbAppId && fbSecret ? `${fbAppId}|${fbSecret}` : null;

    let results = [];

    for (let rawUrl of urls) {
      const url = rawUrl.trim();
      if (!url) continue;

      try {
        // 1. Anti-Cheat: Check for existing URL globally
        const { data: existing } = await secureSupabase.from("campaign_links").select("handler_name").eq("url", url).single();
        if (existing) {
          results.push({ url, status: "error", msg: `Duplicate: Already logged by ${existing.handler_name}` });
          continue;
        }

        // 2. Facebook Graph API Gatekeeper
        if (appToken) {
          try {
            const fbRes = await fetch(`https://graph.facebook.com/v19.0/?id=${encodeURIComponent(url)}&access_token=${appToken}`);
            const fbData = await fbRes.json();
            if (fbData.created_time || fbData.updated_time) {
              const postDate = new Date(fbData.created_time || fbData.updated_time);
              const hoursOld = (new Date().getTime() - postDate.getTime()) / (1000 * 60 * 60);
              
              // Dynamic Age Validation
              if (hoursOld > maxAgeHours) {
                results.push({ url, status: "error", msg: `Rejected: Post is ${Math.round(hoursOld)}h old (Max ${maxAgeHours}h)` });
                continue;
              }
            }
          } catch (fbError) {
             console.warn("FB API Check Skipped for:", url);
          }
        }

        // 3. Database Insertion
        const { error } = await secureSupabase.from("campaign_links").insert([{ url, handler_name }]);
        if (error) {
           if (error.code === '23505') results.push({ url, status: "error", msg: "Duplicate link detected." });
           else results.push({ url, status: "error", msg: "Database error." });
        } else {
           results.push({ url, status: "success", msg: "Logged successfully." });
        }

      } catch (err: any) {
        results.push({ url, status: "error", msg: "Processing error." });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
