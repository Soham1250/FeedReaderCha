# Frontpage Project Plan

This document maps out the phase-wise implementation of the Frontpage customizable content aggregator. It divides the work into sequential milestones, highlighting specifically **what to do** and **what not to do** in each phase.

---

## Phase 1: Tech Stack Setup & Foundation
*Goal: Initialize the repository, configure standard dependencies, and build a unified design tokens stylesheet.*

### What to Do:
- **Initialize Next.js & TypeScript**: Scaffold a Next.js App Router project in the root directory.
- **Configure Tailwind CSS v4 & custom tokens**: Link `starter/tokens.css` inside `starter/tailwind.css` and import it into global styles.
- **Install Core Packages**: Install necessary packages (`lucide-react`, `rss-parser`, `he` for HTML entities decoding, `isomorphic-dompurify` for HTML sanitization).
- **Define Layout Layout Shell**: Create the navigation shell containing a responsive sidebar, a main header, and content areas conforming to `--sidebar-width` and `--page-max-width`.

### What NOT to Do:
- **Do NOT use CSS framework utility classes** that override or ignore the brand kit custom tokens (`--color-bg-primary`, `--color-text-secondary`, etc.).
- **Do NOT implement database storage** or complex state management. Keep the UI shells mock-based in this phase.

---

## Phase 2: Database Schema & Auth Setup
*Goal: Setup persistent storage structure and secure user accounts.*

### What to Do:
- **Design MongoDB Collections**: Create collection structures for `users` (credentials and preferences), `categories`, `feeds`, `items`, `bookmarks`, and `readStates`.
- **Deduplication Indexes**: Set up compound unique indexes on `{ feedId: 1, guid: 1 }` and `{ feedId: 1, link: 1 }` in MongoDB to prevent duplicate items.
- **Implement Auth Flow**: Setup NextAuth.js configured with GitHub and Google OAuth providers, integrated with MongoDB Adapter to automatically handle session management and user document storage.
- **Route Protection**: Setup middleware to redirect unauthenticated users away from private dashboard paths unless in Guest Mode.

### What NOT to Do:
- **Do NOT query all articles from the database** at once. Utilize MongoDB compound indexes and pagination boundaries (e.g. `limit` and `skip` or cursor-based pagination) to keep responses rapid.
- **Do NOT persist guest session data in the database**. Guest configurations and states must live client-side only (session storage or client memory).

---

## Phase 3: Server-side Feed Ingestion & Parsing
*Goal: Solve CORS limitations and parse raw XML feeds reliably.*

### What to Do:
- **Build API Feed Route**: Setup `api/feeds/fetch` in Next.js to fetch feeds server-side.
- **Resilient date & XML normalizer**: Parse multiple date formats (RFC 822, ISO 8601) and normalize differing Atom/RSS tag naming conventions (e.g., `<entry>` vs. `<item>`).
- **Implement Feed Health Tracking**: Write update functions that store last successful fetch time, status (active/stale/error), and feed favicons.
- **Sanitize HTML Content**: Use `isomorphic-dompurify` on the parsed content before returning it to protect readers from XSS injections.

### What NOT to Do:
- **Do NOT attempt to fetch RSS XML feeds directly in client-side components**, which will result in CORS failures.
- **Do NOT let a slow or broken feed** block the fetching of other feeds. Ensure each feed fetch runs asynchronously with a strict 10-second timeout.

---

## Phase 4: Landing Page & Guest Experience
*Goal: Create the visitor's gateway and the seed-based Guest Mode.*

### What to Do:
- **Build Premium Landing Page**: Create an impressive landing page detailing product value, core features, and prominent dual CTAs ("Sign Up" & "Try as Guest").
- **Implement Guest Dashboard Seeding**: Set up a special guest router context. When "Try as Guest" is clicked, load the pre-configured 19 feeds from `data/sample-feeds.json`.
- **In-Memory Feed Storage**: In guest mode, fetch articles on demand and store layout states, categories, and read status markers in React state / `sessionStorage`.
- **Call-to-Action Banner**: Show a non-intrusive prompt at the top/bottom of the guest dashboard explaining what features (like cross-device sync and customized subscriptions) are unlocked with a real account.

