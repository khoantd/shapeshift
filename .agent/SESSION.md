# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-27 |
| **Phase** | build |
| **Tool** | cursor |
| **Persona** | _(optional)_ |

## Goal

Waitlist landing at `/` (Convex) + live demo at `/demo`; prior news/IC work remains. Stats tab on `/news` for Jev briefs + intent morphing.

## Done

- **Deep Dive citation sources fix** — empty `sources` left raw `[web:N]` in prod; harden `extractDeepDiveSources` (ids + `fetch_url_results`); 0-based/`id` resolve in `webCitations`; skip incomplete DB/LRU cache; client auto-heals once with force regenerate
- **Waitlist hydration fix** — `MotionConfig reducedMotion="user"` + stable fadeUp (no `useReducedMotion` SSR branch); `SignupForm` uses `useId()`; count `toLocaleString("en-US")`
- **`/news` Stats tab** — Feed|Stats (`?view=stats`); KPIs, tone mix, top ranked from Jev briefs; Score unscored (≤10, concurrency 2); intent morphing section from demo localStorage ring
- **Waitlist landing** — Aver-inspired page at `/` (`WaitlistLanding`, `SignupForm`, `ProductPreview`); Shapeshift copy + existing brand tokens; `motion/react` + reduced-motion
- **Demo route** — `/demo` mounts `ShapeshiftApp` + `SiteChrome`; SiteChrome Home link; not-found → home/demo
- **Convex waitlist** — `apps/web/convex` schema + `joinWaitlist` / `waitlistCount`; `NEXT_PUBLIC_CONVEX_URL`; stubs in `_generated` until `bunx convex dev`
- `bun run check` green (318 tests)
- **`/source` palette = full IC catalog** — `listCxoFeedSources` / `listCxoFeed` returns `ba_cxo_feed_sources`; `/api/news` + SSR pass `sources`; client `buildNewsSourceOptions` unions catalog + item names
- **Source-scoped feed fetch** — `?source=` resolves to `source_id` and queries that source’s timeline (not client-filter of global top 50); Clear / slash confirm refetch
- **Mark as read** — opening reader PATCHes `{ id, read: true }` to IC `is_read`; reader has Mark unread/read toggle; mirrors pin pattern
- Bun workspaces: `apps/web`, `packages/core`, `packages/react`
- Core: decide/signals/parse/jev + `createIntentHandler` (`@shapeshift/core/server`)
- React: shell, cards, hooks, styles; `classify` DI + `StorageAdapter`
- Demo host wires `createFetchClassify` / mock via env
- **`news` intent** — INTENT_KEYS, questions, `parse/news`, mock scores, NewsCard + NewsFeedItemCard, registry
- **`/news` page** — server-loads CXO feed via Inspired Canvas JWT; client filter + critical-only sort
- **BFF** — `GET /api/news` + `apps/web/src/lib/inspired-canvas/client.ts`
- `/news` detail CardView — click opens Dialog (thumb, title, summary, keyword highlights); list uses Supabase for thumbnails
- Live `/news` via minted `INSPIRED_CANVAS_ACCESS_TOKEN` (IC user with feeds)
- **`/source + keywords` on `/news`** — `parseNewsSlash`, `NewsSourcePalette`, `NewsIntentConfirm` (CardView); confirm applies `q`/`source`/`critical` URL filters
- News detail Highlights = matched snippet sentences only (`extractNewsHighlightSnippets`); hide when empty
- **In-app reader pane** — View in detail dialog opens master-detail split (`NewsReaderPane`); list stays left; mobile full-screen overlay; Open original keeps external link
- **Jev news brief (option 2)** — `POST /api/news/brief` via `createNewsBriefHandler`; reader shows urgency/relevance/tone chips + composed line; cache soft-ranks list + badges; mock offline path; lint-safe async setState after `Promise.resolve()`
- **Deep Dive (Perplexity Agent API)** — on-demand section in reader; `POST /api/news/deep-dive`; preset `low` + `web_search`/`fetch_url`; persists to IC `ba_cxo_feed_items.deep_dive`; hydrate on feed load; Regenerate force-refresh
- **Jev Brief persist** — `POST /api/news/brief` writes IC `ba_cxo_feed_items.brief`; hydrate from feed; skip Jev when query matches stored
- **Reader pane micro-animations** — open/close slide+fade, story-body crossfade (`item.id`), Brief/Deep Dive soft reveal + loading spinners; `useReducedMotion`; host keeps split layout until `onExitComplete`
- **Inline Deep Dive citations** — `[web:N]` clusters → stacked favicon chip + “N sources”; click opens Popover source list (`CitationSourcesChip` via `MarkdownBody` + `webCitations`)

## In progress

- _(none)_

## Next

