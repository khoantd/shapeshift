# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-03 |
| **Phase** | build |
| **Tool** | cursor |
| **Persona** | _(optional)_ |

## Goal

Polish Places pin UX (toast, list unpin, empty state, OSM brand markers) — keep Pin + `/pinned`.

## Done

- **Pin UX polish** — `notify` toast on pin/unpin (View → `/pinned`); list-row unpin in pinned mode; dashed empty panel + Search places CTA; OSM `markerAccent="pinned"` brand markers
- **Places pin** — Convex `placePins` table + `placePins.ts` (`listPinned`, `isPinned`, `pin`, `unpin`, `toggle`)
- Core: `pinned` in `PLACE_CATEGORIES`; `isPinnedCategory` / `isConvexPlaceCategory`; compose never appends meta cats
- UI: `PlacePinButton` on `PlaceDetailCard`; `PinnedPlacesBridge` + `/pinned` palette in `PlacesPageClient`
- Docs: `FEATURES.md` + waitlist copy mention pin / `/pinned`
- Tests: place parse suite (pinned category) pass; `apps/web` typecheck pass
- **Convex push (2026-10-03)** — `convex dev --once` → `brazen-dinosaur-465`; `placePins.by_placeId` index added
- **Convex prod deploy (2026-10-03)** — `convex deploy` → `jovial-weasel-546`; `placePins.by_placeId` live on production
- **Vercel prod (2026-10-03)** — `vercel --prod` → aliased https://shapeshift-bay.vercel.app; Pin UI (pin changes still uncommitted on `main`)
- Prior: Places contacts / Lead Flow / `/contact` category (see earlier SESSION history)

## In progress

- _(none)_

## Next

1. Manual QA: pin → toast + View → `/pinned` → unpin from row → empty CTA → OSM brand markers in pinned mode
2. Commit + push pin + polish to `origin/main` so Git-linked deploys stay in sync (still uncommitted locally)
3. Human: resolve Company Brain conflicts / promote proposed Shapeshift docs if still open
4. Rotate Lead Flow API key if still exposed

## Decisions

- Pins use Convex (same shared no-auth model as `placeContacts`), not localStorage
- Lucide `Pin` + News-style `aria-pressed` (not Bookmark); polish keeps Pin naming
- Toast via existing `@shapeshift/react` `notify` (Sonner); no new toast stack
- `pinned` is a meta category like `contact` — skips Maps autocomplete
- Preserve existing Places chrome (no new design-system orange palette)
- OSM only for prediction marker accent; MapTiler/Google unchanged

## Gotchas

- Without Convex URL, pin control is hidden; `/pinned` shows config hint
- `bunx convex codegen` may need network/login; `_generated/api.d.ts` was updated to include `placePins`
- Schema must be pushed (`convex dev` / `convex deploy`) before pin mutations work against a remote deployment
- Local `convex dev` on `:3210` via `.env.local` overrides `.env` when developing

## Pointers

| Item | Location |
|------|----------|
| Convex pins | `apps/web/convex/placePins.ts`, `schema.ts` |
| Pin button | `apps/web/src/components/places/PlacePinButton.tsx` |
| Detail card | `apps/web/src/components/places/PlaceDetailCard.tsx` |
| Places page | `apps/web/src/components/places/PlacesPageClient.tsx` |
| OSM markers | `apps/web/src/components/places/OsmPlacesMap.tsx`, `PlacesMap.tsx` |
| Category parse | `packages/core/src/parse/place.ts` |
| Features doc | `FEATURES.md` |
| Contacts (related) | `apps/web/convex/placeContacts.ts`, `PlaceContactsSection.tsx` |
