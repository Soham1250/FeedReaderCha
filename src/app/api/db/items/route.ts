import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdStr = session?.user?.id;
  if (!userIdStr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(userIdStr);

    // 1. Get all feeds subscribed by the user
    const feeds = await db
      .collection("feeds")
      .find({ userId })
      .toArray();

    if (feeds.length === 0) {
      return NextResponse.json([]);
    }

    const feedMap = new Map();
    const feedIds = feeds.map((f) => {
      feedMap.set(f._id.toString(), {
        feedUrl: f.url,
        feedTitle: f.title,
      });
      return f._id;
    });

    // 2. Fetch latest items for those feeds (limit to 200 items for responsiveness)
    const items = await db
      .collection("items")
      .find({ feedId: { $in: feedIds } })
      .sort({ publishedAt: -1 })
      .limit(200)
      .toArray();

    // 3. Map items to include feedUrl and feedTitle
    const enrichedItems = items.map((item) => {
      const feedInfo = feedMap.get(item.feedId.toString()) || {};
      return {
        guid: item._id.toString(), // Use MongoDB ObjectId string as guid for DB syncing
        title: item.title || "Untitled Article",
        link: item.link || "",
        description: item.description || "",
        content: item.content || "",
        author: item.author || "",
        publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
        feedUrl: feedInfo.feedUrl || "",
        feedTitle: feedInfo.feedTitle || "Unknown Feed",
      };
    });

    return NextResponse.json(enrichedItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
