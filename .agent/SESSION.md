# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-11 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

Ship Meanbox Firefox extension MVP (repo lens + YouTube study companion) on top of existing BFF APIs.

## Done

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

## In progress

- None

## Next

1. Reload temporary add-on; smoke: open YouTube with existing pack → Pack loaded; regenerate → one Saved packs row; web deep-link auto-opens Pack tab
2. Commit/push pack upsert + restore changes when authorized
3. Phase 2 extension: gadgets sidebar, news clipper, places from selection

## Decisions

- Reuse existing `/api/youtube/search` and `/api/github/search` (no new bridge APIs)
- Deep links use locale-aware `Link` from `@/i18n/navigation`
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
- Uncommitted WIP remains: news explore links (`NewsPageClient`, `Related*FromNews`, etc.)
- Unpublished advisories need `repository_advisories:read` + maintainer access — we default `state=published`
- Firefox host permissions are opt-in — use Options → Grant host access if chip/sidebar cannot fetch
- Learning pack from extension needs a fetchable transcript; otherwise opens Meanbox to paste captions
- Extension pack history save: BFF needs `googleSub` from OAuth session — add-on bridges `yt_oauth_*` via `X-Meanbox-Cookie` (fetch cannot set Cookie; SameSite=Lax blocks credentials from moz-extension). Requires `cookies` permission + signed-in Meanbox on same API base + web deploy with bridge parser

## Pointers

| Item | Location |
|------|----------|
| Firefox extension | `apps/firefox-extension/` |
| Extension README | `apps/firefox-extension/README.md` |
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
