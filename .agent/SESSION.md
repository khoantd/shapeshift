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

Places: `/contact` category lists places that have saved Convex contacts.

## Done

- **Places → Lead Flow contacts (option B)** — Convex `placeContacts` + `POST /api/places/contacts` → `POST …/api/inbound/leads` (channel `ch-35ed1c04`)
- UI: Add contact form + list on `PlaceDetailCard` via `PlaceContactsSection`
- Env docs: `LEAD_FLOW_API_KEY`, `LEAD_FLOW_BASE_URL`, `LEAD_FLOW_CHANNEL_ID`
- Tests: `apps/web/src/lib/lead-flow/*.test.ts` (10 pass)
- **Fix:** lift `ConvexClientProvider` to root `app/layout.tsx` so `/places` `useQuery` has a Convex client (was only on waitlist `page.tsx`)
- **Places `/contact` category** — `PLACE_CATEGORIES` includes `contact`; Convex `listPlacesWithContacts`; `PlacesPageClient` skips Maps autocomplete and loads unique contact places; palette `Users` icon; empty/config states

## In progress

- _(none)_

## Next

1. Smoke-test: `/places` → type `/contact` → pick category → list places with contacts → select one → detail + contacts section
2. Optional keyword filter while in contact mode (name/address substring)
3. Keep local `convex dev` on `:3210` via `.env.local`; rotate Lead Flow API key if still exposed

## Decisions

- Option B: local Convex history + Lead Flow sync (not push-only)
- Single-lead endpoint `/api/inbound/leads` (not batch `lead-ingest`)
- Client owns Convex writes; Next API owns Lead Flow secret
- `contact` is a meta category (Convex filter), not Maps text search — `composePlacesSearchQuery` never appends `"contact"`

## Gotchas

- Without Convex URL, contact category shows config hint (contacts unavailable)
- Lead Flow requires `name`, `company` (place name), `email`, `channel_id`
- Never commit `LEAD_FLOW_API_KEY`; rotate if exposed
- Cloud `brazen-dinosaur-465` lacked `placeContacts` until push; local `convex dev` is running on `:3210` via `.env.local` (overrides `.env`). Keep that process up while developing. Cloud push needs `npx convex login`.

## Pointers

| Item | Location |
|------|----------|
| Lead Flow client | `apps/web/src/lib/lead-flow/` |
| Contacts API | `apps/web/src/app/api/places/contacts/route.ts` |
| Convex | `apps/web/convex/placeContacts.ts`, `schema.ts` |
| UI | `apps/web/src/components/places/PlaceContactsSection.tsx` |
| Contact category | `packages/core/src/parse/place.ts`, `PlacesPageClient.tsx` |
| Palette | `packages/react/src/shapeshift/PlaceCategoryPalette.tsx` |
