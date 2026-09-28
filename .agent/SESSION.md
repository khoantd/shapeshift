# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-28 |
| **Phase** | build |
| **Tool** | cursor |
| **Persona** | _(optional)_ |

## Goal

News feed filters: Read/Unread status + Newest/Oldest sort (plus prior Deep Dive VN/EN).

## Done

- **Deep Dive language** — VN (default) / EN toggle; API `language`; persist + cache match
- **News read/sort filters** — Status All|Unread|Read + Sort Newest|Oldest under search; URL `read=` / `sort=`; helpers in `newsFeedView.ts` (11 tests)

## In progress

- _(none)_

## Next

1. Smoke-test News Status/Sort toggles — Unread-only, Oldest, URL round-trip (`?read=unread&sort=oldest`)
2. Smoke-test Deep Dive VN/EN generate + regenerate
3. Confirm Critical-only still composes with read filter

## Decisions

- Date sort is primary (no unread-before-read); pinned still tops lists; brief score only ties equal dates when query active
- Defaults: Status All, Sort Newest (omitted from URL)
- `syncUrl` takes an options object including `read` / `sort`

## Gotchas

- ToggleGroup imported via `@shapeshift/react/ui/toggle-group` (deep export), not package root
- Inspired Canvas `deep_dive` is a single JSON blob — regenerating other language overwrites

## Pointers

| Item | Location |
|------|----------|
| Key files | `apps/web/src/lib/newsFeedView.ts`, `apps/web/src/components/NewsPageClient.tsx`, `apps/web/src/lib/perplexity/deepDiveParse.ts`, `packages/react/src/intents/NewsReaderPane.tsx` |
