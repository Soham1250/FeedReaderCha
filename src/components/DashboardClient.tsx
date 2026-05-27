"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  AlignJustify,
  Grid,
  Heart,
  HelpCircle,
  Import,
  Layers,
  Layout,
  List,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Feed {
  title: string;
  feedUrl: string;
  siteUrl: string;
  description: string;
  category: string;
  status: "active" | "stale" | "error";
  lastFetched?: string;
  errorDetail?: string;
}

interface FeedItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  content: string;
  author: string;
  publishedAt: string;
  feedUrl: string;
  feedTitle: string;
  isRead?: boolean;
  isBookmarked?: boolean;
}

interface Category {
  name: string;
  order: number;
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const isGuest = mode === "guest";

  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Search & Navigation Selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNav, setSelectedNav] = useState<{
    type: "all" | "saved" | "category" | "feed";
    value?: string;
  }>({ type: "all" });

  // Feeds, Categories, Bookmarks, and Read States
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Layout Preference & Loading Status
  const [layout, setLayout] = useState<"compact" | "standard" | "cards" | "split">("standard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedHealth, setFeedHealth] = useState({ active: 0, stale: 0, error: 0 });

  // Active Reading Item
  const [activeItem, setActiveItem] = useState<FeedItem | null>(null);

  // Keyboard navigation index
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Dialog states
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedCategory, setNewFeedCategory] = useState("");
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingStatus, setAddingStatus] = useState<string | null>(null);

  // Refs for list scrolling and OPML uploads
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load (Guest vs Auth Setup)
  useEffect(() => {
    async function loadDashboard() {
      if (sessionStatus === "loading") return;

      setLoading(true);
      if (isGuest) {
        // Retrieve or Seed Guest Session
        const cachedFeeds = sessionStorage.getItem("guest_feeds");
        const cachedCategories = sessionStorage.getItem("guest_categories");
        const cachedRead = sessionStorage.getItem("guest_read");
        const cachedBookmarks = sessionStorage.getItem("guest_bookmarks");

        let loadedFeeds: Feed[] = [];
        let loadedCategories: Category[] = [];

        if (cachedFeeds && cachedCategories) {
          loadedFeeds = JSON.parse(cachedFeeds);
          loadedCategories = JSON.parse(cachedCategories);
        } else {
          // Fetch sample/seed feeds
          try {
            const res = await fetch("/api/feeds/sample");
            if (!res.ok) throw new Error("Seed fetch failed");
            const data = await res.json();
            
            // Transform sample JSON
            const seedFeeds: Feed[] = [];
            const seedCategories: Category[] = [];
            
            data.categories.forEach((cat: any, index: number) => {
              seedCategories.push({ name: cat.name, order: index });
              cat.feeds.forEach((feed: any) => {
                seedFeeds.push({
                  title: feed.title,
                  feedUrl: feed.feedUrl,
                  siteUrl: feed.siteUrl || "",
                  description: feed.description || "",
                  category: cat.name,
                  status: "active",
                });
              });
            });

            loadedFeeds = seedFeeds;
            loadedCategories = seedCategories;
            
            sessionStorage.setItem("guest_feeds", JSON.stringify(seedFeeds));
            sessionStorage.setItem("guest_categories", JSON.stringify(seedCategories));
          } catch (err) {
            console.error("Failed to seed guest database:", err);
          }
        }

        setFeeds(loadedFeeds);
        setCategories(loadedCategories);
        
        if (cachedRead) setReadIds(new Set(JSON.parse(cachedRead)));
        if (cachedBookmarks) setBookmarkedIds(new Set(JSON.parse(cachedBookmarks)));

        // Retrieve saved items if exists
        const cachedItems = sessionStorage.getItem("guest_items");
        if (cachedItems) {
          setItems(JSON.parse(cachedItems));
          setLoading(false);
        } else {
          // Fetch real items for feeds in batch
          await fetchBatchArticles(loadedFeeds);
        }
      } else if (isAuthenticated) {
        // Authenticated user: Load from server MongoDB endpoints
        try {
          // Fetch categories
          const catRes = await fetch("/api/db/categories");
          const cats = catRes.ok ? await catRes.json() : [];
          
          // Fetch feeds
          const feedsRes = await fetch("/api/db/feeds");
          const dbFeeds = feedsRes.ok ? await feedsRes.json() : [];
          
          // Fetch bookmarks
          const bmRes = await fetch("/api/db/bookmarks");
          const bms = bmRes.ok ? await bmRes.json() : [];
          
          // Fetch read states
          const rsRes = await fetch("/api/db/read-states");
          const rss = rsRes.ok ? await rsRes.json() : [];

          // Fetch items
          const itemsRes = await fetch("/api/db/items");
          const dbItems = itemsRes.ok ? await itemsRes.json() : [];

          // Transform feeds to client structure
          const transformedFeeds: Feed[] = dbFeeds.map((f: any) => ({
            title: f.title,
            feedUrl: f.url,
            siteUrl: f.siteUrl || "",
            description: f.description || "",
            category: f.category || "Uncategorized",
            status: f.status || "active",
            lastFetched: f.lastFetched,
          }));

          // Transform categories to client structure
          const transformedCats: Category[] = cats.map((c: any) => ({
            name: c.name,
            order: c.orderIndex || 0,
          }));

          setCategories(transformedCats);
          setFeeds(transformedFeeds);
          setReadIds(new Set(rss));
          setBookmarkedIds(new Set(bms));
          setItems(dbItems);
        } catch (err) {
          console.error("Failed to load authenticated dashboard data:", err);
        } finally {
          setLoading(false);
        }
      } else {
        // Redirect to login if not authenticated and not guest mode
        router.push("/login");
      }
    }

    loadDashboard();
  }, [isGuest, sessionStatus, isAuthenticated]);

  // Handle batch fetching
  const fetchBatchArticles = async (feedList: Feed[]) => {
    if (feedList.length === 0) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      if (isGuest) {
        const urls = feedList.map((f) => f.feedUrl);
        const res = await fetch("/api/feeds/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        if (!res.ok) throw new Error("Batch fetch failed");
        const data = await res.json();
        
        let allItems: FeedItem[] = [];
        let updatedFeeds = [...feedList];

        data.results.forEach((resItem: any) => {
          const feedMeta = updatedFeeds.find((f) => f.feedUrl === resItem.url);
          if (feedMeta) {
            if (resItem.success) {
              feedMeta.status = "active";
              feedMeta.lastFetched = new Date().toISOString();
              feedMeta.title = resItem.feed.title || feedMeta.title;
              feedMeta.description = resItem.feed.description || feedMeta.description;
              
              const normalized = resItem.feed.items.map((item: any) => ({
                ...item,
                feedUrl: resItem.url,
                feedTitle: feedMeta.title,
              }));
              allItems = [...allItems, ...normalized];
            } else {
              feedMeta.status = "error";
              feedMeta.errorDetail = resItem.error;
            }
          }
        });

        // Sort items reverse chronologically
        allItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        setItems(allItems);
        setFeeds(updatedFeeds);
        sessionStorage.setItem("guest_items", JSON.stringify(allItems));
        sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
      } else if (isAuthenticated) {
        // Authenticated user: trigger server-side database feeds refresh
        const res = await fetch("/api/db/feeds/refresh", {
          method: "POST",
        });
        if (!res.ok) throw new Error("Database feeds refresh failed");

        // Reload data from DB endpoints
        const feedsRes = await fetch("/api/db/feeds");
        const dbFeeds = feedsRes.ok ? await feedsRes.json() : [];
        const itemsRes = await fetch("/api/db/items");
        const dbItems = itemsRes.ok ? await itemsRes.json() : [];

        const transformedFeeds: Feed[] = dbFeeds.map((f: any) => ({
          title: f.title,
          feedUrl: f.url,
          siteUrl: f.siteUrl || "",
          description: f.description || "",
          category: f.category || "Uncategorized",
          status: f.status || "active",
          lastFetched: f.lastFetched,
        }));

        setFeeds(transformedFeeds);
        setItems(dbItems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sync Feed Health Counts
  useEffect(() => {
    const health = { active: 0, stale: 0, error: 0 };
    feeds.forEach((f) => {
      if (f.status === "error") health.error++;
      else if (f.status === "stale") health.stale++;
      else health.active++;
    });
    setFeedHealth(health);
  }, [feeds]);

  // Compute items filtered by selection and search query
  const filteredItems = useMemo(() => {
    let result = [...items];

    // 1. Navigation category / feed filtering
    if (selectedNav.type === "saved") {
      result = result.filter((item) => bookmarkedIds.has(item.guid));
    } else if (selectedNav.type === "category") {
      const categoryFeeds = feeds.filter((f) => f.category === selectedNav.value).map((f) => f.feedUrl);
      result = result.filter((item) => categoryFeeds.includes(item.feedUrl));
    } else if (selectedNav.type === "feed") {
      result = result.filter((item) => item.feedUrl === selectedNav.value);
    }

    // 2. Search Text query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, selectedNav, searchTerm, bookmarkedIds, feeds]);

  // Reset keyboard selected index when filter changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [selectedNav, searchTerm]);

  // Read/Unread toggling & Persist
  const toggleRead = async (item: FeedItem, state?: boolean) => {
    const newRead = new Set(readIds);
    const targetState = state !== undefined ? state : !newRead.has(item.guid);
    
    if (targetState) {
      newRead.add(item.guid);
    } else {
      newRead.delete(item.guid);
    }
    
    setReadIds(newRead);
    if (isGuest) {
      sessionStorage.setItem("guest_read", JSON.stringify(Array.from(newRead)));
    } else if (isAuthenticated) {
      try {
        await fetch("/api/db/read-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.guid, isRead: targetState }),
        });
      } catch (err) {
        console.error("Failed to sync read state with DB:", err);
      }
    }
  };

  // Bookmark toggling
  const toggleBookmark = async (item: FeedItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const newBookmarks = new Set(bookmarkedIds);
    if (newBookmarks.has(item.guid)) {
      newBookmarks.delete(item.guid);
    } else {
      newBookmarks.add(item.guid);
    }
    setBookmarkedIds(newBookmarks);
    if (isGuest) {
      sessionStorage.setItem("guest_bookmarks", JSON.stringify(Array.from(newBookmarks)));
    } else if (isAuthenticated) {
      try {
        await fetch("/api/db/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.guid }),
        });
      } catch (err) {
        console.error("Failed to sync bookmark with DB:", err);
      }
    }
  };

  // Add Feed logic
  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl) return;

    setAddingStatus("validating");
    try {
      if (isGuest) {
        const res = await fetch("/api/feeds/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: newFeedUrl }),
        });
        
        if (!res.ok) throw new Error("Feed URL is not a valid RSS/Atom feed");
        
        const parsedFeed = await res.json();
        
        const newFeed: Feed = {
          title: parsedFeed.title || "New Feed",
          feedUrl: newFeedUrl,
          siteUrl: parsedFeed.link || "",
          description: parsedFeed.description || "",
          category: newFeedCategory || "Uncategorized",
          status: "active",
          lastFetched: new Date().toISOString(),
        };

        const updatedFeeds = [newFeed, ...feeds];
        setFeeds(updatedFeeds);

        // Inject items
        const newItems: FeedItem[] = parsedFeed.items.map((item: any) => ({
          ...item,
          feedUrl: newFeedUrl,
          feedTitle: newFeed.title,
        }));

        const mergedItems = [...newItems, ...items].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        setItems(mergedItems);
        sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
        sessionStorage.setItem("guest_items", JSON.stringify(mergedItems));
      } else if (isAuthenticated) {
        // Authenticated user subscription
        const res = await fetch("/api/db/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: newFeedUrl, category: newFeedCategory }),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to add feed to database");
        }

        // Reload all feeds and items
        const feedsRes = await fetch("/api/db/feeds");
        const dbFeeds = feedsRes.ok ? await feedsRes.json() : [];
        const itemsRes = await fetch("/api/db/items");
        const dbItems = itemsRes.ok ? await itemsRes.json() : [];

        const transformedFeeds: Feed[] = dbFeeds.map((f: any) => ({
          title: f.title,
          feedUrl: f.url,
          siteUrl: f.siteUrl || "",
          description: f.description || "",
          category: f.category || "Uncategorized",
          status: f.status || "active",
          lastFetched: f.lastFetched,
        }));

        setFeeds(transformedFeeds);
        setItems(dbItems);
      }

      setNewFeedUrl("");
      setIsAddFeedOpen(false);
      setAddingStatus(null);
    } catch (err: any) {
      setAddingStatus(`Error: ${err.message || err}`);
    }
  };

  // OPML Upload & Import
  const handleOpmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/feeds/opml", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to parse OPML file");
      const data = await res.json();

      // Extract new feeds
      const newFeedsList: Feed[] = data.feeds.map((f: any) => ({
        title: f.title,
        feedUrl: f.xmlUrl,
        siteUrl: "",
        description: "",
        category: f.category || "Uncategorized",
        status: "active",
      }));

      // Merge categories
      const uniqueCatNames = Array.from(new Set([
        ...categories.map((c) => c.name),
        ...newFeedsList.map((f) => f.category)
      ]));
      const updatedCategories = uniqueCatNames.map((name, index) => ({ name, order: index }));

      // Merge feeds
      const mergedFeeds = [...feeds];
      newFeedsList.forEach((newFeed) => {
        if (!mergedFeeds.some((f) => f.feedUrl === newFeed.feedUrl)) {
          mergedFeeds.push(newFeed);
        }
      });

      setFeeds(mergedFeeds);
      setCategories(updatedCategories);

      if (isGuest) {
        sessionStorage.setItem("guest_feeds", JSON.stringify(mergedFeeds));
        sessionStorage.setItem("guest_categories", JSON.stringify(updatedCategories));
      }

      alert(`Successfully imported ${data.totalImported} feeds! (Skipped ${data.duplicateCount} duplicates)`);
      
      // Batch fetch articles for all feeds
      await fetchBatchArticles(mergedFeeds);
    } catch (err: any) {
      alert(`Import failed: ${err.message || err}`);
      setLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // OPML Export Subscriptions
  const handleExportOpml = () => {
    let opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>Frontpage Exported Feeds</title>\n  </head>\n  <body>\n`;

    // Group feeds by categories
    categories.forEach((cat) => {
      const catFeeds = feeds.filter((f) => f.category === cat.name);
      if (catFeeds.length > 0) {
        opml += `    <outline text="${cat.name}" title="${cat.name}">\n`;
        catFeeds.forEach((feed) => {
          opml += `      <outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.feedUrl}" htmlUrl="${feed.siteUrl}" />\n`;
        });
        opml += `    </outline>\n`;
      }
    });

    // Uncategorized feeds
    const uncategorizedFeeds = feeds.filter((f) => !f.category || f.category === "Uncategorized");
    if (uncategorizedFeeds.length > 0) {
      uncategorizedFeeds.forEach((feed) => {
        opml += `    <outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.feedUrl}" htmlUrl="${feed.siteUrl}" />\n`;
      });
    }

    opml += `  </body>\n</opml>`;

    const blob = new Blob([opml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "subscriptions.opml";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Delete Feed
  const handleDeleteFeed = async (feedUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to unsubscribe from this feed?")) {
      const updatedFeeds = feeds.filter((f) => f.feedUrl !== feedUrl);
      const updatedItems = items.filter((item) => item.feedUrl !== feedUrl);
      setFeeds(updatedFeeds);
      setItems(updatedItems);
      
      if (selectedNav.type === "feed" && selectedNav.value === feedUrl) {
        setSelectedNav({ type: "all" });
      }

      if (isGuest) {
        sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
        sessionStorage.setItem("guest_items", JSON.stringify(updatedItems));
      } else if (isAuthenticated) {
        try {
          await fetch(`/api/db/feeds?url=${encodeURIComponent(feedUrl)}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to delete feed from DB:", err);
        }
      }
    }
  };

  // Add Category logic
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName || categories.some((c) => c.name.toLowerCase() === newCategoryName.toLowerCase())) return;

    const newCat = { name: newCategoryName, order: categories.length };
    const updated = [...categories, newCat];
    setCategories(updated);
    if (isGuest) {
      sessionStorage.setItem("guest_categories", JSON.stringify(updated));
    } else if (isAuthenticated) {
      try {
        await fetch("/api/db/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategoryName, orderIndex: categories.length }),
        });
      } catch (err) {
        console.error("Failed to add category to DB:", err);
      }
    }
    setNewCategoryName("");
    setIsAddCategoryOpen(false);
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    const newRead = new Set(readIds);
    filteredItems.forEach((item) => newRead.add(item.guid));
    setReadIds(newRead);
    if (isGuest) {
      sessionStorage.setItem("guest_read", JSON.stringify(Array.from(newRead)));
    }
  };

  // Calculate unread counts
  const categoryUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.name] = 0;
    });

    items.forEach((item) => {
      if (!readIds.has(item.guid)) {
        const feed = feeds.find((f) => f.feedUrl === item.feedUrl);
        if (feed && counts[feed.category] !== undefined) {
          counts[feed.category]++;
        }
      }
    });

    return counts;
  }, [items, readIds, feeds, categories]);

  const feedUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    feeds.forEach((feed) => {
      counts[feed.feedUrl] = 0;
    });

    items.forEach((item) => {
      if (!readIds.has(item.guid) && counts[item.feedUrl] !== undefined) {
        counts[item.feedUrl]++;
      }
    });

    return counts;
  }, [items, readIds, feeds]);

  const totalUnreadCount = useMemo(() => {
    return items.filter((item) => !readIds.has(item.guid)).length;
  }, [items, readIds]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys inside input elements
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev < filteredItems.length - 1 ? prev + 1 : prev;
          // Scroll into view
          itemRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          // Scroll into view
          itemRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "o" || e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          const targetItem = filteredItems[selectedIndex];
          setActiveItem(targetItem);
          toggleRead(targetItem, true);
        }
      } else if (e.key === "m") {
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          toggleRead(filteredItems[selectedIndex]);
        }
      } else if (e.key === "s") {
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          toggleBookmark(filteredItems[selectedIndex]);
        }
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("search-bar");
        searchInput?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, readIds, bookmarkedIds]);

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary overflow-hidden font-sans">
      {/* 1. Guest mode callout banner */}
      {isGuest && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-accent text-white p-4 rounded-lg shadow-lg border border-accent/20 flex flex-col gap-2 transition-all duration-300 animate-slide-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-300" />
              <span className="font-semibold text-sm">Guest Mode Active</span>
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-white/95">
            Your bookmarks and read states are saved locally in this session. Create a free account to import custom feeds, configure layouts, and sync devices!
          </p>
          <div className="flex justify-end gap-2 mt-1">
            <Link
              href="/signup"
              className="px-3 py-1 bg-white text-accent font-semibold text-[11px] rounded hover:bg-bg-secondary transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}

      {/* Shortcuts overlay help dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-lg shadow-lg max-w-sm w-full mx-4 relative">
            <button
              onClick={() => setShowShortcuts(false)}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-accent" />
              Keyboard Shortcuts
            </h3>
            <div className="flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Move index down</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">j</kbd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Move index up</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">k</kbd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Open selected article</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">o / Enter</kbd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Toggle read status</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">m</kbd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Toggle save/bookmark</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">s</kbd>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-1">
                <span>Focus search bar</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">/</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span>Toggle shortcuts help</span>
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-1 h-screen overflow-hidden relative">
        {/* Sidebar backdrop overlay for mobile */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Sidebar Nav */}
        <aside
          className={`bg-bg-secondary border-r border-border flex flex-col transition-all duration-300 h-full fixed md:relative z-40 ${
            sidebarOpen ? "w-[16.25rem] translate-x-0" : "w-0 overflow-hidden border-r-0 -translate-x-full md:translate-x-0"
          }`}
        >
          {/* Logo Brand Header */}
          <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
                F
              </span>
              <span className="font-sans font-bold tracking-tight text-sm">Frontpage</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-text-tertiary hover:text-text-primary md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation categories listing */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedNav({ type: "all" })}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  selectedNav.type === "all" ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  All Feeds
                </span>
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-full">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setSelectedNav({ type: "saved" })}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  selectedNav.type === "saved" ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Saved Articles
                </span>
                {bookmarkedIds.size > 0 && (
                  <span className="px-1.5 py-0.5 bg-bg-tertiary text-text-secondary text-[10px] font-bold rounded-full border border-border">
                    {bookmarkedIds.size}
                  </span>
                )}
              </button>
            </div>

            {/* Categories */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                <span>Categories</span>
                <button
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="hover:text-text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {categories.map((cat) => {
                const isSelected = selectedNav.type === "category" && selectedNav.value === cat.name;
                const unread = categoryUnreadCounts[cat.name] || 0;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedNav({ type: "category", value: cat.name })}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      isSelected ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    {unread > 0 && (
                      <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-full">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feeds Subscriptions list */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                <span>Subscriptions</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Import OPML"
                    className="hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <Import className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setIsAddFeedOpen(true)}
                    title="Add Feed"
                    className="hover:text-text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {feeds.map((feed) => {
                const isSelected = selectedNav.type === "feed" && selectedNav.value === feed.feedUrl;
                const unread = feedUnreadCounts[feed.feedUrl] || 0;
                const isError = feed.status === "error";

                return (
                  <button
                    key={feed.feedUrl}
                    onClick={() => setSelectedNav({ type: "feed", value: feed.feedUrl })}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors group relative ${
                      isSelected ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    <span className={`truncate flex items-center gap-1.5 max-w-[80%]`}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          isError ? "bg-error" : "bg-success"
                        }`}
                        title={isError ? "Fetch error" : "Active"}
                      />
                      <span className="truncate">{feed.title}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 bg-bg-tertiary text-text-secondary text-[10px] font-semibold rounded-full group-hover:hidden">
                          {unread}
                        </span>
                      )}
                      <Trash2
                        onClick={(e) => handleDeleteFeed(feed.feedUrl, e)}
                        className="h-3.5 w-3.5 text-text-tertiary hover:text-error hidden group-hover:inline-block cursor-pointer transition-colors"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-border shrink-0 text-[11px] text-text-tertiary flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>Feeds Health</span>
              <span className="font-semibold text-text-secondary">
                {feedHealth.active} / {feeds.length}
              </span>
            </div>
             <button
              onClick={handleExportOpml}
              className="flex items-center gap-1.5 hover:text-text-primary text-left transition-colors mt-1 font-medium cursor-pointer"
            >
              <Import className="h-3.5 w-3.5 rotate-180" />
              Export Subscriptions (OPML)
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1.5 hover:text-text-primary text-left transition-colors mt-1 font-medium"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Keyboard Shortcuts (?)
            </button>

            {/* Auth / Account Profile Info */}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              {isAuthenticated && session?.user ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || "User"}
                        className="h-6 w-6 rounded-full shrink-0 object-cover border border-border"
                      />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {session.user.name ? session.user.name[0].toUpperCase() : "U"}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-text-secondary truncate">
                      {session.user.name || session.user.email}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    title="Sign Out"
                    className="p-1 text-text-tertiary hover:text-error hover:bg-bg-tertiary rounded transition-colors shrink-0 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="w-full py-1.5 px-3 bg-accent text-white text-[11px] font-semibold rounded hover:bg-accent-hover text-center transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Sign In to Sync
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-bg-primary overflow-hidden">
          {/* Header Bar */}
          <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 gap-4">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}

              <h2 className="font-sans font-bold text-base md:text-lg tracking-tight truncate max-w-[200px] sm:max-w-[400px]">
                {selectedNav.type === "all" && "All Subscriptions"}
                {selectedNav.type === "saved" && "Saved / Reading List"}
                {selectedNav.type === "category" && `Category: ${selectedNav.value}`}
                {selectedNav.type === "feed" && feeds.find((f) => f.feedUrl === selectedNav.value)?.title}
              </h2>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2">
              {/* Search input bar */}
              <div className="relative max-w-xs w-[140px] sm:w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-tertiary" />
                <input
                  id="search-bar"
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                />
              </div>

              {/* Refresh control */}
              <button
                onClick={() => fetchBatchArticles(feeds)}
                disabled={refreshing}
                title="Refresh feeds"
                className="p-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>

              {/* Mark all as read button */}
              <button
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="p-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-xs font-semibold px-2.5"
              >
                Mark All Read
              </button>

              {/* Layout triggers */}
              <div className="hidden md:flex border border-border rounded-md overflow-hidden bg-bg-secondary p-0.5">
                <button
                  onClick={() => setLayout("standard")}
                  className={`p-1.5 rounded-sm transition-colors ${
                    layout === "standard" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                  }`}
                  title="List layout"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLayout("compact")}
                  className={`p-1.5 rounded-sm transition-colors ${
                    layout === "compact" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                  }`}
                  title="Compact layout"
                >
                  <AlignJustify className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLayout("cards")}
                  className={`p-1.5 rounded-sm transition-colors ${
                    layout === "cards" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                  }`}
                  title="Card Grid layout"
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLayout("split")}
                  className={`p-1.5 rounded-sm transition-colors ${
                    layout === "split" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                  }`}
                  title="Split Reader layout"
                >
                  <Layout className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </header>

          {/* Feeds Content Area Grid */}
          <div className="flex-1 overflow-hidden flex relative">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {loading ? (
                // Skeletons loading screen
                <div className="flex flex-col gap-6 w-full max-w-[60rem] mx-auto">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border border-border-subtle rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-bg-tertiary rounded-full" />
                        <div className="h-3.5 w-24 bg-bg-tertiary rounded" />
                        <div className="h-3.5 w-16 bg-bg-tertiary rounded" />
                      </div>
                      <div className="h-5 w-2/3 bg-bg-tertiary rounded" />
                      <div className="h-3.5 w-full bg-bg-tertiary rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                // Empty view states
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 max-w-sm mx-auto">
                  <div className="h-12 w-12 bg-bg-secondary border border-border text-text-tertiary rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">No articles found</h3>
                  <p className="text-xs text-text-secondary mb-4">
                    {searchTerm ? "No articles match your search parameters. Try check spelling or search different terms." : "This category or subscription is currently empty."}
                  </p>
                </div>
              ) : (
                // Renders Layout views
                <div
                  className={`mx-auto w-full max-w-[60rem] ${
                    layout === "cards" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"
                  }`}
                >
                  {filteredItems.map((item, index) => {
                    const isRead = readIds.has(item.guid);
                    const isBookmarked = bookmarkedIds.has(item.guid);
                    const isSelected = index === selectedIndex;
                    
                    // Simple relative date formatting
                    let relDate = "";
                    try {
                      relDate = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true });
                    } catch {
                      relDate = item.publishedAt;
                    }

                    // Render card view
                    if (layout === "cards") {
                      return (
                        <div
                          key={item.guid}
                          ref={(el) => { itemRefs.current[index] = el; }}
                          onClick={() => {
                            setActiveItem(item);
                            toggleRead(item, true);
                          }}
                          className={`p-4 border rounded-lg bg-surface flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            isSelected ? "ring-2 ring-accent border-transparent" : "border-border"
                          } ${isRead ? "opacity-75" : ""}`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                              <span className="truncate max-w-[120px]" title={item.feedTitle}>
                                {item.feedTitle}
                              </span>
                              <span>•</span>
                              <span>{relDate}</span>
                            </div>
                            <h3 className={`font-sans font-semibold text-base md:text-lg leading-snug tracking-tight text-text-primary ${!isRead ? "font-bold" : "font-normal"}`}>
                              {item.title}
                            </h3>
                            <p className="font-sans text-sm text-text-secondary leading-relaxed line-clamp-3">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-border-subtle pt-3 mt-4">
                            <span className="text-xs text-text-tertiary font-medium">By {item.author || "Unknown"}</span>
                            <button
                              onClick={(e) => toggleBookmark(item, e)}
                              className="text-text-tertiary hover:text-accent"
                            >
                              <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-accent text-accent" : ""}`} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Render standard view
                    return (
                      <div
                        key={item.guid}
                        ref={(el) => { itemRefs.current[index] = el; }}
                        onClick={() => {
                          setActiveItem(item);
                          toggleRead(item, true);
                        }}
                        className={`p-4 border rounded-lg bg-surface flex flex-col gap-2 cursor-pointer transition-colors ${
                          isSelected ? "ring-2 ring-accent border-transparent bg-accent-subtle/20" : "border-border hover:bg-bg-secondary"
                        } ${isRead ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary">
                            {!isRead && (
                              <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
                            )}
                            <span className="truncate max-w-[120px] uppercase tracking-wider" title={item.feedTitle}>
                              {item.feedTitle}
                            </span>
                            <span>•</span>
                            <span>{relDate}</span>
                            {item.author && (
                              <>
                                <span>•</span>
                                <span className="truncate">By {item.author}</span>
                              </>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => toggleBookmark(item, e)}
                            className="text-text-tertiary hover:text-accent"
                          >
                            <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-accent text-accent" : ""}`} />
                          </button>
                        </div>

                        <div className="flex flex-col gap-1">
                          <h3 className={`font-sans font-semibold text-base md:text-xl leading-snug tracking-tight text-text-primary ${!isRead ? "font-bold" : "font-normal"}`}>
                            {item.title}
                          </h3>
                          {layout === "standard" && (
                            <p className="font-sans text-sm md:text-base text-text-secondary leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Split view reader panel right side */}
            {layout === "split" && activeItem && (
              <div className="w-[28rem] xl:w-[35rem] border-l border-border h-full flex flex-col bg-surface overflow-y-auto shrink-0 relative p-6 animate-slide-in">
                <button
                  onClick={() => setActiveItem(null)}
                  className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary border border-border p-1 rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3 mt-4">
                  <span>{activeItem.feedTitle}</span>
                  <span>•</span>
                  <span>{new Date(activeItem.publishedAt).toLocaleDateString()}</span>
                </div>
                <h1 className="font-serif font-bold text-2xl md:text-3xl leading-snug mb-3">
                  {activeItem.title}
                </h1>
                {activeItem.author && (
                  <p className="text-sm text-text-secondary font-medium mb-6">Published by {activeItem.author}</p>
                )}
                <div className="border-b border-border pb-4 mb-6 flex justify-between">
                  <a
                    href={activeItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    Open original article
                  </a>
                  <button
                    onClick={() => toggleBookmark(activeItem)}
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-accent font-medium"
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarkedIds.has(activeItem.guid) ? "fill-accent text-accent" : ""}`} />
                    {bookmarkedIds.has(activeItem.guid) ? "Saved" : "Save article"}
                  </button>
                </div>
                <article
                  className="font-serif text-base text-text-secondary leading-relaxed flex flex-col gap-4 overflow-x-hidden prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: activeItem.content || activeItem.description }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Reader Modal popup Overlay for standard/compact/card views */}
      {layout !== "split" && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-[45rem] h-full flex flex-col shadow-2xl relative p-6 md:p-8 overflow-y-auto animate-slide-in">
            <button
              onClick={() => setActiveItem(null)}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary border border-border p-1.5 rounded-md hover:bg-bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3 mt-6">
              <span>{activeItem.feedTitle}</span>
              <span>•</span>
              <span>{new Date(activeItem.publishedAt).toLocaleDateString()}</span>
            </div>

            <h1 className="font-serif font-bold text-2xl md:text-4xl leading-snug tracking-tight mb-4">
              {activeItem.title}
            </h1>

            {activeItem.author && (
              <p className="text-sm text-text-secondary font-medium mb-6">Published by {activeItem.author}</p>
            )}

            <div className="border-b border-border pb-4 mb-6 flex justify-between">
              <a
                href={activeItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Open original article
              </a>
              <button
                onClick={() => toggleBookmark(activeItem)}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-accent font-medium"
              >
                <Bookmark className={`h-4 w-4 ${bookmarkedIds.has(activeItem.guid) ? "fill-accent text-accent" : ""}`} />
                {bookmarkedIds.has(activeItem.guid) ? "Saved" : "Save article"}
              </button>
            </div>

            <article
              className="font-serif text-lg text-text-secondary leading-relaxed flex flex-col gap-5 overflow-x-hidden max-w-none pb-12 prose prose-lg dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: activeItem.content || activeItem.description }}
            />
          </div>
        </div>
      )}

      {/* Add Feed dialog modal popup */}
      {isAddFeedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Subscribe to Feed</h3>
            <form onSubmit={handleAddFeed} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Feed RSS/Atom URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/rss.xml"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Assign to Category</label>
                <select
                  value={newFeedCategory}
                  onChange={(e) => setNewFeedCategory(e.target.value)}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                >
                  <option value="">Choose a Category (Optional)</option>
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="Uncategorized">Uncategorized</option>
                </select>
              </div>

              {addingStatus && (
                <p className="text-xs text-text-secondary mt-1">
                  {addingStatus === "validating" ? "Validating RSS structure..." : addingStatus}
                </p>
              )}

              <div className="flex justify-end gap-3 mt-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddFeedOpen(false);
                    setAddingStatus(null);
                  }}
                  className="px-3 py-2 text-xs font-semibold hover:bg-bg-secondary rounded-md border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStatus === "validating"}
                  className="px-3 py-2 text-xs font-semibold bg-accent text-white hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category dialog modal popup */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Create Category</h3>
            <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frontend, Design, AI"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-3 py-2 text-xs font-semibold hover:bg-bg-secondary rounded-md border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold bg-accent text-white hover:bg-accent-hover rounded-md transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOpmlUpload}
        accept=".opml,.xml"
        className="hidden"
      />
    </div>
  );
}
