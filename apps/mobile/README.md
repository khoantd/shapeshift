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

## Run

```bash
bun run --filter @shapeshift/mobile start
# or
cd apps/mobile && bunx expo start
```

Optional: `EXPO_PUBLIC_API_BASE=http://localhost:3000` before start.

Smoke bundle (CI-friendly):

```bash
cd apps/mobile && bunx expo export --platform ios --output-dir /tmp/meanbox-expo-ios
```

**Note:** Do not set `"type": "module"` on this package — Metro’s Babel loader breaks under ESM package roots in this monorepo. Theme/lib unit tests still run via Bun.

## Scripts

```bash
bun run --filter @shapeshift/mobile typecheck
bun run --filter @shapeshift/mobile test
```

## Theme usage

```tsx
import { MeanboxThemeProvider, useMeanboxTheme } from "@shapeshift/mobile";
```

Canonical colors live in [`packages/react/src/styles.css`](../../packages/react/src/styles.css). Update CSS → `tokens.json` → `theme/tokens.ts` together.
