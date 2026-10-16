# Meanbox (Flutter)

Parallel Flutter client for Meanbox — full feature parity with the Expo app at [`apps/mobile`](../mobile), talking to the same BFF.

| Item | Detail |
|------|--------|
| Package | `meanbox` (`com.royalsolution.meanbox`) |
| Default API | `https://meanbox.vercel.app` |
| Tabs | Ask · News · Study · Tools · More |
| Design tokens | [`design-system/mobile/tokens.json`](../../design-system/mobile/tokens.json) → `lib/theme/tokens.dart` |
| Brand | `assets/brand/{icon,wordmark,lockup}.png` (same as Expo); launcher icons via `flutter_launcher_icons` |
| Expo twin | [`apps/mobile`](../mobile) (kept; not replaced) |

## Prerequisites

- Flutter 3.24+ (`flutter doctor`)
- Xcode (iOS) and/or Android Studio (Android)

## Run

```bash
cd apps/mobile_flutter
flutter pub get
flutter run                 # pick device / simulator
flutter run --release       # production-style against default API base (no JIT)
```

Override API base in **More → API base** (same as Expo).

### Physical iPhone + Xcode 26.4+ (debug crash)

Debug on a USB-attached device can die at launch with:

`EXC_BAD_ACCESS (code=50)` on a JIT address (no Dart frames).

That is a known Flutter/LLDB race ([flutter#184254](https://github.com/flutter/flutter/issues/184254)), not app code. This project disables Flutter LLDB debugging in `pubspec.yaml` (`enable-lldb-debugging: false`) so `flutter run` falls back to Xcode attach.

If it still fails:

1. Prefer **`flutter run --release -d <deviceId>`** for smoke tests (AOT, no JIT)
2. Upgrade Flutter to **3.41.8+** (`flutter upgrade`), then you can remove the pubspec `config` block
3. Or use the **simulator** / **wireless** debugging

## OAuth

Sign in uses `flutter_web_auth_2` (ASWebAuthenticationSession / Chrome Custom Tabs), same pattern as Expo `WebBrowser.openAuthSessionAsync`.

Flow: open `/api/youtube/oauth/start?returnTo=/api/youtube/oauth/mobile-bridge` → Google → BFF callback redirects to `meanbox://oauth?bridge=…` (Cookie-style session). The app stores the bridge and sends `X-Meanbox-Cookie` on API calls (Firefox / Expo parity).

URL scheme `meanbox` is registered in iOS `Info.plist` and Android `AndroidManifest.xml`. Requires a production BFF that includes the mobile OAuth deep-link path (callback or `/api/youtube/oauth/mobile-bridge`).

## Test / analyze / smoke build

```bash
flutter analyze
flutter test
flutter build ios --no-codesign
```

## Layout

```
assets/
  brand/         # icon / wordmark / lockup (shared with Expo)
  app_icon.png   # 1024 source for flutter_launcher_icons
lib/
  api/           # MeanboxClient + pure helpers
  auth/          # OAuth session bridge
  settings/      # API base + locale
  gadgets/       # tip / split / convert / timer / rtcfc (Dart port)
  features/      # Ask, News, Study, Tools, More
  theme/         # Meanbox tokens + ThemeData
  widgets/       # MeanboxLogo + shared UI
```

Regenerate home-screen icons after changing `assets/app_icon.png`:

```bash
dart run flutter_launcher_icons
```

Gadgets are a Dart port of `@shapeshift/core` parsers used by Expo Tools — they do not import the TypeScript package.
