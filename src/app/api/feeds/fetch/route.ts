import { NextRequest, NextResponse } from "next/server";
import { parseFeed } from "@/lib/parser";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Feed URL query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const feed = await parseFeed(url);
    return NextResponse.json(feed);
  } catch (error: any) {
    console.error(`Failed to fetch feed at ${url}:`, error);
    return NextResponse.json(
      {
        error: `Failed to fetch or parse feed: ${error.message || error}`,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Feed URL in body is required." },
        { status: 400 }
      );
    }

    const feed = await parseFeed(url);
    return NextResponse.json(feed);
  } catch (error: any) {
    console.error(`Failed to post-fetch feed:`, error);
    return NextResponse.json(
      {
        error: `Failed to fetch or parse feed: ${error.message || error}`,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
