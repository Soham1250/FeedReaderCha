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
    const categories = await db
      .collection("categories")
      .find({ userId: new ObjectId(session.user.id) })
      .sort({ orderIndex: 1 })
      .toArray();

    return NextResponse.json(categories);
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
    const { name, orderIndex } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    const result = await db.collection("categories").insertOne({
      userId,
      name,
      orderIndex: orderIndex || 0,
      createdAt: new Date(),
    });

    return NextResponse.json({ _id: result.insertedId, name, orderIndex });
  } catch (error: any) {
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
    const categoryName = searchParams.get("name");

    if (!categoryName) {
      return NextResponse.json({ error: "Category name parameter is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userId = new ObjectId(session.user.id);

    // Delete category
    await db.collection("categories").deleteOne({
      userId,
      name: categoryName,
    });

    // Reset feeds under this category to "Uncategorized"
    await db.collection("feeds").updateMany(
      { userId, category: categoryName },
      { $set: { category: "Uncategorized" } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
