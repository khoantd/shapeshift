# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-08 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

Add dual-mode repository search on `/github` (instant trending filter + GitHub Search API).

## Done

- `apps/web/src/lib/github/searchQuery.ts` + unit tests (`parseSearchQuery`, `filterReposByQuery`)
- `fetchRepoSearch` in `apps/web/src/lib/github/client.ts`
- `GET /api/github/search` route
- Dual-mode UI in `GitHubPageClient` + `GitHubFavoritesPanel` (debounce, `?q=`, Cmd/Ctrl+K, a11y)
- en/vi i18n strings under `GitHub.*`
- `bun test` for searchQuery + trending helpers; `tsc --noEmit` clean

## In progress

- None

## Next

1. Browser smoke on `/github`: 1-char filter, 2+ API results, clear, select → detail, `?q=` round-trip
2. Optional: commit when user asks
3. Prior Company Brain promote still blocked on human (see previous session)

## Decisions

- Mode 3: local filter of trending while typing; debounced API at ≥2 chars; clear restores trending
- Reuse Meanbox tokens / Lucide icons; no separate design-system palette
- Sort API results by stars (matches existing GitHub client helper)

## Pointers

| Item | Location |
|------|----------|
| Search helpers | `apps/web/src/lib/github/searchQuery.ts` |
| API | `apps/web/src/app/api/github/search/route.ts` |
| UI | `apps/web/src/components/github/GitHubPageClient.tsx` |
| Plan | `.cursor/plans/github_repo_search_ec58e276.plan.md` (or user plans dir) |
