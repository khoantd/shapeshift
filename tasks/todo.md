# Tasks

> Actionable checklist for the current feature or sprint. Sync with `.agent/SESSION.md` on `/handoff`.

## Current sprint

- [x] Gadgets Saved list: search + Load more (page size 5) via `RecentStack` / `filterSavedItems`
- [x] RTCFC + BCMT Structure (explicit AI: freeform → labeled/tag fields via `/api/rtcfc/structure` + `/api/bcmt/structure`)
- [x] RTCFC Prompt demotion (Copy beside Roll again)
- [x] Decision cards (triage → approve) + JevIntro
- [x] Personal cards: workout, EMI, recipe
- [x] Commit + push (`75abdd7` on `main`)
- [x] News intent + `/news` CXO feed page (Inspired Canvas)
- [x] `/news` Stats tab — Jev brief KPIs, tone mix, ranked list, Score unscored
- [x] Intent morphing stats on Stats tab (localStorage ring from `/gadgets`)
- [ ] Vercel GitHub App + env on the account that owns shapeshiftui.vercel.app (not visible via current MCP)
- [ ] Set `INSPIRED_CANVAS_ACCESS_TOKEN` for live `/news` feed

## Firefox extension

- [x] MVP: repo lens + YouTube study + omnibox/menus
- [x] Phase 2: gadgets sidebar launcher, news clipper, places from selection (`v1.1.0`)
- [x] Phase 2.1: in-sidebar deep dive on news/e-learning (`v1.2.0`) — replace Meanbox News tab open
- [x] Phase 2.2 (`v1.2.1`): button declutter + `[hidden]` fix + `POST /api/news/clip` persist + Open in Meanbox
- [x] Phase 2.3 (`v1.3.0`): in-sidebar Quick Gadgets (tip/split/convert/timer) + chips + selection/popup/omnibox
- [x] Phase 2.4 (`v1.3.1`): RTCFC Quick Gadget (parse/roll + `/api/rtcfc/structure`)
- [ ] Reload temp add-on + smoke: Quick Gadgets (RTCFC chip + structure); Deep dive saves; Open in Meanbox; deploy BFF with IC env
- [ ] Commit/push when authorized

## Backlog

- [ ] Response-model selection (needs multi-model invoke)
- [ ] Optional IC Supabase Auth UI (replace env JWT)
