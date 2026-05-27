import { NextRequest, NextResponse } from "next/server";

interface ParsedOutline {
  title: string;
  xmlUrl: string;
  category: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const xmlText = await file.text();
    
    // Parse attributes helper
    const getAttribute = (tag: string, attrName: string): string => {
      const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
      const match = tag.match(regex);
      return match ? match[1] : "";
    };

    // State machine variables
    const categoryStack: string[] = [];
    const feeds: ParsedOutline[] = [];
    const feedUrlsSeen = new Set<string>();
    let duplicateCount = 0;

    // Scan for tags linearly using a global regex
    const tagRegex = /<outline\s+([^>]+?)\s*\/?>|<\/outline>/gi;
    let match;

    while ((match = tagRegex.exec(xmlText)) !== null) {
      const fullTag = match[0];
      const attributes = match[1];

      if (fullTag.startsWith("</")) {
        // Closing tag
        categoryStack.pop();
      } else {
        // Outline opening / self-closing tag
        const xmlUrl = getAttribute(attributes, "xmlUrl") || getAttribute(attributes, "xmlurl");
        const title = getAttribute(attributes, "title") || getAttribute(attributes, "text") || "Untitled Feed";

        if (xmlUrl) {
          // Feed item
          const currentCategory = categoryStack.length > 0 ? categoryStack.join(" > ") : "Uncategorized";
          
          if (feedUrlsSeen.has(xmlUrl)) {
            duplicateCount++;
          } else {
            feedUrlsSeen.add(xmlUrl);
            feeds.push({
              title,
              xmlUrl,
              category: currentCategory,
            });
          }
        } else {
          // Category outline container
          categoryStack.push(title);
        }
      }
    }

    return NextResponse.json({
      feeds,
      duplicateCount,
      totalImported: feeds.length,
    });
  } catch (error: any) {
    console.error("Failed to parse OPML:", error);
    return NextResponse.json(
      { error: `OPML Parsing failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
