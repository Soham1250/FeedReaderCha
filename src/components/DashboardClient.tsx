"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen,
  Bookmark,
  ChevronLeft,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  HelpCircle,
  Import,
  Layout,
  List,
  Grid,
  LogOut,
  AlignJustify,
  MoreVertical
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

// Recommended feeds catalog for Discover tab
const recommendedFeeds = [
  {
    title: "Smashing Magazine",
    description: "Deep-dives and tips on web design, frontend components, and user experience.",
    url: "https://www.smashingmagazine.com/feed/",
    category: "Design",
  },
  {
    title: "CSS-Tricks",
    description: "Excellent code snippets, layout techniques, and modern styling guidelines.",
    url: "https://css-tricks.com/feed/",
    category: "Frontend",
  },
  {
    title: "web.dev",
    description: "Direct articles on web performance, accessibility, and modern API support.",
    url: "https://web.dev/feed.xml",
    category: "Frontend",
  },
  {
    title: "Sidebar.io",
    description: "A premium newsletter delivering the five best design links every single day.",
    url: "https://sidebar.io/feed.xml",
    category: "Design",
  },
  {
    title: "UX Collective",
    description: "A highly curated library of UX insights, case studies, and designer reviews.",
    url: "https://uxdesign.cc/feed",
    category: "Design",
  },
  {
    title: "Simon Willison",
    description: "Insights on Python development, SQL tooling, and AI engineering.",
    url: "https://simonwillison.net/atom/entries/",
    category: "General Tech",
  }
];

// Accent dot color mappings for categories
const getCategoryColor = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes("front")) return "bg-blue-500";
  if (name.includes("design")) return "bg-pink-500";
  if (name.includes("back") || name.includes("dev")) return "bg-orange-500";
  if (name.includes("gen") || name.includes("tech")) return "bg-indigo-500";
  if (name.includes("ai") || name.includes("ml")) return "bg-purple-500";
  return "bg-teal-500";
};

// Soft background badge styling matching accents
const getCategoryBadgeClass = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes("front")) return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
  if (name.includes("design")) return "bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400";
  if (name.includes("back") || name.includes("dev")) return "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400";
  if (name.includes("gen") || name.includes("tech")) return "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400";
  if (name.includes("ai") || name.includes("ml")) return "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
  return "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400";
};

// Colored initials square avatar for feeds
const renderFeedIcon = (feedTitle: string, urlForDomain?: string) => {
  const letter = feedTitle ? feedTitle.charAt(0).toUpperCase() : "?";
  const colors = [
    "bg-red-500 text-white",
    "bg-orange-500 text-white",
    "bg-amber-500 text-white",
    "bg-emerald-500 text-white",
    "bg-teal-500 text-white",
    "bg-blue-500 text-white",
    "bg-indigo-500 text-white",
    "bg-violet-500 text-white",
    "bg-purple-500 text-white",
    "bg-pink-500 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < feedTitle.length; i++) {
    hash = feedTitle.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorClass = colors[Math.abs(hash) % colors.length];

  let domain = "";
  if (urlForDomain) {
    try {
      domain = new URL(urlForDomain).hostname;
    } catch (e) {}
  }

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: "1.125rem", height: "1.125rem" }}>
      {domain && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={feedTitle}
          className="absolute inset-0 h-full w-full rounded object-cover shadow-sm bg-white"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <span className={`absolute inset-0 rounded text-[9px] font-bold flex items-center justify-center shadow-sm leading-none -z-10 ${colorClass}`}>
        {letter}
      </span>
    </div>
  );
};

