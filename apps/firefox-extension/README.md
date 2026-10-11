# Meanbox Firefox extension

Bring Meanbox into Firefox while you browse GitHub, YouTube, and the open web.

## Features

### MVP (repo + study)

- **Repo lens** on `github.com` — summary, published security advisories, related YouTube
- **Study companion** on `youtube.com` — details, learning pack (via transcript API), related repos
- **Toolbar popup** — quick search + open current page in Meanbox
- **Sidebar** — persistent panel (Firefox `sidebar_action`)
- **Omnibox** — type `mb` then a query
- **Context menus** — study video links, open repos, search selection

### Phase 2 (tools)

- **Quick Gadgets** — tip / split / convert / timer / **RTCFC** resolve **in the sidebar** (chips, compose, selection menu, popup, omnibox `g:`). Freeform `rtcfc …` calls `POST /api/rtcfc/structure`; labeled Role/Task/… parses locally. Other phrases still open `/gadgets?q=…`. Use **Open in Meanbox** to edit or save on the web shelf.
- **News / lesson deep dive** — article heuristics feed the sidebar; **Deep dive** clips via `POST /api/news/clip`, generates with `POST /api/news/deep-dive` (persisted), and offers **Open in Meanbox** → `/news?story=…`. Context menu, popup Deep dive, omnibox `news:…`, and empty-state Deep dive use the same flow.
- **Places from selection** — selection → `/places?q=…`
- Omnibox prefixes: `g:` / `gadget:` (Quick Gadgets when tip/split/convert/timer), `news:`, `places:` (plus existing `yt:` / `gh:`)

**Daily Quick Gadget phrases:** `tip 18% on $90`, `split $40 for 3`, `10 km to mi`, `25 min focus`, `rtcfc review this NestJS PR`. Bare amounts (e.g. select `248000`) assume a 15% tip in the sidebar.

All AI / data calls go to the Meanbox BFF (`/api/*`). No API keys are stored in the add-on.

## Load in Firefox

### Temporary (dev)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Pick [`manifest.json`](./manifest.json) in this folder

Or with [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```bash
cd apps/firefox-extension
bun install
bun run dev
```

### Options

Open the add-on options to set:

- **API base** — default `https://meanbox.vercel.app` (or `http://localhost:3000`)
- **Locale** — deep-link locale (`en` / `vi`)
- **Grant host access** — Firefox opt-in for GitHub / YouTube / custom API host

## Permissions note

Firefox MV3 host permissions are opt-in. If the chip, article extract, or sidebar cannot load data, use **Options → Grant host access** (needed for GitHub / YouTube / news sites and the API host). Deep dive uses the `scripting` permission to read title/excerpt from the active tab.

## Saving learning packs

History is stored on Meanbox (Convex) and requires a **signed-in Google session** on the same API base (Options → API base).

1. **Redeploy / use a BFF that includes the `X-Meanbox-Cookie` bridge** (older production builds ignore the session header).
2. Open Meanbox in Firefox and **Sign in with Google** (YouTube study / account connect) on that same origin.
3. **Reload the temporary add-on** after upgrades so the `cookies` permission is active; use **Options → Grant host access** for the API host.
4. Open a YouTube video that already has a pack — Overview should show **Pack loaded** without regenerating.
5. Click **Learning pack** to generate or refresh — status **Pack saved to history** (one row per video after upsert).

If the status mentions **No Meanbox session cookies**, the add-on could not read `yt_oauth_*` for the configured API base (reload, host access, or sign-in origin mismatch). If it mentions **sign out and sign in again**, cookies reached the BFF but `googleSub` is missing.

## Lint / package

```bash
bun run lint
bun run build   # writes web-ext-artifacts/*.zip
bun test
```

## Layout

| Path | Role |
|------|------|
| `background.js` | Menus, omnibox, page-context sync |
| `content.js` + `content.css` | Detect repo/video, floating chip |
| `sidebar.*` | Repo lens + study companion + tools launcher |
| `popup.*` | Quick search (GitHub / YouTube / Gadgets / News / Places) |
| `options.*` | API base + permissions |
| `lib/` | Config, URL parse, deep-link paths, BFF client |
