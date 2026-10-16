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
- **News / lesson deep dive** — on **Deep dive**, the add-on always re-reads the active tab’s main body (any granted `https` page), clips via `POST /api/news/clip`, generates with `POST /api/news/deep-dive` (persisted), and offers **Open in Meanbox** → `/news?story=…`. Context menu, popup Deep dive, omnibox `news:…`, and empty-state Deep dive use the same flow.
- **Places from selection** — selection → `/places?q=…`
- Omnibox prefixes: `g:` / `gadget:` (Quick Gadgets when tip/split/convert/timer), `news:`, `places:` (plus existing `yt:` / `gh:`)

**Daily Quick Gadget phrases:** `tip 18% on $90`, `split $40 for 3`, `10 km to mi`, `25 min focus`, `rtcfc review this NestJS PR`. Bare amounts (e.g. select `248000`) assume a 15% tip in the sidebar.

All AI / data calls go to the Meanbox BFF (`/api/*`). No API keys are stored in the add-on.

Toolbar/sidebar icons match the web app favicon ([`apps/web/public/brand/favicon.png`](../web/public/brand/favicon.png)). Regenerate sizes:

```bash
sips -z 48 48 ../web/public/brand/favicon.png --out icons/48.png
sips -z 96 96 ../web/public/brand/favicon.png --out icons/96.png
```

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

Firefox MV3 host permissions are opt-in. If the chip, article extract, or sidebar cannot load data, use **Options → Grant host access** (needed for GitHub / YouTube / any site you deep-dive, and the API host). Deep dive uses `scripting` to read title + main body text from the active tab on each click.

## Saving history (device vs account)

Generated content (learning packs, repo summaries, news deep dives, Quick Gadgets / RTCFC) is **always saved on this device** in Firefox `browser.storage.local` when you run the sidebar action — even if you are not signed in to Meanbox.

| When | Where it lives |
|------|----------------|
| Not signed in | This Firefox profile only (`storage.local`) |
| Signed in (Google on the API base) | Meanbox account history (Convex / Inspired Canvas) **and** a local copy |
| After sign-in | **Options → Sync to Meanbox** (or automatic sync when session cookies appear) uploads pending learning packs and news deep dives |

**Learning packs (account):** require a **signed-in Google session** on the same API base (Options → API base) for cloud history.

1. **Redeploy / use a BFF that includes the `X-Meanbox-Cookie` bridge** (older production builds ignore the session header).
2. Open Meanbox in Firefox and **Sign in with Google** (YouTube study / account connect) on that same origin.
3. **Reload the temporary add-on** after upgrades so the `cookies` permission is active; use **Options → Grant host access** for the API host.
4. Open a YouTube video that already has a pack — Overview should show **Pack loaded** (cloud or **from this device**).
5. Click **Learning pack** to generate or refresh — **Pack saved to history** when signed in, or **Saved on this device** when not.

Repo summaries and Quick Gadgets stay on the device until a future cloud shelf exists. **Clear device history** in Options removes local copies only.

If the status mentions **No Meanbox session cookies**, the add-on could not read `yt_oauth_*` for the configured API base (reload, host access, or sign-in origin mismatch). If it mentions **sign out and sign in again**, cookies reached the BFF but `googleSub` is missing.

## Lint / package (local)

```bash
npm install
npm run lint
npm run build          # web-ext-artifacts/meanbox-<version>.zip  (add-on package)
npm run pack:source    # web-ext-artifacts/meanbox-<version>-source.zip  (AMO source)
```

Unit tests (optional; require [Bun](https://bun.sh)):

```bash
bun test
```

---

## Building for AMO reviewers (source code)

This add-on ships **plain JavaScript** — there is no transpile, minify, or bundler step. The build only packages the source files with Mozilla’s `web-ext` into a zip that matches what is submitted as the add-on.

### Operating system / environment

| Requirement | Supported |
|-------------|-----------|
| OS | macOS, Linux, or Windows (WSL or native) |
| Node.js | **20.x or newer** ([nodejs.org](https://nodejs.org/)) |
| npm | **10.x or newer** (ships with Node 20+) |
| Shell | bash (for `build.sh`; on Windows use Git Bash / WSL) |
| Network | Required once for `npm ci` (downloads `web-ext`) |

No API keys, env files, or other services are required to build the package.

### Install Node / npm

1. Install Node.js 20 LTS from https://nodejs.org/ (or via `nvm install 20`).
2. Confirm versions:

```bash
node -v   # e.g. v20.19.0 or higher
npm -v    # e.g. 10.x or higher
```

### Step-by-step build (exact add-on package)

From this directory (`apps/firefox-extension/` when working in the monorepo, or the root of the source zip):

```bash
# 1. Install dependencies (locked via package-lock.json)
npm ci --no-workspaces --ignore-scripts

# 2. Package the add-on
npm run build
```

Or run the single build script (preferred for reviewers):

```bash
chmod +x build.sh
./build.sh
```

(`--no-workspaces` keeps this package self-contained if a parent monorepo `package.json` is present.)

**Output:** `web-ext-artifacts/meanbox-<version>.zip`  
That zip is the add-on package (same content submitted to AMO as the extension file).

### What the build does

1. `npm ci --no-workspaces --ignore-scripts` — installs `web-ext@8.10.0` from `package-lock.json`.
2. `web-ext build` — zips the extension files listed in this folder, excluding tests and tooling (`web-ext-config.mjs` → `ignoreFiles`).
3. No compilation: JS/CSS/HTML/icons are copied as-is into the zip.

### Verify

```bash
npm run lint
unzip -l web-ext-artifacts/meanbox-*.zip | head
```

Expected: `manifest.json`, `background.js`, `sidebar.*`, `popup.*`, `options.*`, `content.*`, `lib/*.js` (non-test), `icons/`, `brand/main.jpg`, `shared.css`.

### AMO upload checklist

1. **Add-on file:** upload `web-ext-artifacts/meanbox-<version>.zip` (from `./build.sh` or `npm run build`).
2. **Source code:** upload `web-ext-artifacts/meanbox-<version>-source.zip` from:

```bash
npm run pack:source
```

The source zip includes this README, `build.sh`, `package.json`, `package-lock.json`, and all extension source.

### Reviewer notes (paste into AMO)

```
Build environment: Node.js 20+ and npm 10+ on macOS/Linux/Windows (bash).
From the source root: chmod +x build.sh && ./build.sh
(or: npm ci --no-workspaces --ignore-scripts && npm run build)
Output: web-ext-artifacts/meanbox-<version>.zip
No transpile/minify/bundle — package contains the same plain JS as the source.
No secrets or env vars required.
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
