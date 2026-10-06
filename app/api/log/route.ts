import { NextResponse } from "next/server";
import { managerSupabase as supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { url, handler_name } = await request.json();
    
    if (!url || !handler_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("campaign_links")
      .insert([{ url, handler_name }]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
