import { NextRequest, NextResponse } from "next/server";
import { parseFeed } from "@/lib/parser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: "An array of feed URLs is required." },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const feed = await parseFeed(url);
          return { url, success: true, feed };
        } catch (error: any) {
          console.error(`Batch fetch failed for ${url}:`, error);
          return { url, success: false, error: error.message || error };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Batch parse failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
