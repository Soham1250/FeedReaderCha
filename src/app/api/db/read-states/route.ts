import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const readStates = await db
      .collection("readStates")
      .find({ userId: new ObjectId(session.user.id) })
      .toArray();

    // Map to list of string item IDs
    const itemIds = readStates.map((rs) => rs.itemId.toString());
    return NextResponse.json(itemIds);
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
    const { itemId, isRead } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);
    const itemObjId = new ObjectId(itemId);

    const collection = db.collection("readStates");

    if (isRead === false) {
      // Mark as unread (remove document)
      await collection.deleteOne({ userId, itemId: itemObjId });
      return NextResponse.json({ isRead: false });
    } else {
      // Mark as read (insert document)
      await collection.updateOne(
        { userId, itemId: itemObjId },
        { $set: { userId, itemId: itemObjId, createdAt: new Date() } },
        { upsert: true }
      );
      return NextResponse.json({ isRead: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
