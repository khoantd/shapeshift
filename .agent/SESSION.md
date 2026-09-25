# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-25 |
| **Phase** | build |
| **Tool** | cursor |
| **Persona** | _(optional)_ |

## Goal

Ship decision cards + RTCFC polish + personal cards (workout, EMI, recipe); connect Vercel deploys.

## Done

- Tip + RTCFC + BCMT intents; Roll again samples (prior)
- **JevIntro:** brand-first header above input
- **Decision cards:** triage, classify, moderate, eval, route, approve
- **RTCFC:** Prompt `<pre>` demoted; Copy beside Roll again
- **Personal cards:** workout, emi, recipe (parsers, cards, registry, mock, tests)
- Key files: `src/lib/parse/{workout,emi,recipe}.ts`, `src/components/intents/{Workout,Emi,Recipe}Card.tsx`
- `bun run check` green

## In progress

- _(none)_

## Next

1. Connect Vercel: install [Vercel GitHub App](https://github.com/apps/vercel) on `khoantd/shapeshift` (project not visible on current Vercel MCP account — use the account that owns shapeshiftui.vercel.app)
2. Add `TYPESAFE_API_KEY` / `JEV_MODEL=jev-1.13.0` in that Vercel project env (Production + Preview)
3. Deferred: response-model selection (needs multi-model invoke)

## Decisions

- Decision cards stay localStorage / offline-first; Approve is UI-only (no tool runner)
- `routeDecision`: assign | another_review; owners parsed deterministically
- `toolApproval`: allow | pause
- Enter newline for decision cards + rtcfc/bcmt; ⌘/Ctrl+Enter saves
- Workout vs habit: one-session sets×reps, not recurring routine
- EMI: reducing-balance; lakh/crore principal scaling
- Recipe vs todo: cooking framing (ingredients / serves)

## Gotchas

- Demo / reopen / draft append still use textarea `setSelectionRange`
- `bun run check` = typecheck + lint + test
- `showJevIntro` = `!demo && !intent && ui.kind !== "choose"`
- MOCK_QUESTION_COUNT remains 21 (no new signal questions)
- EMI rate regex must not use trailing `\b` after `%`

## Pointers

| Item | Location |
|------|----------|
| Spec | HITL decision cards + personal cards plan |
| Tasks | `tasks/todo.md` |
| Branch | `main` |
| Key files | `WorkoutCard.tsx`, `EmiCard.tsx`, `RecipeCard.tsx`, `RtcfcCard.tsx` |
