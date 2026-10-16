# @shapeshift/mobile

Meanbox mobile app (Expo SDK 57 / React Native 0.86) + design tokens.

| Artifact | Path |
|----------|------|
| Master DS | [`design-system/mobile/MASTER.md`](../../design-system/mobile/MASTER.md) |
| Tokens JSON | [`design-system/mobile/tokens.json`](../../design-system/mobile/tokens.json) |
| FigCraft source | [`design-system/mobile/figcraft/`](../../design-system/mobile/figcraft/) |
| Theme | [`theme/`](./theme) |
| BFF client | [`lib/api.ts`](./lib/api.ts) |
| Screens | [`app/(tabs)/`](./app/(tabs)/) |

Tabs call the Meanbox BFF (default `https://meanbox.vercel.app`): News feed + deep dive, YouTube study packs, Ask intent routing, Tools gadgets (local parsers + RTCFC structure). API base and locale live in AsyncStorage (More tab).

**Sign in:** More → Sign in uses an auth session that returns to `meanbox://oauth` with a session bridge (`X-Meanbox-Cookie`), same model as the Firefox extension. Requires BFF route `GET /api/youtube/oauth/mobile-bridge` on the API base (deploy web before testing against production).

## Run (Metro only)

```bash
bun run --filter @shapeshift/mobile start
# or
cd apps/mobile && bunx expo start
```

Optional: `EXPO_PUBLIC_API_BASE=http://localhost:3000` before start.

This starts the JS bundler. To open the app on a phone you need either a **native install** (recommended below) or Expo Go. **Expo Go is optional** — Meanbox already has a native iOS shell under [`ios/`](./ios/) with `expo-dev-client`.

Smoke bundle (CI-friendly):

```bash
cd apps/mobile && bunx expo export --platform ios --output-dir /tmp/meanbox-expo-ios
```

**Note:** Do not set `"type": "module"` on this package — Metro’s Babel loader breaks under ESM package roots in this monorepo. Theme/lib unit tests still run via Bun.

## Install on a linked device (no Expo Go)

Default install is a **Release** build: JS is embedded in the app, no Metro URL screen, API defaults to `https://meanbox.vercel.app` (override in More → API base).

### Prerequisites (iOS)

- Mac with Xcode (Command Line Tools + iOS platform)
- iPhone unlocked, plugged in (or paired over Wi‑Fi), **Developer Mode** on (Settings → Privacy & Security)
- Apple ID for signing (free Personal Team works for local installs; device may need re-trust every ~7 days)

### Install and run (production-style)

```bash
cd apps/mobile
bun run ios -- --device
# same as: bunx expo run:ios --configuration Release --device
```

Run from `apps/mobile` (not the monorepo root). Pick your phone when prompted. Open **Meanbox** — it should launch straight into the app (no “enter URL”). Trust the developer on the phone if iOS asks (Settings → General → VPN & Device Management).

**Device requirements:** unlock the phone, enable **Developer Mode** (Settings → Privacy & Security → Developer Mode), and accept the trust prompt when asked.

### Xcode (Release)

1. Open [`ios/Meanbox.xcworkspace`](./ios/Meanbox.xcworkspace) (**not** the `.xcodeproj`)
2. Scheme **Meanbox** → destination = your iPhone
3. Product → Scheme → Edit Scheme → Run → Build Configuration → **Release**
4. Signing & Capabilities → Team → **Khoa Nguyen** (`35TQZJG4NP`)
5. Product → Run

### Dev install (Metro / hot reload)

Debug builds use `expo-dev-client` and ask for a bundler URL unless Metro is running:

```bash
cd apps/mobile
bun run ios:dev -- --device   # Debug native shell
bunx expo start --dev-client  # then open Meanbox
```

### Android (optional)

No checked-in `android/` folder yet — first run generates it:

```bash
cd apps/mobile
bunx expo run:android --device
```

Needs Android Studio, USB debugging, and an authorized device / emulator.

## Scripts

```bash
bun run --filter @shapeshift/mobile typecheck
bun run --filter @shapeshift/mobile test
bun run --filter @shapeshift/mobile ios         # Release (embedded JS → prod API)
bun run --filter @shapeshift/mobile ios:dev     # Debug + Metro
bun run --filter @shapeshift/mobile android     # expo run:android
```

## Theme usage

```tsx
import { MeanboxThemeProvider, useMeanboxTheme } from "@shapeshift/mobile";
```

Canonical colors live in [`packages/react/src/styles.css`](../../packages/react/src/styles.css). Update CSS → `tokens.json` → `theme/tokens.ts` together.
