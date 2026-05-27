import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userIdStr = session?.user?.id;
  if (!userIdStr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const bookmarks = await db
      .collection("bookmarks")
      .find({ userId: new ObjectId(userIdStr) })
      .toArray();

    // Map to list of string item IDs
    const itemIds = bookmarks.map((b) => b.itemId.toString());
    return NextResponse.json(itemIds);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdStr = session?.user?.id;
  if (!userIdStr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(userIdStr);
    const itemObjId = new ObjectId(itemId);

    // Toggle bookmark
    const collection = db.collection("bookmarks");
    const existing = await collection.findOne({ userId, itemId: itemObjId });

    if (existing) {
      await collection.deleteOne({ _id: existing._id });
      return NextResponse.json({ bookmarked: false });
    } else {
      await collection.insertOne({
        userId,
        itemId: itemObjId,
        createdAt: new Date(),
      });
      return NextResponse.json({ bookmarked: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