1. Deploy citation-sources fix to Vercel; open Graphify deep dive — should auto-regen sources once (or click Regenerate)
2. From `apps/web`: `bunx convex dev` → set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` → smoke-test waitlist join
3. Add `NEXT_PUBLIC_CONVEX_URL` on Vercel; Root Directory = `apps/web`
4. Apply IC migrations in Supabase SQL Editor: `20260926120000_cxo_feed_deep_dive.sql` + `20260926130000_cxo_feed_brief.sql`
5. Set `PERPLEXITY_API_KEY` in `apps/web/.env` and smoke-test Generate Deep Dive (confirm `persisted: true` + non-empty `sources`)
6. Optional: IC Supabase Auth UI instead of env JWT / password mint
7. Smoke-test `/news?view=stats` + Score unscored; use `/demo` then Stats for intent section

## Decisions

- Full morphing SDK (not cards-only); internal monorepo first (not public npm)
- Classify injected by host; omit → offline mock
- Server Jev stays behind `@shapeshift/core/server` (`server-only`)
- SiteChrome stays in `apps/web` (Next `fetch` revalidate)
- News uses CXO curated feed only (not Tavily market-intel); auth mirrors IC `authenticateBearer` + StratAI: Bearer → `ACCESS_TOKEN` → email/password mint against IC Supabase
- News slash confirm (1A/2A): palette pick → News CardView popup → confirm filters; story click stays `NewsDetailCard`
- News View → in-app reader pane (not iframe of `canonicalUrl`); Open original for external tab
- Jev on news = structured brief scores only (urgency/relevance/tone), not freeform summary; feed source remains IC CXO
- Deep Dive = on-demand Perplexity Agent (`preset: "low"`), not auto-fetch; Perplexity stays in `apps/web` (not core)
- Reader motion uses package `motion/react` + `spring`/`tween` tokens; `NewsReaderPane` owns `AnimatePresence` (accepts `item: null`) so web host need not depend on `motion`
- **Landing = waitlist at `/`, demo at `/demo`**; Convex waitlist only (no Convex Auth); keep Shapeshift tokens (not Aver Inter/purple AI palette)
- **Stats = tab on `/news`** (not `/dashboard`); news briefs first; intent stats from demo localStorage (no Convex)

## Gotchas

- Env lives at `apps/web/.env` (Next loads it; `.env.local` also works); `next.config` also loads root `.env` as fallback
- Tailwind host must `@source` the react package path
- `bun run check` from repo root
- IC JWT must be for Inspired Canvas Supabase (`yshqwmldepsfckiacjwu`), not StratAI — copy `VITE_SUPABASE_*` from inspired-canvas into `INSPIRED_CANVAS_SUPABASE_*`
- Prefer `INSPIRED_CANVAS_EMAIL` + `INSPIRED_CANVAS_PASSWORD` over a pasted ACCESS_TOKEN — tokens expire ~1h; auth now skips expired ACCESS_TOKEN and mints via password
- Slash `/source` palette uses full IC catalog from `ba_cxo_feed_sources`; picking a source refetches via `GET /api/news?source=` (Supabase `source_id` filter). Empty after that means the source truly has no ingested items (or IC fetch failed)
- News detail Highlights = matched excerpt sentences only (hidden when none); Summary stays full excerpt
- Dialog overlay uses static `backdrop-blur-sm` (no exit anim — avoids Presence linger)
- IC feed maps `canonical_url` → `canonicalUrl`; detail dialog CTA labeled **View** opens in-app reader when host passes `onView`
- News list: denser rows, first 10 visible, **Load more** for the rest (client window)
- News page **Refresh** re-fetches via `GET /api/news` (keeps list while loading)
- Pin for later: list + detail + reader Pin; `PATCH /api/news` + localStorage override
- News page splits **Pinned for later** vs feed; Load more only on unpinned feed
- Reader: Escape / X closes; list click opens in-app reader pane (master-detail); mobile full-screen overlay
- News feed column must not use `w-full` + `shrink-0` in the split layout (it zeroed the reader pane)
- Brief fetch: do not `setState` synchronously in `useEffect` — yield with `await Promise.resolve()` then set loading; use `briefCacheRef` so cache hits skip refetch without dep thrash
- Deep Dive needs `PERPLEXITY_API_KEY`; without it the BFF returns 503 with setup message (never log the key)
- Deep Dive persist: apply IC migration `20260926120000_cxo_feed_deep_dive.sql` (column `ba_cxo_feed_items.deep_dive` jsonb) before store works; Regenerate uses `force: true`
- Deep Dive sources: UI hides Sources + leaves raw `[web:N]` when `sources=[]`; incomplete rows (cites, no sources) are not served from DB/LRU cache and auto-heal once on reader open
- Reader close: keep `readerShellOpen` until `onExitComplete` so split layout does not collapse mid-exit; guard reopen race with `readerIdRef`
- Stats Score unscored: max 10, concurrency 2; does not auto-brief entire feed on load
- Intent stats key `shapeshift:intent-stats:v1` — no raw input text stored

## Pointers

| Item | Location |
|------|----------|
| Spec | News Stats Dashboard plan |
| Tasks | `tasks/todo.md` |
| Branch | `main` |
| Key files | `apps/web/src/components/NewsStatsPanel.tsx`, `apps/web/src/lib/newsStats.ts`, `apps/web/src/lib/intentStats.ts`, `apps/web/src/components/NewsPageClient.tsx` |

## Done

- **Waitlist landing** — Aver-inspired page at `/` (`WaitlistLanding`, `SignupForm`, `ProductPreview`); Shapeshift copy + existing brand tokens; `motion/react` + reduced-motion
- **Demo route** — `/demo` mounts `ShapeshiftApp` + `SiteChrome`; SiteChrome Home link; not-found → home/demo
- **Convex waitlist** — `apps/web/convex` schema + `joinWaitlist` / `waitlistCount`; `NEXT_PUBLIC_CONVEX_URL`; stubs in `_generated` until `bunx convex dev`
- `bun run check` green (302 tests)
- **`/source` palette = full IC catalog** — `listCxoFeedSources` / `listCxoFeed` returns `ba_cxo_feed_sources`; `/api/news` + SSR pass `sources`; client `buildNewsSourceOptions` unions catalog + item names
- **Source-scoped feed fetch** — `?source=` resolves to `source_id` and queries that source’s timeline (not client-filter of global top 50); Clear / slash confirm refetch
- **Mark as read** — opening reader PATCHes `{ id, read: true }` to IC `is_read`; reader has Mark unread/read toggle; mirrors pin pattern
- Bun workspaces: `apps/web`, `packages/core`, `packages/react`
- Core: decide/signals/parse/jev + `createIntentHandler` (`@shapeshift/core/server`)
- React: shell, cards, hooks, styles; `classify` DI + `StorageAdapter`
- Demo host wires `createFetchClassify` / mock via env
- **`news` intent** — INTENT_KEYS, questions, `parse/news`, mock scores, NewsCard + NewsFeedItemCard, registry
- **`/news` page** — server-loads CXO feed via Inspired Canvas JWT; client filter + critical-only sort
- **BFF** — `GET /api/news` + `apps/web/src/lib/inspired-canvas/client.ts`
- `/news` detail CardView — click opens Dialog (thumb, title, summary, keyword highlights); list uses Supabase for thumbnails
- Live `/news` via minted `INSPIRED_CANVAS_ACCESS_TOKEN` (IC user with feeds)
- **`/source + keywords` on `/news`** — `parseNewsSlash`, `NewsSourcePalette`, `NewsIntentConfirm` (CardView); confirm applies `q`/`source`/`critical` URL filters
- News detail Highlights = matched snippet sentences only (`extractNewsHighlightSnippets`); hide when empty
- **In-app reader pane** — View in detail dialog opens master-detail split (`NewsReaderPane`); list stays left; mobile full-screen overlay; Open original keeps external link
- **Jev news brief (option 2)** — `POST /api/news/brief` via `createNewsBriefHandler`; reader shows urgency/relevance/tone chips + composed line; cache soft-ranks list + badges; mock offline path; lint-safe async setState after `Promise.resolve()`
- **Deep Dive (Perplexity Agent API)** — on-demand section in reader; `POST /api/news/deep-dive`; preset `low` + `web_search`/`fetch_url`; persists to IC `ba_cxo_feed_items.deep_dive`; hydrate on feed load; Regenerate force-refresh
- **Jev Brief persist** — `POST /api/news/brief` writes IC `ba_cxo_feed_items.brief`; hydrate from feed; skip Jev when query matches stored
- **Reader pane micro-animations** — open/close slide+fade, story-body crossfade (`item.id`), Brief/Deep Dive soft reveal + loading spinners; `useReducedMotion`; host keeps split layout until `onExitComplete`
- **Inline Deep Dive citations** — `[web:N]` clusters → stacked favicon chip + “N sources”; click opens Popover source list (`CitationSourcesChip` via `MarkdownBody` + `webCitations`)

## In progress

- _(none)_

## Next

1. Deploy citation-sources fix to Vercel; open Graphify deep dive — should auto-regen sources once (or click Regenerate)
2. From `apps/web`: `bunx convex dev` → set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` → smoke-test waitlist join
3. Add `NEXT_PUBLIC_CONVEX_URL` on Vercel; Root Directory = `apps/web`
4. Apply IC migrations in Supabase SQL Editor: `20260926120000_cxo_feed_deep_dive.sql` + `20260926130000_cxo_feed_brief.sql`
5. Set `PERPLEXITY_API_KEY` in `apps/web/.env` and smoke-test Generate Deep Dive (confirm `persisted: true` + non-empty `sources`)
6. Optional: IC Supabase Auth UI instead of env JWT / password mint
7. Smoke-test `/news?view=stats` + Score unscored; use `/demo` then Stats for intent section

