import Parser from "rss-parser";
import he from "he";

const parser = new Parser({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["content", "contentRaw"],
      ["summary", "summaryRaw"],
    ],
  },
});

export interface NormalizedFeedItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  content: string;
  author: string;
  publishedAt: Date;
}

export interface NormalizedFeed {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  items: NormalizedFeedItem[];
}

// Pass-through function: HTML is sanitized on the client side before rendering
export function sanitizeHtml(html: string): string {
  return html || "";
}

// Decodes HTML entities and trims whitespace
export function normalizeText(text: string): string {
  if (!text) return "";
  try {
    return he.decode(text).trim();
  } catch {
    return text.trim();
  }
}

// Extracts text excerpt from HTML
export function extractExcerpt(html: string, maxLen: number = 200): string {
  if (!html) return "";
  // Strip HTML tags
  const cleanText = html.replace(/<[^>]*>/g, " ");
  const decoded = normalizeText(cleanText);
  // Normalize whitespace
  const singleSpaced = decoded.replace(/\s+/g, " ");
  if (singleSpaced.length <= maxLen) return singleSpaced;
  return singleSpaced.slice(0, maxLen).trim() + "...";
}

// Parses inconsistent dates resiliently
export function parseFeedDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }
  
  // Fallback for custom layouts/edge-case date formats
  try {
    // Try cleaning up common timezones or extra strings
    const cleaned = dateStr.replace(/UTC|GMT/g, "").trim();
    const fallbackParsed = Date.parse(cleaned);
    if (!isNaN(fallbackParsed)) {
      return new Date(fallbackParsed);
    }
  } catch {}
  
  return new Date(); // Fallback to current time if unparseable
}

export async function parseFeed(feedUrl: string): Promise<NormalizedFeed> {
  // Add a strict 10s timeout wrapper to the fetch call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FrontpageFeedReader/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    const feed = await parser.parseString(xmlText);

    const items: NormalizedFeedItem[] = (feed.items || []).map((item) => {
      const title = normalizeText(item.title || "Untitled Article");
      const link = item.link || "";
      const guid = item.guid || (item as any).id || link || Math.random().toString(36).slice(2);
      const author = item.creator || (item as any).author || (item as any).author?.name || "";

      // Determine raw content and summary
      const rawContent = item.contentEncoded || item.contentRaw || item.content || "";
      const rawSummary = item.summaryRaw || item.summary || item.contentSnippet || (item as any).description || "";

      // Sanitize both content and description
      const sanitizedContent = sanitizeHtml(rawContent);
      const sanitizedDescription = sanitizeHtml(rawSummary);

      // Generate text description excerpt if description is missing/empty
      const finalDescription = sanitizedDescription 
        ? extractExcerpt(sanitizedDescription, 200) 
        : extractExcerpt(sanitizedContent, 200);

      const publishedAt = parseFeedDate(item.pubDate || item.isoDate);

      return {
        guid,
        title,
        link,
        description: finalDescription,
        content: sanitizedContent || sanitizedDescription || "", // Fallback
        author: typeof author === "string" ? normalizeText(author) : "",
        publishedAt,
      };
    });

    return {
      title: normalizeText(feed.title || "Untitled Feed"),
      description: normalizeText(feed.description || ""),
      link: feed.link || "",
      feedUrl,
      items,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
