import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { parseFeed } from "@/lib/parser";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userIdStr = session?.user?.id;
  if (!userIdStr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(userIdStr);

    // 1. Fetch user's feeds
    const feeds = await db
      .collection("feeds")
      .find({ userId })
      .toArray();

    if (feeds.length === 0) {
      return NextResponse.json({ success: true, message: "No feeds to refresh" });
    }

    const itemsCollection = db.collection("items");
    const results = [];

    // 2. Fetch and parse all feeds in parallel
    const promises = feeds.map(async (feed) => {
      try {
        const parsed = await parseFeed(feed.url);
        
        // Update feed status
        await db.collection("feeds").updateOne(
          { _id: feed._id },
          { 
            $set: { 
              status: "active", 
              lastFetched: new Date(),
              title: parsed.title || feed.title,
              description: parsed.description || feed.description,
            } 
          }
        );

        // Bulk insert items
        const bulkOps = parsed.items.map((item) => ({
          updateOne: {
            filter: { feedId: feed._id, guid: item.guid },
            update: {
              $set: {
                feedId: feed._id,
                guid: item.guid,
                title: item.title,
                link: item.link,
                description: item.description,
                content: item.content,
                author: item.author,
                publishedAt: item.publishedAt,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        }));

        if (bulkOps.length > 0) {
          await itemsCollection.bulkWrite(bulkOps, { ordered: false });
        }

        return { url: feed.url, success: true, itemsCount: bulkOps.length };
      } catch (err: any) {
        // Mark feed status as error
        await db.collection("feeds").updateOne(
          { _id: feed._id },
          { $set: { status: "error", errorDetail: err.message } }
        );
        return { url: feed.url, success: false, error: err.message };
      }
    });

    const refreshResults = await Promise.all(promises);

    return NextResponse.json({
      success: true,
      results: refreshResults,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