## Decisions

- Full morphing SDK (not cards-only); internal monorepo first (not public npm)
- Classify injected by host; omit → offline mock
- Server Jev stays behind `@shapeshift/core/server` (`server-only`)
- SiteChrome stays in `apps/web` (Next `fetch` revalidate)
- News uses CXO curated feed only (not Tavily market-intel); auth mirrors IC `authenticateBearer` + StratAI: Bearer → `ACCESS_TOKEN` → email/password mint against IC Supabase
- News slash confirm (1A/2A): palette pick → News CardView popup → confirm filters; story click stays `NewsDetailCard`
- News View → in-app reader pane (not iframe of `canonicalUrl`); Open original for external tab
- Jev on news = structured brief scores only (urgency/relevance/tone), not freeform summary; feed source remains IC CXO
- Deep Dive = on-demand Perplexity Agent (`preset: "low"`), not auto-fetch; Perplexity stays in `apps/web` (not core)
- Reader motion uses package `motion/react` + `spring`/`tween` tokens; `NewsReaderPane` owns `AnimatePresence` (accepts `item: null`) so web host need not depend on `motion`
- **Landing = waitlist at `/`, demo at `/demo`**; Convex waitlist only (no Convex Auth); keep Shapeshift tokens (not Aver Inter/purple AI palette)
- **Stats = tab on `/news`** (not `/dashboard`); news briefs first; intent stats from demo localStorage (no Convex)

