# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-08 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

Ship GitHub AI supplements + News↔YouTube↔GitHub learning triangle on Meanbox.

## Done

- Dual-mode `/github` search (prior)
- Phase 1: diagram + explainer + Mermaid (+ Remotion video)
- Phase 2 YouTube↔GitHub bridge
- Phase 3 News triangle (this session, uncommitted):
  - Related news on repo detail + YouTube selection
  - Related videos/repos in News reader (`relatedPanel` on `NewsReaderPane`)
  - `/news?q=&story=` hydrate/sync
  - Query helpers + unit tests; en/vi i18n; typecheck green
- Prod env synced: `OPENAI_API_KEY`, `MINIO_*` (7 vars) on Vercel production (prior)

## In progress

- None

## Next

1. Browser smoke: News story → related video → related repo → related news
2. Commit when user asks (Phase 1–3 + Remotion + bridges)

## Decisions

- Third vertex = main `/news` (Inspired Canvas), not GitHub SerpAPI headlines
- Reuse `/api/news`, `/api/youtube/search`, `/api/github/search` (no new bridge APIs)
- Deep links: `/news?q=&story=`, `/youtube?q=&videoId=`, `/github?q=&repo=`
- Related lists capped at 5 items
- Preserve existing Meanbox visuals (no new palette)

## Gotchas

- Lucide has no `Youtube` icon — use `PlaySquare`; news uses `Newspaper`
- `/api/news` needs Inspired Canvas credentials (401 → relatedNewsUnavailable)
- Remotion render on Vercel is heavy; MinIO must be reachable from Vercel (not localhost)

## Pointers

| Item | Location |
|------|----------|
| Related news UI | `apps/web/src/components/shared/RelatedNewsSection.tsx` |
| News → videos/repos | `apps/web/src/components/news/RelatedVideosFromNews.tsx`, `RelatedReposFromNews.tsx` |
| News query helpers | `apps/web/src/lib/news/relatedNewsQuery.ts` |
| News deep link | `NewsPageClient.tsx` (`?q=` / `?story=`) |
| Reader related slot | `packages/react/.../NewsReaderPane.tsx` (`relatedPanel`) |
| Prod URL | https://shapeshift-bay.vercel.app |