### What NOT to Do:
- **Do NOT force a guest user to register** to see bookmarks or search functions. Let them try all core client-side functions immediately.
- **Do NOT load heavy images** for landing page previews. Keep visual assets optimized.

---

## Phase 5: Content Dashboard & Layout Customization
*Goal: Create the reading center of gravity with multiple layout choices.*

### What to Do:
- **Sidebar Categories**: Display user categories with dynamic, responsive unread counts updated optimistically when articles are marked read.
- **Category Drag-and-Drop / Reordering**: Add manual category sorting/reordering options.
- **Support Layout Views**: Create toggles for the 4 key layouts:
  1. **Compact list**: High scannability, title and short source meta.
  2. **Standard list**: Comfortable margins, excerpt summary.
  3. **Card grid**: Magazine-style cards with image previews.
  4. **Split pane**: Interactive master-detail layout (left feed list, right reader panel).
- **Graceful missing image handling**: Render custom placeholder SVG components when a feed item has no media inside the card/grid layout.

### What NOT to Do:
- **Do NOT lose layout choices when switching categories**. Keep layout settings synchronized in user preferences (or session state for guests).
- **Do NOT render full HTML markup in feed list excerpts**; strip out tags and show text-only snippets.

---

## Phase 6: Search, Bookmarks & Keyboard Navigation
*Goal: Build power-user tools and deep accessibility hooks.*

### What to Do:
- **Full-Text Search API**: Implement fast MongoDB text indexing/searching (using `$text` index) on feed item titles and description bodies. Highlight matched terms in the UI.
- **Saved / Read Later List**: Allow bookmarking from lists or reader views. Show a dedicated "Saved" section.
- **Accessibility shortcuts (Keyboard controls)**:
  - `j` / `k` to move selection highlight up and down.
  - `o` or `Enter` to open an article in reader view.
  - `s` to bookmark the highlighted article.
  - `m` to toggle read/unread state.
  - `/` to focus the search bar.
  - `?` to open a helper overlay detailing the keyboard shortcuts.
- **Screen Reader Announcements**: Configure ARIA live regions for feed state updates (e.g. "Refreshing feeds...", "Feed refresh complete").

### What NOT to Do:
- **Do NOT intercept standard browser shortcuts** (like Ctrl+P, Ctrl+T) with custom keyboard commands.
- **Do NOT rely solely on color** to indicate unread status. Use a combination of weight (bold titles), color (accent blue dot), and ARIA labels.

---

## Phase 7: OPML Import/Export & Polishing
*Goal: Integrate standard portability formats, polish animations, and deploy.*

### What to Do:
- **Build OPML Parser**: Accept `.opml` uploads, flattening deeply nested category structures, resolving lowercase attribute discrepancies (e.g., `xmlurl` vs `xmlUrl`), and skipping existing duplicates.
- **Export Subscriptions**: Generate an OPML file of current user feeds preserving the category hierarchy.
- **Auto-Refresh & Polling**: Support configuring automatic refresh intervals (15m, 30m, 1h, or manual) using server background sync or client polling with Last-Modified headers.
- **Add Micro-Animations**: Use subtle transitions on hover, layout switching, and read status markers.
- **Run Lighthouse Audits**: Verify initial load under 3s and Lighthouse scores exceed Performance > 85, Accessibility > 90, Best Practices > 90.
- **Deploy to Production**: Deploy to Vercel/Netlify with https, configuring all database variables.

### What NOT to Do:
- **Do NOT allow invalid or defunct feeds** in OPML imports to crash the import flow. Skip them, log the failure, and return a report summary (e.g. "18 imported, 1 failed").
- **Do NOT deploy with debug variables** or console logs. Clean up development statements before shipping.
