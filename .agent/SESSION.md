# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-07 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

GitHub repo detail — about + README + on-demand AI summary.

## Done

- Prior: `/github` monitor (trending, favorites, activity, headlines)
- Repo detail on select:
  - `GET /api/github/readme` + `fetchRepoReadme` (GitHub Contents API raw markdown)
  - `POST /api/github/summarize` + Perplexity `runGithubRepoSummary` (on demand)
  - `GitHubRepoDetail` — about block, Summarize button, README via `MarkdownBody`
  - Unit tests: `readme.test.ts`, `repoSummaryParse.test.ts`
  - en/vi i18n + FEATURES.md row

## In progress

- None

## Next

1. Browser smoke `/github`: select repo → README loads; Summarize with `PERPLEXITY_API_KEY`
2. Optional: commit this slice
3. Still pending from prior: Convex `githubFavorites` deploy if not done

## Decisions

- About + README always; AI summary on button click (not auto)
- No Convex persistence for repo summaries (session Map + server LRU)
- Render markdown with `@shapeshift/react` `MarkdownBody`

## Pointers

| Item | Location |
|------|----------|
| README / summary libs | `apps/web/src/lib/github/readme.ts`, `repoSummary.ts`, `repoSummaryParse.ts` |
| APIs | `apps/web/src/app/api/github/readme`, `summarize` |
| Detail UI | `apps/web/src/components/github/GitHubRepoDetail.tsx` |
