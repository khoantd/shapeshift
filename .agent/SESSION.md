# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-14 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

Ship Meanbox Firefox extension MVP (repo lens + YouTube study companion) on top of existing BFF APIs — plus Phase 2 tools, in-sidebar news/lesson deep dive, and Quick Gadgets. Web: RTCFC/BCMT Structure AI.

## Done

- **RTCFC + BCMT Structure (explicit AI):** `POST /api/rtcfc/structure` + `/api/bcmt/structure` (Perplexity; mock when `NEXT_PUBLIC_USE_MOCK`); Structure button on both cards; auto-roll skips when unlabeled shell text present; core helpers `*SourceBody` / `normalize*Fields`
- Learning pack upsert (one per user+video) + list dedupe; GET `learning-packs?videoId=`; web auto-restore Pack tab; extension `loadYouTube` shows Pack loaded
- Firefox extension learning-pack → Convex save: `cookies` permission + `X-Meanbox-Cookie` bridge; BFF `oauthSessionCookies` merge; sidebar shows saved / saveError
- Dual-mode `/github` search (prior)
- Phase 1: diagram + explainer + Mermaid (+ Remotion video)
- Phase 2 YouTube↔GitHub bridge
- Prod env synced: `OPENAI_API_KEY`, `MINIO_*` (7 vars) on Vercel production
- Remotion fix: build-time `.remotion` + Sandbox (no runtime `@remotion/bundler`)
- Sandbox mkdir 400 fixed: empty `publicDir` + strip `.remotion/public`; pre-`mkDir("remotion-bundle")`
- Vercel production deploy `dpl_Gq35JBpASChbAoGKdkZLiq6NS6N2` (READY) — aliased https://meanbox.vercel.app (pack upsert + restore + cookie bridge)
- Read-only GitHub repository security advisories: lib + `/api/github/advisories` (+ `[ghsaId]`) + Security section on repo detail summary
- Firefox extension MVP under `apps/firefox-extension` — sidebar repo lens + YouTube study, popup search, omnibox `mb`, context menus, options (API base/locale), content chip; unit tests + `web-ext lint` clean
- Sidebar UX cleanup (Mobbin): exclusive context card, Overview/Related tabs, sanitized related rows, ISO duration format, loadId race guard
- **Phase 2 extension (v1.1.0):** gadgets sidebar launcher + `/gadgets?q=` seed (web Shapeshift), news clipper (selection/page), places from selection; omnibox `g:` / `news:` / `places:`; popup targets; `lib/paths.js` + tests; `web-ext lint` clean (34 tests)
- **Phase 2.1 extension (v1.2.0):** in-sidebar deep dive replaces News → Meanbox tab open; `lib/article.js` heuristics + `scripting.executeScript`; menus/popup/omnibox `news:`; Options grant includes `https://*/*`
- **Phase 2.2 (v1.2.1):** `[hidden]` CSS fix; removed duplicate launch-links / popup Sidebar actions; article single CTA; `POST /api/news/clip` + deep-dive with `id` persist; Open in Meanbox → `/news?story=`; 46 ext tests + newsClip tests + web-ext lint clean
- **Phase 2.3 extension (v1.3.0):** in-sidebar Quick Gadgets (tip / split / convert / timer) via `lib/gadgets.js`; chips + selection/popup/omnibox prefer sidebar; non-quick still → `/gadgets?q=`; timer Start/Pause/Reset; 57 ext tests + web-ext lint clean
- **Phase 2.4 extension (v1.3.1):** RTCFC Quick Gadget — labeled parse + roll samples locally; freeform → `POST /api/rtcfc/structure`; Copy / Roll again / Structure in sidebar; 63 ext tests + web-ext lint clean
- **Gadgets Saved UX:** `RecentStack` search (summary / label / text) + Load more (page size 5); helpers in `filterSavedItems.ts` (+ tests)

## In progress

- None

## Done (this session — iOS build)

- Fixed Meanbox iOS: `CODE_SIGN_STYLE=Automatic` + Podfile quote fix for path-with-spaces (`EXConstants` app.config script); cleared DerivedData + `pod install`; **simulator build succeeded**. Physical device still needs Developer Mode enabled on KhoaDue’s iPhone.
- Mobile default install → **Release** (`ios` script); prod API `https://meanbox.vercel.app`
- **Mobile sign-in fix:** BFF `GET /api/youtube/oauth/mobile-bridge` → `meanbox://oauth?bridge=…`; app stores bridge + sends `X-Meanbox-Cookie` (Firefox parity). **Deploy web** before prod sign-in works.

## Done (this session — mobile BFF)

- **Mobile BFF wiring:** `lib/api` + settings (AsyncStorage) + SettingsProvider; News feed/`deep-dive` stack; Study search → pack generate; Ask `/api/intent` routing + local recent; Tools gadgets via core parsers + RTCFC structure; More API base/locale + OAuth browser; 24 unit tests + typecheck green
- **Expo SDK 57:** `@shapeshift/mobile` → `expo@~57.0.0` (57.0.28) + RN 0.86.3 / React 19.2.3; root RN overrides updated; tab icon ColorValue fix; tests + typecheck green

