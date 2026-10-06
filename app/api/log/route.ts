import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, handler_name } = body;

    if (!url || !handler_name) {
      return NextResponse.json({ error: "Name and URL are required." }, { status: 400 });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
    }

    // Check if it's Facebook to strip tracking parameters, but DO NOT reject if it isn't
    const validHosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "fb.watch"];
    if (validHosts.includes(parsedUrl.hostname)) {
      parsedUrl.searchParams.delete("mibextid");
      parsedUrl.searchParams.delete("ref");
      parsedUrl.searchParams.delete("rdid");
    }
    
    const cleanUrl = parsedUrl.toString();

    // Prevent duplicates so managers can't spam the exact same bad link
    const { data: existing } = await supabase
      .from("campaign_links")
      .select("id")
      .eq("url", cleanUrl)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Rejected: This exact link has already been logged." }, { status: 409 });
    }

    // Log the URL regardless of whether it is valid or not
    const { error } = await supabase
      .from("campaign_links")
      .insert([{ url: cleanUrl, handler_name }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}