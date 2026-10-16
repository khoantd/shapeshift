# Meanbox Chrome extension

Bring Meanbox into Chrome while you browse GitHub, YouTube, and the open web.

Full feature parity with the Firefox add-on (v1.3.7). See [MISTAKES.md](./MISTAKES.md) for regressions to avoid.

## Features

### MVP (repo + study)

- **Repo lens** on `github.com` — summary, published security advisories, related YouTube
- **Study companion** on `youtube.com` — details, learning pack (via transcript API), related repos
- **Toolbar popup** — quick search + open current page in Meanbox
- **Side panel** — persistent panel (`chrome.sidePanel`)
- **Omnibox** — type `mb` then a query
- **Context menus** — study video links, open repos, search selection

### Phase 2 (tools)

- **Quick Gadgets** — tip / split / convert / timer / **RTCFC** resolve **in the side panel** (chips, compose, selection menu, popup, omnibox `g:`). Freeform `rtcfc …` calls `POST /api/rtcfc/structure`; labeled Role/Task/… parses locally. Other phrases still open `/gadgets?q=…`.
- **News / lesson deep dive** — on **Deep dive**, always re-reads the active tab’s main body (any granted `https` page), clips via `POST /api/news/clip`, generates with `POST /api/news/deep-dive`, and offers **Open in Meanbox** → `/news?story=…`.
- **Places from selection** — selection → `/places?q=…`
- Omnibox prefixes: `g:` / `gadget:`, `news:`, `places:` (plus `yt:` / `gh:`)

All AI / data calls go to the Meanbox BFF (`/api/*`). No API keys are stored in the extension.

Toolbar icons match the web app favicon ([`apps/web/public/brand/favicon.png`](../web/public/brand/favicon.png)). Regenerate sizes:

```bash
sips -z 16 16 ../web/public/brand/favicon.png --out icons/16.png
sips -z 48 48 ../web/public/brand/favicon.png --out icons/48.png
sips -z 128 128 ../web/public/brand/favicon.png --out icons/128.png
```

## Load in Chrome (dev)

1. Open `chrome://extensions`
2. Toggle **Developer mode**
3. **Load unpacked** → pick this folder (`apps/chrome-extension`)

### After edits

| Changed | Reload |
|---------|--------|
| `manifest.json`, service worker, popup/options/side panel JS | Extension **↻** on `chrome://extensions` |
| Content script / CSS | Extension **↻** **and** reload the web page |
| Popup / options / side panel HTML/CSS only | Reopen that UI |

### Debug consoles

- Service worker: `chrome://extensions` → Meanbox → **Inspect views: service worker**
- Popup: right-click toolbar icon → **Inspect popup**
- Side panel: open panel → DevTools on that document
- Content script: page DevTools → context dropdown → extension world

## Options

- **API base** — default `https://meanbox.vercel.app` (or `http://localhost:3000`)
- **Locale** — deep-link locale (`en` / `vi`)
- **Grant host access** — optional `https://*/*` for news/lesson deep dive on arbitrary sites (GitHub / YouTube / Meanbox are already in `host_permissions`)

## Saving history (device vs account)

Generated content is **always saved on this device** in `chrome.storage.local` when you run the side-panel action — even if you are not signed in to Meanbox.

| When | Where it lives |
|------|----------------|
| Not signed in | This Chrome profile only (`storage.local`) |
| Signed in (Google on the API base) | Meanbox account history **and** a local copy |
| After sign-in | **Options → Sync to Meanbox** (or automatic sync when session cookies appear) |

**Learning packs (account):** require a signed-in Google session on the same API base.

1. Use a BFF that includes the `X-Meanbox-Cookie` bridge.
2. Open Meanbox in Chrome and **Sign in with Google** on that same origin.
3. Reload the extension after upgrades so the `cookies` permission is active.
4. Open a YouTube video that already has a pack — Overview should show **Pack loaded**.
5. Click **Learning pack** — **Pack saved to history** when signed in, or **Saved on this device** when not.

If the status mentions **No Meanbox session cookies**, the extension could not read `yt_oauth_*` for the configured API base.

## Pack / test

```bash
cd apps/chrome-extension
chmod +x pack.sh
./pack.sh          # dist/meanbox-<version>.zip
bun test           # unit tests (requires Bun)
```

## Smoke checklist

1. GitHub repo → side panel Overview + related YouTube
2. YouTube video → details + learning pack (signed-in optional)
3. News page (with host grant) → Deep dive force-extract; related strip not in excerpt
4. Quick Gadgets tip / timer in side panel
5. Omnibox `mb yt:…` / `news:…`
6. After ~30s idle, open popup again — page context still loads (session storage)
