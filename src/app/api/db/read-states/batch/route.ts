import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { itemIds, isRead } = await request.json();
    
    if (!Array.isArray(itemIds)) {
      return NextResponse.json({ error: "itemIds must be an array" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);
    const collection = db.collection("readStates");

    const objectIds = itemIds.map(id => new ObjectId(id));

    if (isRead === false) {
      // Mark as unread (remove documents)
      await collection.deleteMany({
        userId,
        itemId: { $in: objectIds }
      });
      return NextResponse.json({ success: true, isRead: false, count: itemIds.length });
    } else {
      // Mark as read (insert documents)
      // We use bulkWrite for efficient upserts
      const bulkOps = objectIds.map(itemId => ({
        updateOne: {
          filter: { userId, itemId },
          update: { $set: { userId, itemId, createdAt: new Date() } },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
      return NextResponse.json({ success: true, isRead: true, count: itemIds.length });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