## Gotchas

- Env lives at `apps/web/.env` (Next loads it; `.env.local` also works); `next.config` also loads root `.env` as fallback
- Tailwind host must `@source` the react package path
- `bun run check` from repo root
- IC JWT must be for Inspired Canvas Supabase (`yshqwmldepsfckiacjwu`), not StratAI — copy `VITE_SUPABASE_*` from inspired-canvas into `INSPIRED_CANVAS_SUPABASE_*`
- Prefer `INSPIRED_CANVAS_EMAIL` + `INSPIRED_CANVAS_PASSWORD` over a pasted ACCESS_TOKEN — tokens expire ~1h; auth now skips expired ACCESS_TOKEN and mints via password
- Slash `/source` palette uses full IC catalog from `ba_cxo_feed_sources`; picking a source refetches via `GET /api/news?source=` (Supabase `source_id` filter). Empty after that means the source truly has no ingested items (or IC fetch failed)
- News detail Highlights = matched excerpt sentences only (hidden when none); Summary stays full excerpt
- Dialog overlay uses static `backdrop-blur-sm` (no exit anim — avoids Presence linger)
- IC feed maps `canonical_url` → `canonicalUrl`; detail dialog CTA labeled **View** opens in-app reader when host passes `onView`
- News list: denser rows, first 10 visible, **Load more** for the rest (client window)
- News page **Refresh** re-fetches via `GET /api/news` (keeps list while loading)
- Pin for later: list + detail + reader Pin; `PATCH /api/news` + localStorage override
- News page splits **Pinned for later** vs feed; Load more only on unpinned feed
- Reader: Escape / X closes; list click opens in-app reader pane (master-detail); mobile full-screen overlay
- News feed column must not use `w-full` + `shrink-0` in the split layout (it zeroed the reader pane)
- Brief fetch: do not `setState` synchronously in `useEffect` — yield with `await Promise.resolve()` then set loading; use `briefCacheRef` so cache hits skip refetch without dep thrash
- Deep Dive needs `PERPLEXITY_API_KEY`; without it the BFF returns 503 with setup message (never log the key)
- Deep Dive persist: apply IC migration `20260926120000_cxo_feed_deep_dive.sql` (column `ba_cxo_feed_items.deep_dive` jsonb) before store works; Regenerate uses `force: true`
- Deep Dive sources: UI hides Sources + leaves raw `[web:N]` when `sources=[]`; incomplete rows (cites, no sources) are not served from DB/LRU cache and auto-heal once on reader open
- Reader close: keep `readerShellOpen` until `onExitComplete` so split layout does not collapse mid-exit; guard reopen race with `readerIdRef`
- Stats Score unscored: max 10, concurrency 2; does not auto-brief entire feed on load
- Intent stats key `shapeshift:intent-stats:v1` — no raw input text stored

## Pointers

| Item | Location |
|------|----------|
| Spec | News Stats Dashboard plan |
| Tasks | `tasks/todo.md` |
| Branch | `main` |
| Key files | `apps/web/src/components/NewsStatsPanel.tsx`, `apps/web/src/lib/newsStats.ts`, `apps/web/src/lib/intentStats.ts`, `apps/web/src/components/NewsPageClient.tsx` |
