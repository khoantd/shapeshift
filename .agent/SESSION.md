# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-09-24 |
| **Phase** | build |
| **Tool** | cursor |
| **Persona** | _(optional)_ |

## Goal

Add BCMT prompt card (Bối Cảnh – Con Người – Mục Tiêu – Tiêu Chuẩn), mirroring RTCFC.

## Done

- Tip + RTCFC intents end-to-end (prior)
- Shell: auto-growing wrapping `<textarea>` + RTCFC/BCMT newline Enter
- **BCMT intent** end-to-end: parse/compose VN tags, card UI, mock classify, multiline shell
- Key files: `src/lib/parse/bcmt.ts`, `src/components/intents/BcmtCard.tsx`, registry/mock/questions/types

## In progress

- _(none)_
- **Blockers:** none

## Next

1. Optional: demote RTCFC Prompt block redundancy vs wrapped input
2. Next card candidates: workout set, EMI, recipe
3. Optional: more BCMT domain sample placeholders in cycling hint

## Decisions

- Compose output uses VN skeleton tags (`<bối_cảnh>` …); `đầu_vào` only when filled
- Completeness = 4 core fields; input is optional
- Enter newline for both `rtcfc` and `bcmt`; mutual exclusion in mock scoring

## Gotchas

- Demo / reopen / draft append still use textarea `setSelectionRange`
- `bun run check` = typecheck + lint + test
- English `Context:` / `Goal:` alone are weak BCMT signals — need People/Standards or VN labels

## Pointers

| Item | Location |
|------|----------|
| Spec | _(BCMT from VN prompt samples)_ |
| Tasks | `tasks/todo.md` |
| Branch | _(current)_ |
| Key files | `src/lib/parse/bcmt.ts`, `src/components/intents/BcmtCard.tsx` |
