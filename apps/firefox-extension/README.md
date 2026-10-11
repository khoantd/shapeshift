# Meanbox Firefox extension

Bring Meanbox into Firefox while you browse GitHub and YouTube.

## Features (MVP)

- **Repo lens** on `github.com` — summary, published security advisories, related YouTube
- **Study companion** on `youtube.com` — details, learning pack (via transcript API), related repos
- **Toolbar popup** — quick search + open current page in Meanbox
- **Sidebar** — persistent panel (Firefox `sidebar_action`)
- **Omnibox** — type `mb` then a query (`yt:` / `gh:` prefixes supported)
- **Context menus** — study video links, open repos, search selection

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

Firefox MV3 host permissions are opt-in. If the chip or sidebar cannot load data, use **Options → Grant host access**.

## Saving learning packs

History is stored on Meanbox (Convex) and requires a **signed-in Google session** on the same API base (Options → API base).

1. Open Meanbox in Firefox and **Sign in with Google** (YouTube study / account connect).
2. Keep that origin’s cookies (the add-on reads `yt_oauth_*` via the `cookies` permission and sends them as `X-Meanbox-Cookie` to the BFF).
3. Generate a learning pack from the sidebar — status should say **Pack saved to history**.

If you see “Generated but not saved”, sign in on Meanbox (same API base), then regenerate. Reload the temporary add-on after upgrading so the `cookies` permission is granted.

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
| `sidebar.*` | Repo lens + study companion UI |
| `popup.*` | Quick search |
| `options.*` | API base + permissions |
| `lib/` | Config, URL parse, BFF client |