## Done (this session)

- **Mobile design system:** `design-system/mobile/MASTER.md` + `tokens.json` (extends web CSS, not clay/indigo); `@shapeshift/mobile` theme stub (`MeanboxThemeProvider`, tokens, 3 sync tests); root `test` includes `apps/mobile`
- **Firefox sidebar BrandSurface:** `brand/main.jpg` + light scrim (medium) + light Meanbox tokens in `shared.css`; `sidebar.html` wraps content like webapp `BrandSurface` tone=sidebar; packed **v1.3.8** (`meanbox-1.3.8.zip` + `-source.zip`, web-ext lint clean)
- **Chrome sidebar BrandSurface parity:** same backdrop markup + light tokens + translucent cards/chips; `brand/main.jpg` copied; `pack.sh` includes `brand/`; packed **v1.3.8** (`dist/meanbox-1.3.8.zip`)

- **News Summary prose:** `splitProseParagraphs` + paragraph UI in `NewsReaderPane` / `NewsDetailCard` (relaxed leading, stronger contrast); 7 unit tests green
- **Deep dive page grab:** on Deep dive click, always `extract-active-article` with `force: true`; `gatherPageFieldsInTab` collects `mainText` (article/main/role=main/fallbacks); `buildForcedArticleContext` + `mergeArticleWithQuery`; sidebar `runDeepDive` refreshes before clip; popup news prefers active tab; 75 ext tests + web-ext lint clean
- **Deep dive silent abort fix:** sidebar `setPageContextLocal` suppresses `session.onChanged` → `load()` so refresh/clip writes no longer bump `loadId` and abort `runDeepDive`; button disabled while running; shipped as **v1.3.6** (`meanbox-1.3.6.zip` + `-source.zip`)
- **Related-news strip:** `collectMainText` / `articleText` clone + strip chrome/related widgets (`box-category`, `related`, `tin-lien-quan`, …) before excerpt; `looksLikeArticleNoise` + `extractCleanTextFromHtml` + regression fixture; 21 article tests green
- **v1.3.7 packed:** `web-ext-artifacts/meanbox-1.3.7.zip` + `meanbox-1.3.7-source.zip`; `web-ext lint` clean
- **Chrome extension port (v1.3.7 parity):** `apps/chrome-extension/` forked from Firefox — MV3 `service_worker`, `side_panel` + `sidePanel`, `chrome.*`, async `onMessage` via `return true`+`sendResponse`, popup opens side panel under user gesture; preserved deep-dive race/`force` extract/noise strip; `MISTAKES.md` + pack `dist/meanbox-1.3.7.zip`; 77 unit tests green
- **FigCraft mobile UI:** installed `figcraft-cli` 0.5.1 (`~/bin`); imported `meanbox.figcraft` → `design-system/mobile/figcraft/`; exported @2x PNGs `MB_Ask` / `MB_News` / `MB_Study` / `MB_Tools`; README + MASTER link. No `MB_More` frame yet.
- **Expo mobile scaffold (SDK 54):** `apps/mobile` expo-router tabs Ask/News/Study/Tools/More using `MeanboxThemeProvider` + FigCraft mock data; iOS `expo export` green; keep package without `"type":"module"` (Metro/Babel); RN overrides in root `package.json`.

## Next

1. Smoke Expo mobile against production BFF (News list needs IC env; Study pack generate needs transcript)
2. Optional: add `MB_More` frame in FigCraft and align More tab UI
3. Smoke Firefox sidebar BrandSurface (light scrim + main.jpg) after reload temporary add-on
4. Smoke Chrome load-unpacked — confirm sidebar BrandSurface matches Firefox
5. Upload AMO: `meanbox-1.3.8.zip` + `meanbox-1.3.8-source.zip`
6. Deploy web BFF with IC env so `/api/news/clip` works in production
7. Commit/push when authorized

## Decisions

- Mobile DS extends existing Meanbox stone+teal tokens (reject ui-ux-pro-max clay/indigo); light-only v1; Expo/RN target; tokens: CSS → `tokens.json` → `theme/tokens.ts`
- RTCFC/BCMT Structure: explicit button only (not while typing); Perplexity `tools: []` (not Jev — no free-text extraction); apply via `compose*` into shell
- Reuse existing `/api/youtube/search` and `/api/github/search` (no new bridge APIs)
- News deep dive: sidebar `POST /api/news/clip` then `POST /api/news/deep-dive` with feed `id` (IC server env); Open in Meanbox → `/news?story=`
- Quick Gadgets (tip/split/convert/timer/rtcfc) resolve in-extension sidebar; other gadget phrases and empty Gadgets still deep-link to `/gadgets?q=`; Places still deep-link to web
- Extension RTCFC freeform uses BFF `/api/rtcfc/structure`; on failure rolls a local sample
- Article detection: tab sync still uses heuristics; **Deep dive always force-extracts** active-tab main body (any granted https page) then clip + deep-dive
- Article excerpt: strip in-article related/promo widgets before `innerText` (related boxes often live inside `<article>`, not `<aside>`)
- Gadgets free-text seed uses `/gadgets?q=` (Shapeshift `useSearchFlags`); `?g=` still seeds gadget examples
- Bare money amount in Quick Gadgets assumes 15% tip
- Convert Quick Gadget is local unit conversion (km/mi, kg/lb, °C/°F) — not FX rates
- Deep links use locale-aware `Link` from `@/i18n/navigation`
- Sidebar-owned `pageContext` writes use `setPageContextLocal` (suppress reload) so Deep dive / gadget updates do not race `loadId`
- Related lists capped at 5 items
- Browser playback via same-origin `/api/github/video/file` (not raw MinIO URLs)
- Deployed via `vercel deploy --prod` from repo root (git push to protected main blocked by policy)
- On Vercel: never call `@remotion/bundler` at Function runtime — build-time `.remotion` + Sandbox only
- Remotion `publicDir: null` still copies `./public` — use empty temp dir + delete `.remotion/public` so Sandbox upload stays flat
- Security advisories: read-only published list/get only (no create/update/report/CVE/fork; no GitHub OAuth)
- Firefox extension calls Meanbox BFF only — no AI keys in the add-on; gecko id `meanbox@royalsolution`

