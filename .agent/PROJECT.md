# Project structure map

> Persistent overview for AI agents. Generated on first run by `/understand` (see `.cursor/commands/understand-project.md`). Update when architecture changes significantly.

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-26 |
| **Tool** | cursor |

## Stack

- **Monorepo:** Bun workspaces
- **App:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Bun — `apps/web`
- **SDK:** `@shapeshift/core` (pure TS) · `@shapeshift/react` (UI + hooks)
- **UI:** Tailwind CSS v4 · shadcn/ui (Radix) · Motion · cmdk · lucide-react · sonner
- **Intent:** TypeSafe AI Jev (`@typesafe-ai/sdk`) with offline keyword mock fallback
- **Parsing:** chrono-node, convert-units, date-fns, zod
- **Tests:** Bun test (`packages/core/src/__tests__/`, `packages/react/src/lib/`)

## Layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js demo host (routes, SiteChrome, thin `/api/intent`) |
| `packages/core/` | decide, signals, parse, jev types/mock, `./server` handler |
| `packages/react/` | Shapeshift shell, intent cards, hooks, shadcn ui, styles.css |
| `docs/` | Demo media + architecture diagrams |
| `tasks/` | Sprint checklist |

## Entry points

- `apps/web/src/app/page.tsx` — waitlist landing (`WaitlistLanding` + Convex)
- `apps/web/src/app/demo/page.tsx` — mounts `ShapeshiftApp` + `SiteChrome`
- `apps/web/src/app/news/page.tsx` — CXO feed briefing (Inspired Canvas)
- `packages/react/src/shapeshift/Shapeshift.tsx` — morphing input shell
- `apps/web/src/app/api/intent/route.ts` — `createIntentHandler()`
- `apps/web/src/app/api/news/route.ts` — Inspired Canvas CXO feed BFF
- `packages/react/src/hooks/useIntent.ts` — classify DI + debounce
- `packages/core/src/decide.ts` + `signals.ts` — calm UI state machine
- `packages/react/src/intents/registry.ts` — card-type extension point
- `apps/web/convex/` — waitlist schema + `joinWaitlist` / `waitlistCount`

## Commands

| Action | Command |
|--------|---------|
| Install | `bun install` (repo root) |
| Dev | `bun dev` |
| Test | `bun test` |
| Typecheck + lint + test | `bun run check` |
| Build | `bun run build` |

## Notes

- **Jev decides, code computes.** Host injects `classify`; packages never read Next env.
- Adding a card: `INTENT_KEYS` → questions → parser → registry → mock + tests (all under `packages/`).
- Vercel: Root Directory = `apps/web`.
