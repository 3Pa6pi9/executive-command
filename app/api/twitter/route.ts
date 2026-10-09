import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

    const tweetIdMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) return NextResponse.json({ error: "Invalid Twitter URL" }, { status: 400 });
    
    const tweetId = tweetIdMatch[1];
    const twitterToken = process.env.TWITTER_BEARER_TOKEN;
    
    if (!twitterToken) return NextResponse.json({ error: "Twitter API not configured on server" }, { status: 500 });

    const twRes = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`, {
      headers: { "Authorization": `Bearer ${twitterToken}` }
    });
    const twData = await twRes.json();
    
    if (twData.data && twData.data.public_metrics) {
      const metrics = twData.data.public_metrics;
      return NextResponse.json({
        reach: metrics.impression_count || 0,
        views: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: (metrics.retweet_count || 0) + (metrics.quote_count || 0)
      });
    } else {
      return NextResponse.json({ error: "Tweet not found or is private." }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