## Gotchas

- Lucide has no `Youtube` icon in this version — use `PlaySquare`
- YouTube `useSearchParams` already under Suspense on the page
- Remotion render on Vercel is heavy; MinIO must be reachable from Vercel (not localhost)
- Bun + `@rspack/binding` breaks runtime `bundle()` on Vercel Functions
- `@remotion/vercel` `addBundleToSandbox` mkDirs nested paths without creating `remotion-bundle` first → 400 if bundle has nested dirs
- Uncommitted WIP remains: news explore links (`NewsPageClient`, `Related*FromNews`, etc.) + Phase 2.x extension (incl. Quick Gadgets v1.3.1 + RTCFC) + gadgets `?q=` seed
- Unpublished advisories need `repository_advisories:read` + maintainer access — we default `state=published`
- Firefox host permissions are opt-in — use Options → Grant host access (includes optional `https://*/*`) for chip/article extract/sidebar fetch
- Deep dive persist needs production BFF with `PERPLEXITY_API_KEY` + Inspired Canvas env (`INSPIRED_CANVAS_*`); optional `INSPIRED_CANVAS_CLIP_SOURCE_ID`
- Learning pack from extension needs a fetchable transcript; otherwise opens Meanbox to paste captions
- Extension pack history save: BFF needs `googleSub` from OAuth session — add-on bridges `yt_oauth_*` via `X-Meanbox-Cookie` (fetch cannot set Cookie; SameSite=Lax blocks credentials from moz-extension). Requires `cookies` permission + signed-in Meanbox on same API base + web deploy with bridge parser
- Gadgets `?q=` seed needs web deploy of Shapeshift change; older production builds ignore `q`

## Pointers

| Item | Location |
|------|----------|
| RTCFC / BCMT Structure BFF | `apps/web/src/lib/rtcfc/`, `apps/web/src/lib/bcmt/`, `apps/web/src/app/api/rtcfc/structure/`, `apps/web/src/app/api/bcmt/structure/` |
| Structure fetchers + cards | `packages/react/src/hooks/useStructurePrompt.ts`, `RtcfcCard.tsx`, `BcmtCard.tsx` |
| Firefox extension | `apps/firefox-extension/` |
| Chrome extension | `apps/chrome-extension/` |
| Chrome mistakes checklist | `apps/chrome-extension/MISTAKES.md` |
| Article / deep-dive helpers | `apps/firefox-extension/lib/article.js` |
| Quick Gadgets (tip/split/convert/timer/rtcfc) | `apps/firefox-extension/lib/gadgets.js` |
| Extension deep-link paths | `apps/firefox-extension/lib/paths.js` |
| News clip BFF | `apps/web/src/app/api/news/clip/route.ts` |
| News deep-dive BFF | `apps/web/src/app/api/news/deep-dive/route.ts` |
| Extension README | `apps/firefox-extension/README.md` |
| Tasks | `tasks/todo.md` |
| Gadgets `?q=` seed | `packages/react/src/shapeshift/Shapeshift.tsx` |
| Advisories mappers | `apps/web/src/lib/github/securityAdvisories.ts` |
| Advisories API | `apps/web/src/app/api/github/advisories/` |
| Advisories UI | `apps/web/src/components/github/GitHubRepoDetail.tsx` (summary tab) |
| Related videos UI | `apps/web/src/components/github/RelatedVideosSection.tsx` |
| Related repos UI | `apps/web/src/components/youtube/RelatedReposSection.tsx` |
| Query helpers | `apps/web/src/lib/github/relatedVideosQuery.ts`, `apps/web/src/lib/youtube/relatedReposQuery.ts` |
| Remotion build-time bundle | `apps/web/scripts/bundle-remotion.mjs` → `.remotion/` |
| Video render (Vercel Sandbox) | `apps/web/src/lib/github/repoVideoRender.ts` |
| Production | https://meanbox.vercel.app |
| Deploy inspect | https://vercel.com/royal-platform/shapeshift/Gq35JBpASChbAoGKdkZLiq6NS6N2 |
