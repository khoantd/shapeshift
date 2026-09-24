# Project structure map

> Persistent overview for AI agents. Generated on first run by `/understand` (see `.cursor/commands/understand-project.md`). Update when architecture changes significantly.

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-24 |
| **Tool** | cursor |

## Stack

- **App:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Bun
- **UI:** Tailwind CSS v4 · shadcn/ui (Radix) · Motion · cmdk · lucide-react · sonner
- **Intent:** TypeSafe AI Jev (`@typesafe-ai/sdk`) with offline keyword mock fallback
- **Parsing:** chrono-node, convert-units, date-fns, zod
- **Tests:** Bun test (`src/lib/__tests__/`)

## Layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js routes, layout, OG image, `/api/intent` |
| `src/components/shapeshift/` | Shell UI: input morph, chips, palette, HUD, saved stack |
| `src/components/intents/` | One card component per intent + `registry.ts` extension point |
| `src/components/ui/` | shadcn primitives |
| `src/hooks/` | `useIntent` (debounced classify), `useDemoScript` |
| `src/lib/jev/` | Jev questions, types, client, offline mock |
| `src/lib/parse/` | Deterministic parsers per card type |
| `src/lib/` | `decide.ts` / `signals.ts` calm-UI state machine, saved items, utils |
| `docs/` | Demo media + architecture diagrams (Excalidraw) |
| `tasks/` | Sprint checklist |
| `.cursor/` / `.claude/` / `.kiro/` / `.agents/` | Agent workflow hubs (keep synced via `npm run sync:all`) |

## Entry points

- `src/app/page.tsx` — home; mounts `Shapeshift` + `SiteChrome`
- `src/components/shapeshift/Shapeshift.tsx` — main interactive shell
- `src/app/api/intent/route.ts` — `POST` intent classification (Jev or offline)
- `src/hooks/useIntent.ts` — client debounce → `/api/intent` (or mock) with LRU cache
- `src/lib/decide.ts` + `src/lib/signals.ts` — confidence → calm UI states / hysteresis
- `src/components/intents/registry.ts` — card-type extension point
- `src/lib/parse/index.ts` — parser registry (`parseFor`)

## Key files

- Intent schema: `src/lib/jev/types.ts`, `src/lib/jev/questions.ts`, `src/lib/jev/mock.ts`
- Server Jev client: `src/lib/jev/client.ts`
- Persistence: `src/lib/savedItems.ts` (localStorage)
- Tests: `src/lib/__tests__/{decide,parse,signals,mock,client,savedItems}.test.ts`
- Env template: `.env.example` (`TYPESAFE_API_KEY`, `JEV_MODEL`, `NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_SITE_URL`)
- Live demo: https://shapeshiftui.vercel.app

## Commands

| Action | Command |
|--------|---------|
| Install | `bun install` |
| Dev | `bun dev` |
| Test | `bun test` |
| Typecheck + lint + test | `bun run check` |
| Build | `bun run build` |
| Lint | `bun run lint` |
| Format | `bun run format` |

## Code intelligence

| Item | Status |
|------|--------|
| CodeGraph index | Present — `.codegraph/` (123 files, ~1.7k nodes; includes vendored skill scripts under `.kiro`/`.claude`) |
| Workspace root | `/Volumes/Data/Software Development/TypeScript/shapeshift` |
| OntoSight | `npx royalsolution-ontosight@0.2.1 "/Volumes/Data/Software Development/TypeScript/shapeshift" --symbol Shapeshift --path src/components/shapeshift` |

## Notes

- **Jev decides, code computes:** model answers typed questions; dates/amounts/units/math are deterministic parsers.
- Works offline by default (`jev-offline` mock). Online needs `TYPESAFE_API_KEY` in `.env.local` (server-only).
- Adding a card: `INTENT_KEYS` → `questions.ts` → parser → registry component → mock + tests.
- URL flags: `?debug=1`, `?demo=1&loop=1`.
- SESSION template is still blank; no active sprint tasks in `tasks/todo.md`.
