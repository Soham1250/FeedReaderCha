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

    // 1. Check if user already has feeds
    const existingFeedsCount = await db
      .collection("feeds")
      .countDocuments({ userId });

    if (existingFeedsCount > 0) {
      return NextResponse.json({ success: true, message: "Feeds already seeded" });
    }

    // 2. Default feeds and categories configuration (aligned with sample-feeds.json)
    const seedConfig = [
      {
        category: "Frontend",
        feeds: [
          "https://www.smashingmagazine.com/feed/",
          "https://css-tricks.com/feed/",
          "https://web.dev/feed.xml"
        ]
      },
      {
        category: "Design",
        feeds: [
          "https://sidebar.io/feed.xml",
          "https://uxdesign.cc/feed"
        ]
      }
    ];

    const feedsCollection = db.collection("feeds");
    const categoriesCollection = db.collection("categories");
    const itemsCollection = db.collection("items");

    // 3. Seed categories and feeds
    for (let index = 0; index < seedConfig.length; index++) {
      const group = seedConfig[index];
      
      // Create category
      await categoriesCollection.updateOne(
        { userId, name: group.category },
        { 
          $set: { 
            userId, 
            name: group.category, 
            orderIndex: index,
            createdAt: new Date()
          } 
        },
        { upsert: true }
      );

      // Create and parse feeds
      for (const feedUrl of group.feeds) {
        try {
          const parsed = await parseFeed(feedUrl);
          
          // Save feed
          const feedDoc = {
            userId,
            url: feedUrl,
            title: parsed.title || "Untitled Feed",
            description: parsed.description || "",
            siteUrl: parsed.link || "",
            category: group.category,
            status: "active",
            lastFetched: new Date(),
            createdAt: new Date(),
          };

          const updateResult = await feedsCollection.updateOne(
            { userId, url: feedUrl },
            { $set: feedDoc },
            { upsert: true }
          );

          const dbFeed = await feedsCollection.findOne({ userId, url: feedUrl });
          if (dbFeed) {
            // Save initial items
            const bulkOps = parsed.items.slice(0, 10).map((item) => ({
              updateOne: {
                filter: { feedId: dbFeed._id, guid: item.guid },
                update: {
                  $set: {
                    feedId: dbFeed._id,
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
          }
        } catch (err) {
          console.error(`Failed to seed feed ${feedUrl}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Successfully seeded initial feeds and categories!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
