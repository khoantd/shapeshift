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

Places: add person contacts with local Convex history + Lead Flow sync.

## Done

- **Places → Lead Flow contacts (option B)** — Convex `placeContacts` + `POST /api/places/contacts` → `POST …/api/inbound/leads` (channel `ch-35ed1c04`)
- UI: Add contact form + list on `PlaceDetailCard` via `PlaceContactsSection`
- Env docs: `LEAD_FLOW_API_KEY`, `LEAD_FLOW_BASE_URL`, `LEAD_FLOW_CHANNEL_ID`
- Tests: `apps/web/src/lib/lead-flow/*.test.ts` (10 pass)

## In progress

- _(none)_

## Next

1. Run `bunx convex dev` (or deploy) from `apps/web` so `placeContacts` schema + functions sync
2. Ensure `NEXT_PUBLIC_CONVEX_URL` is set (same as waitlist)
3. **Rotate** the Lead Flow API key (it was pasted in chat) and update `LEAD_FLOW_API_KEY` in `apps/web/.env`
4. Smoke-test: open a place → Add contact → confirm Lead Flow lead + Convex list badge Synced

## Decisions

- Option B: local Convex history + Lead Flow sync (not push-only)
- Single-lead endpoint `/api/inbound/leads` (not batch `lead-ingest`)
- Client owns Convex writes; Next API owns Lead Flow secret

## Gotchas

- Without Convex URL, UI shows config hint (contacts unavailable)
- Lead Flow requires `name`, `company` (place name), `email`, `channel_id`
- Never commit `LEAD_FLOW_API_KEY`; rotate if exposed

## Pointers

| Item | Location |
|------|----------|
| Lead Flow client | `apps/web/src/lib/lead-flow/` |
| Contacts API | `apps/web/src/app/api/places/contacts/route.ts` |
| Convex | `apps/web/convex/placeContacts.ts`, `schema.ts` |
| UI | `apps/web/src/components/places/PlaceContactsSection.tsx` |