// Clean text summarizer utility for articles
const getArticleSummary = (contentStr: string, fallbackDesc: string) => {
  const source = contentStr || fallbackDesc || "";
  // strip HTML tags cleanly and remove duplicate white spaces
  const cleanText = source
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (cleanText.length <= 250) return cleanText;
  return cleanText.substring(0, 250) + "...";
};

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

  // Pagination limit for client-side rendering
  const [displayLimit, setDisplayLimit] = useState(50);

  // Keyboard navigation index
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Active Navigation Tab (Feed, Digest, Discover)
  const [activeTab, setActiveTab] = useState<"feed" | "digest" | "discover">("feed");

  // Dialog states
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedCategory, setNewFeedCategory] = useState("");
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingStatus, setAddingStatus] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);

  // New Sprint 2 state variables
  const [showGuestBanner, setShowGuestBanner] = useState(true);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });

  // Auto-dismiss guest banner if saved in sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("hideGuestBanner");
      if (dismissed === "true") {
        setShowGuestBanner(false);
      }
    }
  }, []);

  // Toast notification helper
  const showToastMessage = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: null });
    }, 4000);
  };

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
          // Fetch feeds first to check if seeding is needed
          const feedsRes = await fetch("/api/db/feeds");
          let dbFeeds = feedsRes.ok ? await feedsRes.json() : [];

          // AUTO-SEED for new user: if no feeds exist, call seed API
          if (dbFeeds.length === 0) {
            const seedRes = await fetch("/api/db/feeds/seed", { method: "POST" });
            if (seedRes.ok) {
              const newFeedsRes = await fetch("/api/db/feeds");
              dbFeeds = newFeedsRes.ok ? await newFeedsRes.json() : [];
            }
          }

          // Fetch categories
          const catRes = await fetch("/api/db/categories");
          const cats = catRes.ok ? await catRes.json() : [];
          
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

  // Subscribe to recommended feed in Discover tab
  const subscribeToRecommended = async (url: string, category: string) => {
    setLoading(true);
    try {
      if (isGuest) {
        const res = await fetch("/api/feeds/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        
        if (!res.ok) {
          let errorMsg = "Failed to fetch recommended feed structure";
          try {
            const errData = await res.json();
            if (errData && errData.error) {
              errorMsg = errData.error;
            }
          } catch (_) {}
          throw new Error(errorMsg);
        }
        const parsed = await res.json();
        
        const newFeed: Feed = {
          title: parsed.title || "New Feed",
          feedUrl: url,
          siteUrl: parsed.link || "",
          description: parsed.description || "",
          category,
          status: "active",
          lastFetched: new Date().toISOString(),
        };

        const updatedFeeds = [newFeed, ...feeds];
        setFeeds(updatedFeeds);

        const newItems = parsed.items.map((item: any) => ({
          ...item,
          feedUrl: url,
          feedTitle: newFeed.title,
        }));

        const mergedItems = [...newItems, ...items].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        setItems(mergedItems);
        sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
        sessionStorage.setItem("guest_items", JSON.stringify(mergedItems));
      } else if (isAuthenticated) {
        const res = await fetch("/api/db/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, category }),
        });
        if (!res.ok) throw new Error("Failed to subscribe to recommended feed");

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
      showToastMessage("Successfully subscribed to recommended feed!", "success");
    } catch (err: any) {
      showToastMessage(`Subscription failed: ${err.message || err}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle batch fetching
  const fetchBatchArticles = async (feedList: Feed[]) => {
    if (feedList.length === 0) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const oldGuids = new Set(items.map(item => item.guid));
    try {
      if (isGuest) {
        const urls = feedList.map((f) => f.feedUrl);
        const res = await fetch("/api/feeds/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        if (!res.ok) {
          let errorMsg = "Batch fetch failed";
          try {
            const errData = await res.json();
            if (errData && errData.error) {
              errorMsg = errData.error;
            }
          } catch (_) {}
          throw new Error(errorMsg);
        }
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

        // Count new items
        const newlyFound = allItems.filter(item => !oldGuids.has(item.guid));
        if (newlyFound.length > 0 && items.length > 0) {
          setNewItemsCount(newlyFound.length);
        }

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

        // Count new items
        const newlyFound = dbItems.filter((item: any) => !oldGuids.has(item.guid));
        if (newlyFound.length > 0 && items.length > 0) {
          setNewItemsCount(newlyFound.length);
        }

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

      showToastMessage("Successfully subscribed to feed!", "success");
      setNewFeedUrl("");
      setIsAddFeedOpen(false);
      setAddingStatus(null);
    } catch (err: any) {
      setAddingStatus(`Error: ${err.message || err}`);
      showToastMessage(`Failed to subscribe: ${err.message || err}`, "error");
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

  // Edit Category logic
  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.newName) return;
    
    const { oldName, newName } = editingCategory;
    if (oldName === newName) {
      setEditingCategory(null);
      return;
    }

    // Update categories
    const updatedCats = categories.map(c => c.name === oldName ? { ...c, name: newName } : c);
    setCategories(updatedCats);
    
    // Update feeds under this category
    const updatedFeeds = feeds.map(f => f.category === oldName ? { ...f, category: newName } : f);
    setFeeds(updatedFeeds);

    if (isGuest) {
      sessionStorage.setItem("guest_categories", JSON.stringify(updatedCats));
      sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
    } else if (isAuthenticated) {
      try {
        await fetch("/api/db/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldName, newName }),
        });
      } catch (err) {
        console.error("Failed to edit category in DB:", err);
      }
    }
    
    // Update active selections
    if (selectedNav.type === "category" && selectedNav.value === oldName) {
      setSelectedNav({ type: "category", value: newName });
    }
    setEditingCategory(null);
    showToastMessage("Category updated successfully", "success");
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!confirm(`Delete category "${catName}"? Feeds will be moved to Uncategorized.`)) return;

    const updatedCats = categories.filter(c => c.name !== catName);
    setCategories(updatedCats);
    
    const updatedFeeds = feeds.map(f => f.category === catName ? { ...f, category: "Uncategorized" } : f);
    setFeeds(updatedFeeds);

    if (isGuest) {
      sessionStorage.setItem("guest_categories", JSON.stringify(updatedCats));
      sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
    } else if (isAuthenticated) {
      try {
        await fetch(`/api/db/categories?name=${encodeURIComponent(catName)}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete category from DB:", err);
      }
    }
    
    if (selectedNav.type === "category" && selectedNav.value === catName) {
      setSelectedNav({ type: "all" });
    }
    showToastMessage("Category deleted", "success");
  };

  // Edit Feed logic
  const handleEditFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeed) return;
    
    const updatedFeeds = feeds.map(f => f.feedUrl === editingFeed.feedUrl ? editingFeed : f);
    setFeeds(updatedFeeds);

    // Update item titles if feed title changed
    const oldFeed = feeds.find(f => f.feedUrl === editingFeed.feedUrl);
    if (oldFeed && oldFeed.title !== editingFeed.title) {
      const updatedItems = items.map(item => item.feedUrl === editingFeed.feedUrl ? { ...item, feedTitle: editingFeed.title } : item);
      setItems(updatedItems);
      if (isGuest) {
        sessionStorage.setItem("guest_items", JSON.stringify(updatedItems));
      }
    }

    if (isGuest) {
      sessionStorage.setItem("guest_feeds", JSON.stringify(updatedFeeds));
    } else if (isAuthenticated) {
      try {
        await fetch("/api/db/feeds", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: editingFeed.feedUrl, title: editingFeed.title, category: editingFeed.category }),
        });
      } catch (err) {
        console.error("Failed to edit feed in DB:", err);
      }
    }
    
    setEditingFeed(null);
    showToastMessage("Feed updated successfully", "success");
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    const newRead = new Set(readIds);
    const unreadFiltered = filteredItems.filter(item => !readIds.has(item.guid));
    
    if (unreadFiltered.length === 0) return;

    unreadFiltered.forEach((item) => newRead.add(item.guid));
    setReadIds(newRead);
    
    if (isGuest) {
      sessionStorage.setItem("guest_read", JSON.stringify(Array.from(newRead)));
    } else if (isAuthenticated) {
      try {
        const itemIds = unreadFiltered.map(item => item.guid);
        await fetch("/api/db/read-states/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds, isRead: true }),
        });
      } catch (err) {
        console.error("Failed to batch update read states:", err);
      }
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

  const handleNextArticle = () => {
    if (!activeItem) return;
    const currentIndex = filteredItems.findIndex((item) => item.guid === activeItem.guid);
    if (currentIndex >= 0 && currentIndex < filteredItems.length - 1) {
      const nextItem = filteredItems[currentIndex + 1];
      setActiveItem(nextItem);
      toggleRead(nextItem, true);
    }
  };

  const handlePrevArticle = () => {
    if (!activeItem) return;
    const currentIndex = filteredItems.findIndex((item) => item.guid === activeItem.guid);
    if (currentIndex > 0) {
      const prevItem = filteredItems[currentIndex - 1];
      setActiveItem(prevItem);
      toggleRead(prevItem, true);
    }
  };

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
      } else if (e.key === "n" && activeItem) {
        e.preventDefault();
        handleNextArticle();
      } else if (e.key === "p" && activeItem) {
        e.preventDefault();
        handlePrevArticle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, readIds, bookmarkedIds, activeItem]);

  return (
    <div className="flex h-screen w-screen bg-bg-primary text-text-primary overflow-hidden font-sans">
      {/* Toast Alert popup notification */}
      {toast.message && toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold text-white animate-toast border ${
          toast.type === "success" ? "bg-success border-success-hover" : "bg-error border-error-hover"
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
      {/* 1. Guest mode callout banner */}
      {isGuest && showGuestBanner && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-accent text-white p-4 rounded-lg shadow-lg border border-accent/20 flex flex-col gap-2 transition-all duration-300 animate-slide-in hover:shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" />
              <span className="font-semibold text-sm">Guest Mode Active</span>
            </div>
            <button
              onClick={() => {
                setShowGuestBanner(false);
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("hideGuestBanner", "true");
                }
              }}
              className="text-white/60 hover:text-white transition-colors cursor-pointer"
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
              className="px-3 py-1 bg-white text-accent font-semibold text-[11px] rounded hover:bg-bg-secondary transition-colors transition-transform hover:scale-105"
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

      {/* Sidebar mobile backdrop overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar - extended to the top / very end of left side (matches preview.jpg layout) */}
      <aside
        className={`bg-bg-secondary border-r border-border flex flex-col transition-all duration-300 h-full fixed md:relative z-40 ${
          sidebarOpen ? "w-[16.25rem] translate-x-0" : "w-0 overflow-hidden border-r-0 -translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Logo Header (Now nested at the top of the sidebar) */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-sm shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
              </svg>
            </div>
            <span className="font-sans font-bold tracking-tight text-base">Frontpage</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-text-tertiary hover:text-text-primary md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setActiveTab("feed");
                setSelectedNav({ type: "all" });
              }}
              className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                activeTab === "feed" && selectedNav.type === "all" ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <Layout className="h-4 w-4" />
                All Items
              </span>
              {totalUnreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-full">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("feed");
                setSelectedNav({ type: "saved" });
              }}
              className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                activeTab === "feed" && selectedNav.type === "saved" ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                Saved
              </span>
              {bookmarkedIds.size > 0 && (
                <span className="px-1.5 py-0.5 bg-bg-tertiary text-text-secondary text-[10px] font-bold rounded-full border border-border">
                  {bookmarkedIds.size}
                </span>
              )}
            </button>
          </div>

          {/* Categories list */}
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
              const isCatSelected = selectedNav.type === "category" && selectedNav.value === cat.name;
              const catUnread = categoryUnreadCounts[cat.name] || 0;
              const catColor = getCategoryColor(cat.name);
              const catFeeds = feeds.filter((f) => f.category === cat.name);

              return (
                <div key={cat.name} className="flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      setActiveTab("feed");
                      setSelectedNav({ type: "category", value: cat.name });
                    }}
                    className={`flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-md transition-colors group relative ${
                      activeTab === "feed" && isCatSelected ? "bg-accent-subtle text-accent" : "hover:bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${catColor}`} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {catUnread > 0 && (
                        <span className="px-1.5 py-0.5 text-text-secondary text-[10px] font-bold group-hover:hidden">
                          {catUnread}
                        </span>
                      )}
                      <Settings
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory({ oldName: cat.name, newName: cat.name });
                        }}
                        className="h-3.5 w-3.5 text-text-tertiary hover:text-text-primary hidden group-hover:inline-block cursor-pointer transition-colors"
                      />
                    </div>
                  </button>

                  {/* Subscriptions nested under category */}
                  {catFeeds.map((feed) => {
                    const isFeedSelected = selectedNav.type === "feed" && selectedNav.value === feed.feedUrl;
                    const feedUnread = feedUnreadCounts[feed.feedUrl] || 0;
                    return (
                      <button
                        key={feed.feedUrl}
                        onClick={() => {
                          setActiveTab("feed");
                          setSelectedNav({ type: "feed", value: feed.feedUrl });
                        }}
                        className={`flex items-center justify-between pl-7 pr-3 py-1 text-[11px] font-medium rounded-md transition-colors group relative ${
                          activeTab === "feed" && isFeedSelected ? "bg-accent-subtle/50 text-accent font-semibold" : "hover:bg-bg-tertiary text-text-secondary"
                        }`}
                      >
                        <span className="truncate flex items-center gap-1.5 max-w-[80%]">
                          {renderFeedIcon(feed.title, feed.siteUrl || feed.feedUrl)}
                          <span className="truncate">{feed.title}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {feedUnread > 0 && (
                            <span className="px-1.5 py-0.2 bg-bg-tertiary text-text-secondary text-[9px] font-semibold rounded-full group-hover:hidden border border-border-subtle">
                              {feedUnread}
                            </span>
                          )}
                          <Settings
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFeed(feed);
                            }}
                            className="h-3 w-3 text-text-tertiary hover:text-text-primary hidden group-hover:inline-block cursor-pointer transition-colors"
                          />
                          <Trash2
                            onClick={(e) => handleDeleteFeed(feed.feedUrl, e)}
                            className="h-3 w-3 text-text-tertiary hover:text-error hidden group-hover:inline-block cursor-pointer transition-colors"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Uncategorized feeds */}
            {feeds.filter((f) => !f.category || f.category === "Uncategorized").length > 0 && (
              <div className="flex flex-col gap-0.5">
                <div className="px-3 py-1.5 text-xs font-medium text-text-tertiary">Uncategorized</div>
                {feeds
                  .filter((f) => !f.category || f.category === "Uncategorized")
                  .map((feed) => {
                    const isFeedSelected = selectedNav.type === "feed" && selectedNav.value === feed.feedUrl;
                    const feedUnread = feedUnreadCounts[feed.feedUrl] || 0;
                    return (
                      <button
                        key={feed.feedUrl}
                        onClick={() => {
                          setActiveTab("feed");
                          setSelectedNav({ type: "feed", value: feed.feedUrl });
                        }}
                        className={`flex items-center justify-between pl-7 pr-3 py-1 text-[11px] font-medium rounded-md transition-colors group relative ${
                          activeTab === "feed" && isFeedSelected ? "bg-accent-subtle/50 text-accent font-semibold" : "hover:bg-bg-tertiary text-text-secondary"
                        }`}
                      >
                        <span className="truncate flex items-center gap-1.5 max-w-[80%]">
                          {renderFeedIcon(feed.title, feed.siteUrl || feed.feedUrl)}
                          <span className="truncate">{feed.title}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {feedUnread > 0 && (
                            <span className="px-1.5 py-0.2 bg-bg-tertiary text-text-secondary text-[9px] font-semibold rounded-full group-hover:hidden border border-border-subtle">
                              {feedUnread}
                            </span>
                          )}
                          <Settings
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFeed(feed);
                            }}
                            className="h-3 w-3 text-text-tertiary hover:text-text-primary hidden group-hover:inline-block cursor-pointer transition-colors"
                          />
                          <Trash2
                            onClick={(e) => handleDeleteFeed(feed.feedUrl, e)}
                            className="h-3 w-3 text-text-tertiary hover:text-error hidden group-hover:inline-block cursor-pointer transition-colors"
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-3 border-t border-border shrink-0 text-[11px] text-text-tertiary flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-green-600 font-semibold px-1 py-0.5">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{feedHealth.error > 0 ? `${feedHealth.error} feeds have errors` : "All feeds healthy"}</span>
          </div>

          <button
            onClick={handleExportOpml}
            className="flex items-center gap-1.5 hover:text-text-primary text-left transition-colors font-medium cursor-pointer"
          >
            <Import className="h-3.5 w-3.5 rotate-180" />
            Export Subscriptions (OPML)
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-1.5 hover:text-text-primary text-left transition-colors font-medium"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Keyboard Shortcuts (?)
          </button>

          {/* Auth Sign Out Profile */}
          {isAuthenticated && session?.user && (
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-secondary truncate max-w-[70%] font-medium">
                Signed in: {session.user.name || session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-[10px] text-text-tertiary hover:text-error font-bold transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Content Area Pane (Sits to the right of the full-height sidebar) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-bg-primary overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface z-30">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Navigation Tabs (Feed, Digest, Discover) */}
            <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("feed")}
                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "feed" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveTab("digest")}
                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "digest" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Digest
              </button>
              <button
                onClick={() => setActiveTab("discover")}
                className={`px-4 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "discover" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Discover
              </button>
            </div>
          </div>

          {/* Search, Plus Add Feed, User Avatar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-[150px] sm:w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-tertiary" />
              <input
                id="search-bar"
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
              />
              <kbd className="absolute right-2 top-2 px-1 bg-bg-tertiary border border-border text-[9px] rounded text-text-tertiary select-none">
                /
              </kbd>
            </div>

            {/* Add Feed */}
            <button
              onClick={() => setIsAddFeedOpen(true)}
              title="Subscribe to Feed"
              className="p-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* User Profile avatar fallback */}
            <div className="shrink-0">
              {isAuthenticated && session?.user ? (
                session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="h-8 w-8 rounded-full object-cover border border-border"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {session.user.name ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U"}
                  </span>
                )
              ) : (
                <span className="h-8 w-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  MS
                </span>
              )}
            </div>

            {/* Three Dots More Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                title="More Actions"
                className="p-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMoreMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-md shadow-lg py-1 z-50 animate-slide-up text-xs">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        fetchBatchArticles(feeds);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-text-primary font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-text-tertiary" />
                      Refresh Feeds
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setActiveTab("feed");
                        setSelectedNav({ type: "saved" });
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-text-primary font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="h-3.5 w-3.5 text-text-tertiary" />
                      View Bookmarks
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleExportOpml();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-text-primary font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Import className="h-3.5 w-3.5 rotate-180 text-text-tertiary" />
                      Export OPML
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-text-primary font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Import className="h-3.5 w-3.5 text-text-tertiary" />
                      Import OPML
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowShortcuts(true);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-text-primary font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-text-tertiary" />
                      Keyboard Shortcuts
                    </button>
                    {isAuthenticated ? (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-error font-semibold border-t border-border mt-1 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5 text-error" />
                        Sign Out
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setShowMoreMenu(false)}
                        className="w-full text-left px-4 py-2 hover:bg-bg-secondary text-accent font-semibold border-t border-border mt-1 flex items-center gap-2"
                      >
                        <LogOut className="h-3.5 w-3.5 text-accent" />
                        Sign In
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Tab-based View Content Pane */}
        {activeTab === "feed" && (
          <>
            {/* Header Bar */}
            <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 gap-4 bg-surface">
              <div className="flex items-center gap-2.5">
                <h2 className="font-sans font-bold text-base md:text-lg tracking-tight truncate max-w-[200px] sm:max-w-[400px]">
                  {selectedNav.type === "all" && "All Items"}
                  {selectedNav.type === "saved" && "Saved Items"}
                  {selectedNav.type === "category" && selectedNav.value}
                  {selectedNav.type === "feed" && feeds.find((f) => f.feedUrl === selectedNav.value)?.title}
                </h2>
                <span className="text-xs text-text-tertiary font-medium">
                  {totalUnreadCount} unread
                </span>
              </div>

              {/* Actions Bar */}
              <div className="flex items-center gap-2">
                {/* Layout triggers */}
                <div className="border border-border rounded-md overflow-hidden bg-bg-secondary p-0.5 flex">
                  <button
                    onClick={() => setLayout("compact")}
                    className={`p-1 rounded-sm transition-colors ${
                      layout === "compact" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                    }`}
                    title="Compact layout"
                  >
                    <AlignJustify className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setLayout("standard")}
                    className={`p-1 rounded-sm transition-colors ${
                      layout === "standard" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                    }`}
                    title="List layout"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setLayout("cards")}
                    className={`p-1 rounded-sm transition-colors ${
                      layout === "cards" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                    }`}
                    title="Card Grid layout"
                  >
                    <Grid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setLayout("split")}
                    className={`p-1 rounded-sm transition-colors ${
                      layout === "split" ? "bg-bg-tertiary text-accent" : "text-text-tertiary hover:text-text-primary"
                    }`}
                    title="Split Reader layout"
                  >
                    <Layout className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Sorting */}
                <div className="text-xs font-semibold border border-border rounded-md px-2.5 py-1.5 bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer">
                  <span>Newest</span>
                  <ChevronLeft className="h-3.5 w-3.5 -rotate-90 text-text-tertiary" />
                </div>

                {/* Refresh */}
                <button
                  onClick={() => fetchBatchArticles(feeds)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 text-xs font-semibold px-2.5 py-1.5"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                {/* Mark all read */}
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 border border-border rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-xs font-semibold px-2.5"
                >
                  Mark all read
                </button>
              </div>
            </header>

            {/* Feeds Content Area Grid */}
            <div className="flex-1 overflow-hidden flex relative">
              <div className={`flex-1 overflow-y-auto p-6 flex flex-col gap-4 ${
                layout === "split" && activeItem ? "hidden lg:flex" : "flex"
              }`}>
                {newItemsCount > 0 && !loading && (
                  <div 
                    onClick={() => {
                      fetchBatchArticles(feeds);
                      setNewItemsCount(0);
                    }}
                    className="bg-accent-subtle hover:bg-accent-subtle/80 text-accent font-semibold text-xs py-2 px-4 rounded-md text-center cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 hover:scale-[1.005] animate-slide-up shadow-xs"
                  >
                    <span>↑</span>
                    <span>{newItemsCount} new items since your last visit</span>
                  </div>
                )}

                {loading ? (
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
                  <div className="flex flex-col gap-6 mx-auto w-full max-w-[60rem]">
                    <div className="text-[10px] font-bold tracking-wider text-text-tertiary uppercase border-b border-border pb-1">
                      Today
                    </div>

                    <div
                      className={`${
                        layout === "cards" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"
                      }`}
                    >
                      {filteredItems.slice(0, displayLimit).map((item, index) => {
                        const isRead = readIds.has(item.guid);
                        const isBookmarked = bookmarkedIds.has(item.guid);
                        const isSelected = index === selectedIndex;
                        
                        let relDate = "";
                        try {
                          relDate = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true });
                        } catch {
                          relDate = item.publishedAt;
                        }

                        if (layout === "compact") {
                          return (
                            <div
                              key={item.guid}
                              ref={(el) => { itemRefs.current[index] = el; }}
                              onClick={() => {
                                setActiveItem(item);
                                toggleRead(item, true);
                              }}
                              className={`group flex items-center gap-3 px-3 py-2 border-b border-border/50 hover:bg-bg-secondary cursor-pointer transition-colors ${
                                isSelected ? "bg-accent-subtle/30" : ""
                              } ${isRead ? "opacity-75" : ""}`}
                            >
                              <div className="flex-none flex items-center justify-center w-4 h-4">
                                {!isRead && <span className="h-2 w-2 rounded-full bg-accent" />}
                              </div>
                              <div className="flex-none opacity-80 scale-90">
                                {renderFeedIcon(item.feedTitle, item.feedUrl)}
                              </div>
                              <div className="flex-none w-24 md:w-32 truncate text-xs font-semibold text-text-tertiary">
                                {item.feedTitle}
                              </div>
                              <div className={`flex-1 truncate text-sm font-sans ${!isRead ? "font-bold text-text-primary" : "text-text-secondary"}`}>
                                {item.title}
                              </div>
                              <div className="flex-none text-[10px] md:text-[11px] text-text-tertiary tabular-nums whitespace-nowrap">
                                {new Date(item.publishedAt).toLocaleDateString()}
                              </div>
                              <button
                                onClick={(e) => toggleBookmark(item, e)}
                                className={`flex-none text-text-tertiary hover:text-accent ml-2 ${isBookmarked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              >
                                <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-accent text-accent" : ""}`} />
                              </button>
                            </div>
                          );
                        }

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

                        return (
                          <div
                            key={item.guid}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            onClick={() => {
                              setActiveItem(item);
                              toggleRead(item, true);
                            }}
                            className={`p-4 border rounded-lg bg-surface flex gap-4 cursor-pointer transition-colors relative ${
                              isSelected ? "ring-2 ring-accent border-transparent bg-accent-subtle/25" : "border-border hover:bg-bg-secondary"
                            } ${isRead ? "opacity-70" : ""}`}
                          >
                            <div className="flex flex-col items-center justify-start pt-1.5 shrink-0">
                              {!isRead ? (
                                <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
                              ) : (
                                <span className="h-2 w-2 shrink-0" />
                              )}
                            </div>

                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                              <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary">
                                {renderFeedIcon(item.feedTitle, item.feedUrl)}
                                <span className="truncate font-semibold text-text-primary" title={item.feedTitle}>
                                  {item.feedTitle}
                                </span>
                                <span>•</span>
                                <span>{relDate}</span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <h3 className={`font-sans font-bold text-base md:text-lg leading-snug tracking-tight text-text-primary hover:text-accent transition-colors ${!isRead ? "font-bold text-text-primary" : "font-semibold text-text-secondary"}`}>
                                  {item.title}
                                </h3>
                                <p className="font-sans text-sm text-text-secondary leading-relaxed line-clamp-2">
                                  {item.description}
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle/50">
                                <div>
                                  {item.feedTitle && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeClass(
                                      feeds.find(f => f.feedUrl === item.feedUrl)?.category || "Uncategorized"
                                    )}`}>
                                      {feeds.find(f => f.feedUrl === item.feedUrl)?.category || "Design"}
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={(e) => toggleBookmark(item, e)}
                                  className="text-text-tertiary hover:text-accent p-1"
                                >
                                  <Bookmark className={`h-4.5 w-4.5 ${isBookmarked ? "fill-accent text-accent" : ""}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {displayLimit < filteredItems.length && (
                      <div className="flex justify-center mt-8 mb-4">
                        <button
                          onClick={() => setDisplayLimit((prev) => prev + 50)}
                          className="px-6 py-2 bg-surface border border-border rounded-full text-xs font-semibold hover:bg-bg-secondary text-text-primary transition-colors shadow-sm"
                        >
                          Load More Articles
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Split view reader panel right side */}
              {layout === "split" && activeItem && (
                <div className="w-full lg:w-[28rem] xl:w-[35rem] border-l-0 lg:border-l border-border h-full flex flex-col bg-surface overflow-y-auto shrink-0 relative p-6 animate-slide-in">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button onClick={handlePrevArticle} className="text-text-tertiary hover:text-text-primary border border-border p-1 rounded-md" title="Previous Article (p)"><ChevronLeft className="h-4 w-4" /></button>
                    <button onClick={handleNextArticle} className="text-text-tertiary hover:text-text-primary border border-border p-1 rounded-md" title="Next Article (n)"><ChevronLeft className="h-4 w-4 rotate-180" /></button>
                    <button onClick={() => setActiveItem(null)} className="text-text-tertiary hover:text-text-primary border border-border p-1 rounded-md ml-2" title="Close"><X className="h-4 w-4" /></button>
                  </div>
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
                  {getArticleSummary(activeItem.content, activeItem.description) && (
                    <div className="mb-6 p-4 rounded-lg bg-bg-secondary border-l-4 border-accent text-xs flex flex-col gap-1.5 animate-slide-up shadow-sm">
                      <span className="font-sans font-bold uppercase tracking-wider text-accent text-[10px]">TL;DR Summary</span>
                      <p className="text-text-secondary font-sans leading-relaxed italic">
                        "{getArticleSummary(activeItem.content, activeItem.description)}"
                      </p>
                    </div>
                  )}
                  <article
                    className="font-serif text-base text-text-secondary leading-relaxed flex flex-col gap-4 overflow-x-hidden prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: activeItem.content || activeItem.description }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "digest" && (
          <>
            <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface">
              <h2 className="font-sans font-bold text-base md:text-lg tracking-tight">Daily Digest Briefing</h2>
            </header>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 w-full max-w-[60rem] mx-auto">
              <div className="p-6 bg-accent-subtle rounded-lg border border-accent/15 flex flex-col gap-2">
                <h3 className="font-sans font-bold text-lg text-accent flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Your Morning Briefing
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Welcome to your personalized summary. Below, find key analytics and hand-picked articles to jumpstart your day.
                </p>
              </div>

              {/* Analytics metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Subscribed Feeds</span>
                  <span className="text-2xl font-bold text-text-primary">{feeds.length}</span>
                </div>
                <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Bookmarks Saved</span>
                  <span className="text-2xl font-bold text-text-primary">{bookmarkedIds.size}</span>
                </div>
                <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Unread Articles</span>
                  <span className="text-2xl font-bold text-accent">{totalUnreadCount}</span>
                </div>
                <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Total Articles</span>
                  <span className="text-2xl font-bold text-text-primary">{items.length}</span>
                </div>
              </div>

              {/* Highlights feed section */}
              <div className="flex flex-col gap-3 mt-2">
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider border-b border-border pb-1">Top Daily Highlights</h4>
                <div className="flex flex-col gap-3">
                  {items.slice(0, 5).map((item) => (
                    <div 
                      key={item.guid}
                      onClick={() => {
                        setActiveItem(item);
                        toggleRead(item, true);
                      }}
                      className="p-4 border border-border rounded-lg bg-surface hover:bg-bg-secondary cursor-pointer transition-colors flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-text-tertiary">
                        {renderFeedIcon(item.feedTitle, item.feedUrl)}
                        <span className="font-semibold text-text-primary">{item.feedTitle}</span>
                        <span>•</span>
                        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                      </div>
                      <h5 className="font-sans font-bold text-sm text-text-primary hover:text-accent transition-colors leading-snug">
                        {item.title}
                      </h5>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "discover" && (
          <>
            <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface">
              <h2 className="font-sans font-bold text-base md:text-lg tracking-tight">Discover Feed Subscriptions</h2>
            </header>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 w-full max-w-[60rem] mx-auto">
              <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-2">
                <h3 className="font-sans font-bold text-sm">Explore Curated RSS Feeds</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Browse and instantly subscribe to these hand-picked tech, design, and programming feeds. Click the subscribe button to sync them directly to your dashboard.
                </p>
              </div>

              {/* Grid of recommended feeds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedFeeds.map((rec) => {
                  const isSubscribed = feeds.some((f) => f.feedUrl.toLowerCase() === rec.url.toLowerCase());
                  return (
                    <div key={rec.url} className="p-4 border border-border rounded-lg bg-surface flex flex-col justify-between gap-3 shadow-xs">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getCategoryBadgeClass(rec.category)}`}>
                            {rec.category}
                          </span>
                        </div>
                        <h4 className="font-sans font-bold text-sm text-text-primary">{rec.title}</h4>
                        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{rec.description}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-border-subtle/50 pt-2.5">
                        <span className="text-[10px] text-text-tertiary select-all font-mono truncate max-w-[60%]">{rec.url}</span>
                        {isSubscribed ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Subscribed
                            </span>
                            <button
                              onClick={(e) => {
                                const feedToDel = feeds.find((f) => f.feedUrl.toLowerCase() === rec.url.toLowerCase());
                                if (feedToDel) {
                                  handleDeleteFeed(feedToDel.feedUrl, e);
                                }
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-error bg-error/10 hover:bg-error hover:text-white rounded transition-all duration-200 cursor-pointer"
                            >
                              Unsubscribe
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => subscribeToRecommended(rec.url, rec.category)}
                            className="px-3 py-1 bg-accent text-white text-[11px] font-semibold rounded hover:bg-accent-hover transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm"
                          >
                            + Subscribe
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Reader Modal popup Overlay for standard/compact/card views */}
      {layout !== "split" && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-[45rem] h-full flex flex-col shadow-2xl relative p-6 md:p-8 overflow-y-auto animate-slide-in">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button onClick={handlePrevArticle} className="text-text-tertiary hover:text-text-primary border border-border p-1.5 rounded-md hover:bg-bg-secondary transition-colors" title="Previous Article (p)"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={handleNextArticle} className="text-text-tertiary hover:text-text-primary border border-border p-1.5 rounded-md hover:bg-bg-secondary transition-colors" title="Next Article (n)"><ChevronLeft className="h-4 w-4 rotate-180" /></button>
              <button onClick={() => setActiveItem(null)} className="text-text-tertiary hover:text-text-primary border border-border p-1.5 rounded-md hover:bg-bg-secondary transition-colors ml-2" title="Close"><X className="h-4 w-4" /></button>
            </div>
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

            {getArticleSummary(activeItem.content, activeItem.description) && (
              <div className="mb-6 p-5 rounded-lg bg-bg-secondary border-l-4 border-accent text-sm flex flex-col gap-1.5 animate-slide-up shadow-sm">
                <span className="font-sans font-bold uppercase tracking-wider text-accent text-[11px]">TL;DR Summary</span>
                <p className="text-text-secondary font-sans leading-relaxed italic">
                  "{getArticleSummary(activeItem.content, activeItem.description)}"
                </p>
              </div>
            )}

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

      {/* Edit Category dialog modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Edit Category</h3>
            <form onSubmit={handleEditCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Category Name</label>
                <input
                  type="text"
                  required
                  value={editingCategory.newName}
                  onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                />
              </div>
              <div className="flex justify-between mt-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(editingCategory.oldName)}
                  className="px-3 py-2 text-xs font-semibold text-error hover:bg-error/10 rounded-md transition-colors"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="px-3 py-2 text-xs font-semibold hover:bg-bg-secondary rounded-md border border-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold bg-accent text-white hover:bg-accent-hover rounded-md transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Feed dialog modal */}
      {editingFeed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Edit Feed</h3>
            <form onSubmit={handleEditFeed} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Feed Title</label>
                <input
                  type="text"
                  required
                  value={editingFeed.title}
                  onChange={(e) => setEditingFeed({ ...editingFeed, title: e.target.value })}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Category</label>
                <select
                  value={editingFeed.category}
                  onChange={(e) => setEditingFeed({ ...editingFeed, category: e.target.value })}
                  className="px-3 py-2 text-xs rounded-md bg-bg-secondary border border-border focus:border-accent outline-none font-sans"
                >
                  <option value="Uncategorized">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setEditingFeed(null)}
                  className="px-3 py-2 text-xs font-semibold hover:bg-bg-secondary rounded-md border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold bg-accent text-white hover:bg-accent-hover rounded-md transition-colors"
                >
                  Save
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
