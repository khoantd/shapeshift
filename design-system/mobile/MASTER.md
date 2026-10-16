# Meanbox Mobile Design System

> Global source of truth for the Meanbox mobile app. Extends web + extension brand tokens — does not fork them.

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Color scheme** | Light only (v1) |
| **Stack target** | Expo / React Native |
| **Canonical CSS** | [`packages/react/src/styles.css`](../../packages/react/src/styles.css) |
| **Machine tokens** | [`tokens.json`](./tokens.json) |
| **RN theme stub** | [`apps/mobile/theme`](../../apps/mobile/theme) |

---

## Principles

1. **One brand across hosts** — Web, extension sidebar, and mobile share the same color, radius, and type roles; only density and chrome change.
2. **Calm utility** — Near-black primary actions; teal brand for focus, selection, and links. No purple gradients, glow effects, or emoji icons.
3. **Brand atmosphere, not decoration** — Optional `BrandSurface` scrim behind chrome; never over content media (video, maps, article images).
4. **Thumb-first IA** — Bottom tab navigation; Ask / intent is the home hero interaction.
5. **Cards only when interactive** — Feed lists and reader prose stay flat; cards for intent results, saved items, and gadget outputs.

### Rejected looks

- Claymorphism / toy-like chunky UI
- Indigo / purple SaaS defaults
- Warm cream + terracotta newspaper / broadsheet layouts
- Dark mode (deferred)
- Dashboard-style first viewport clutter

---

## Color

| Role | Token | Hex | Usage |
|------|--------|-----|--------|
| Page | `background` | `#fafaf9` | Screen root |
| Ink | `foreground` | `#1a1a19` | Primary text |
| Surface | `card` | `#ffffff` | Interactive cards, sheets |
| Muted fill | `muted` / `secondary` | `#f4f4f2` | Chips idle, secondary buttons |
| Muted text | `mutedForeground` | `#706e68` | Captions (≥4.6:1 on card/page) |
| Brand | `brand` | `#0f766e` | Links, focus ring, selected |
| Brand soft | `brandSoft` | `#ecfdf8` | Selected chip fill, accent surface |
| Primary CTA | `primary` | `#1a1a19` | High-emphasis filled buttons |
| Danger / OK / Caution | `destructive` / `positive` / `caution` | `#e03131` / `#2f9e44` / `#e8590c` | Status |
| Border | `border` | `#e8e7e4` | Hairlines, inputs |
| Focus | `ring` | `#0f766e` | Focus outline (2px + 2px offset) |

Extension CSS aliases (`--mb-*`) map to the same values — see `tokens.json` → `extensionAlias`.

---

## Radius

Concentric scale (outside − inset):

| Token | px | Use |
|-------|-----|-----|
| `sm` | 8 | Cells, small tiles |
| `md` | 12 | Inputs, icon tiles |
| `lg` | 16 | Items inside a panel |
| `xl` | 20 | Panels, toasts, list cards |
| `shell` / `2xl` | 28 | Intent field shell |
| `pill` | 9999 | Buttons, chips, badges, avatars |

---

## Typography

**Families:** Geist Sans / Geist Mono, with system fallbacks (`SF Pro` / `Roboto` on device).

| Style | Size | Weight | Line height | Notes |
|-------|------|--------|-------------|--------|
| Display | 28 | 650 | 1.2 | Rare; brand moments |
| Title | 20 | 650 | 1.25 | Screen titles |
| Body | 16 | 400 | 1.5 | Default UI |
| Body reader | 16 | 400 | 1.65 | News deep dive prose |
| Callout | 15 | 500 | 1.45 | Emphasized secondary |
| Caption | 13 | 400 | 1.4 | Metadata · muted |
| Micro | 11 | 500 | 1.3 | Tab labels, chips |

Icons: Lucide, stroke width **1.75** (match mid text weights). No emoji as icons.

---

## Spacing & chrome

| Token | Value |
|-------|--------|
| Unit | 4 |
| Phone gutter | 16 |
| Large gutter | 20 |
| Section gap | 12–16 |
| Header height | 48 + safe-area top |
| Tab bar height | 56 + safe-area bottom |
| Min touch target | 44 |

---

## Motion

- Duration: **150ms**
- Easing: `cubic-bezier(0.23, 1, 0.32, 1)`
- Button press: scale **0.96** (disabled when reduce-motion)
- Toast swipe dismiss: **45px**
- Always respect OS reduce-motion (`AccessibilityInfo` / `prefers-reduced-motion`)

---

## Information architecture

```
Bottom tabs: Ask · News · Study · Tools · More
```

| Tab | Role |
|-----|------|
| **Ask** | Morphing intent input (Shapeshift); home |
| **News** | Brief feed → deep-dive reader |
| **Study** | Segmented YouTube companion / GitHub repo lens |
| **Tools** | Quick Gadgets (tip, split, convert, timer, RTCFC) + Places |
| **More** | Account, locale, API base, history, about |

### Screen patterns

1. **Ask home** — Quiet center; intent field; recent stack below (searchable, page size 5).
2. **News feed** — Flat rows (source · time · title · 2-line excerpt); no hero collage.
3. **Deep dive** — Optional full-bleed image → title → prose paragraphs → related strip (≤5) → secondary “Open in Meanbox”.
4. **Study** — Exclusive context card + Overview / Related tabs.
5. **Quick Gadgets** — Chip launcher → inline result card (Copy / Roll / Structure).

---

## Component inventory

| Component | Spec | Maps from |
|-----------|------|-----------|
| `BrandSurface` | Brand image + scrim under chrome only | Web `BrandSurface` |
| `AppHeader` | Mark + title + actions; translucent over brand | `SiteChrome` |
| `BottomTabBar` | Docked or floating pill; active = brand soft + brand icon | — |
| `IntentField` | Shell radius 28; chips above | `Shapeshift` shell |
| `Chip` / `Segmented` | Pill; selected = brand soft + brand text | Extension chips |
| `ResultCard` | White, radius 20, shadow rest | Intent cards |
| `ListRow` | Flat divider list | Extension rows / news feed |
| `ReaderPane` | Relaxed body, brand links | `NewsReaderPane` |
| `PrimaryButton` | Pill; filled primary or brand-soft | shadcn button |
| `Toast` | Swipe-dismiss, radius 20 | Sonner patterns |

---

## Accessibility checklist

- [ ] Text contrast ≥ 4.5:1 (muted `#706e68` verified on card/page)
- [ ] Focus / selected states use brand ring or brand soft fill
- [ ] Touch targets ≥ 44×44
- [ ] Lucide SVG icons with accessible labels (no emoji icons)
- [ ] Reduce-motion: no press scale / slide / zoom
- [ ] Safe-area insets on header and tab bar
- [ ] `inputMode` / keyboard type match field purpose
- [ ] Back navigation preserves stack history

---

## Implementation map

| Artifact | Path |
|----------|------|
| This doc | `design-system/mobile/MASTER.md` |
| Tokens JSON | `design-system/mobile/tokens.json` |
| FigCraft source + PNG exports | [`figcraft/`](./figcraft/) (`meanbox.figcraft`, `exports/MB_*.png`) |
| RN theme | `apps/mobile/theme/` |
| Web CSS (do not diverge) | `packages/react/src/styles.css` |
| Extension CSS mirror | `apps/*/shared.css` `--mb-*` |

When adding a token: update CSS first, then `tokens.json`, then `apps/mobile/theme/tokens.ts`.
