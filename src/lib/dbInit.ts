import clientPromise from "./mongodb";

export async function dbInit() {
  try {
    const client = await clientPromise;
    const db = client.db();

    console.log("Database connection established. Setting up indexes...");

    // 1. Categories
    const categories = db.collection("categories");
    await categories.createIndex({ userId: 1 });
    await categories.createIndex({ userId: 1, name: 1 }, { unique: true });

    // 2. Feeds
    const feeds = db.collection("feeds");
    await feeds.createIndex({ userId: 1 });
    await feeds.createIndex({ userId: 1, url: 1 }, { unique: true });

    // 3. Items
    const items = db.collection("items");
    await items.createIndex({ feedId: 1 });
    await items.createIndex({ feedId: 1, guid: 1 }, { unique: true, sparse: true });
    await items.createIndex({ feedId: 1, link: 1 }, { unique: true });
    await items.createIndex({ publishedAt: -1 });
    
    // Create text index for search
    await items.createIndex(
      { title: "text", description: "text", content: "text" },
      { weights: { title: 10, description: 5, content: 1 }, name: "item_search_index" }
    );

    // 4. Bookmarks
    const bookmarks = db.collection("bookmarks");
    await bookmarks.createIndex({ userId: 1, itemId: 1 }, { unique: true });

    // 5. Read States
    const readStates = db.collection("readStates");
    await readStates.createIndex({ userId: 1, itemId: 1 }, { unique: true });

    console.log("MongoDB indexes successfully created!");
    return { success: true };
  } catch (error) {
    console.error("Failed to initialize database indexes:", error);
    return { success: false, error };
  }
}
