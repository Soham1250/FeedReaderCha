import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { parseFeed } from "@/lib/parser";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const feeds = await db
      .collection("feeds")
      .find({ userId: new ObjectId(session.user.id) })
      .toArray();

    return NextResponse.json(feeds);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, category } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "Feed URL is required" }, { status: 400 });
    }

    // Parse the feed details first to ensure it's valid
    const parsedFeed = await parseFeed(url);
    
    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    // Save Feed Subscription
    const newFeed = {
      userId,
      url,
      title: parsedFeed.title || "Untitled Feed",
      description: parsedFeed.description || "",
      siteUrl: parsedFeed.link || "",
      category: category || "Uncategorized",
      status: "active" as const,
      lastFetched: new Date(),
      createdAt: new Date(),
    };

    const feedResult = await db.collection("feeds").updateOne(
      { userId, url },
      { $set: newFeed },
      { upsers: true, upsert: true } as any
    );

    const dbFeed = await db.collection("feeds").findOne({ userId, url });
    if (!dbFeed) {
      throw new Error("Failed to retrieve saved feed subscription");
    }

    // Insert feed items (articles) into DB
    const itemsCollection = db.collection("items");
    const bulkOps = parsedFeed.items.map((item) => ({
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

    return NextResponse.json({ feed: dbFeed, itemsCount: bulkOps.length });
  } catch (error: any) {
    console.error("Failed to add custom feed to DB:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get("url");

    if (!feedUrl) {
      return NextResponse.json({ error: "Feed URL parameter is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    // Get the feed object to delete its associated items
    const feed = await db.collection("feeds").findOne({ userId, url: feedUrl });
    if (feed) {
      // Clean up feed items
      await db.collection("items").deleteMany({ feedId: feed._id });
      // Delete subscription
      await db.collection("feeds").deleteOne({ _id: feed._id });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, title, category } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "Feed URL is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    const updateDoc: any = {};
    if (title) updateDoc.title = title;
    if (category !== undefined) updateDoc.category = category;

    if (Object.keys(updateDoc).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.collection("feeds").updateOne(
      { userId, url },
      { $set: updateDoc }
    );

    return NextResponse.json({ success: true, updated: updateDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
