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

Standalone `/places` page (Google, MapTiler, or SerpAPI) + morphing `place` intent (TypeSafe Jev) + category slash search.

## Done

- **SerpAPI provider** — `PLACES_PROVIDER=serpapi` + `SERPAPI_API_KEY`; Google Maps engine for search/details; map tiles via MapTiler or Google public key
- **MapTiler + Google providers** — shared BFF; provider auto-detect
- **`place` Jev intent** — morphing card → `/places?q=`
- **Places category slash** — `/shop coffee` style filter for OSM categories; `PlaceCategoryPalette`; `PlaceData.category` + `placesHref` deep link `?category=`
- **Places sidebar scroll** — desktop `lg:h-dvh` shell so detail pane scrolls
- **OSM pin → card** — prediction pin click calls `selectPrediction` / details
- **Short Open/Closed** — `shortenOpenState` for card + results list
- **Typing sidebar fix** — no per-keystroke `router.replace`; debounced URL mirror + aside `z-10`/`shrink-0`
- **Select-other-place fix** — URL hydrate no longer depends on `selected?.placeId` (was reloading stale `?place=` and aborting the new details fetch); `selectPrediction` sets `skipUrlHydrate`; stale `loadDetails` responses ignored

## In progress

- _(none)_

## Next

1. Smoke-test select place A then B from results — detail card + map must follow B
2. Smoke-test `/places` sidebar scroll on a tall PlaceDetailCard
3. Smoke-test OSM pin click → detail card (address/phone/business)
4. Smoke-test `/shop coffee` palette + category chip + composed autocomplete

## Decisions

- SerpAPI is search-only; map tiles require MapTiler or Google JS public key
- `PLACES_PROVIDER` selects google | maptiler | serpapi
- Category scope is provider-agnostic via `composePlacesSearchQuery` (no native OSM type filters)
- Desktop places shell uses `lg:h-dvh overflow-hidden` so sidebar `overflow-y-auto` works
- OSM prediction pin click reuses `selectPrediction` / details API
- `shortenOpenState` collapses "Open ⋅ Closes …" to Open/Closed in UI
- Places search URL: debounce `q` mirror (300ms); never soft-nav on each keystroke
- Place category `/shop` uses inline dropdown under the search field (no modal blur / focus steal)
- Place URL hydrate is searchParams-driven only; optimistic `selected` must not re-trigger hydrate

## Gotchas

- SerpAPI: `SERPAPI_API_KEY` + tiles key (`NEXT_PUBLIC_MAPTILER_API_KEY` or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- MapTiler place ids may include dots (`poi.123`)
- Slash draft is not written to the URL; only applied `q` + `category` are
- MapTiler/Google tile maps do not plot prediction pins (OSM only)
- Putting `selected?.placeId` in the `?place=` hydrate effect deps reintroduces the select-stuck-on-old-place bug

## Pointers

| Item | Location |
|------|----------|
| Key files | `packages/core/src/parse/place.ts`, `packages/react/src/shapeshift/PlaceCategoryPalette.tsx`, `apps/web/src/components/places/PlacesPageClient.tsx`, `apps/web/src/lib/places/format.ts` |
