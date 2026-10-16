/**
 * Meanbox mobile design tokens — keep in sync with
 * design-system/mobile/tokens.json and packages/react/src/styles.css.
 */

export const color = {
  background: "#fafaf9",
  foreground: "#1a1a19",
  card: "#ffffff",
  cardForeground: "#1a1a19",
  popover: "#ffffff",
  popoverForeground: "#1a1a19",
  primary: "#1a1a19",
  primaryForeground: "#fafaf9",
  secondary: "#f4f4f2",
  secondaryForeground: "#1a1a19",
  muted: "#f4f4f2",
  mutedForeground: "#706e68",
  accent: "#ecfdf8",
  accentForeground: "#0f766e",
  destructive: "#e03131",
  border: "#e8e7e4",
  input: "#e8e7e4",
  ring: "#0f766e",
  brand: "#0f766e",
  brandSoft: "#ecfdf8",
  ink2: "#57564f",
  lineStrong: "#d6d4cf",
  positive: "#2f9e44",
  caution: "#e8590c",
  cautionText: "#bb4c19",
  swatchOutline: "rgba(26, 26, 25, 0.06)",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 28,
  "3xl": 28,
  shell: 28,
  pill: 9999,
} as const;

export const spacing = {
  unit: 4,
  gutterPhone: 16,
  gutterLarge: 20,
  sectionGap: 12,
  sectionGapLg: 16,
  tabBarHeight: 56,
  headerHeight: 48,
  touchMin: 44,
} as const;

export const motion = {
  durationMs: 150,
  pressScale: 0.96,
  /** cubic-bezier(0.23, 1, 0.32, 1) as RN Easing.bezier args */
  easeOut: [0.23, 1, 0.32, 1] as const,
  toastSwipeDismissPx: 45,
} as const;

export const typography = {
  fontFamily: {
    sans: "Geist",
    mono: "Geist Mono",
    heading: "Geist",
    /** Device fallbacks when Geist is not loaded */
    sansFallback: "System",
    monoFallback: "Courier",
  },
  scale: {
    display: { fontSize: 28, fontWeight: "650" as const, lineHeight: 28 * 1.2, letterSpacing: -0.56 },
    title: { fontSize: 20, fontWeight: "650" as const, lineHeight: 20 * 1.25, letterSpacing: -0.4 },
    body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 16 * 1.5 },
    bodyReader: { fontSize: 16, fontWeight: "400" as const, lineHeight: 16 * 1.65 },
    callout: { fontSize: 15, fontWeight: "500" as const, lineHeight: 15 * 1.45 },
    caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 13 * 1.4 },
    micro: { fontSize: 11, fontWeight: "500" as const, lineHeight: 11 * 1.3 },
  },
} as const;

export const icon = {
  strokeWidth: 1.75,
  set: "lucide" as const,
} as const;

export const brandSurface = {
  image: "brand/main.jpg",
  headerImage: "brand/header.jpg",
  scrim: {
    light: 0.5,
    medium: 0.7,
    heavy: 0.85,
  },
} as const;

export const shadowCss = {
  rest: "0 1px 2px rgb(26 26 25 / 0.04), 0 1px 1px rgb(26 26 25 / 0.03)",
  lift: "0 1px 2px rgb(26 26 25 / 0.04), 0 8px 24px -6px rgb(26 26 25 / 0.08)",
  float: "0 2px 4px rgb(26 26 25 / 0.04), 0 20px 48px -12px rgb(26 26 25 / 0.14)",
} as const;

/** RN-friendly elevation layers (apply as successive shadow* props or custom shadow views). */
export const shadow = {
  rest: {
    shadowColor: "#1a1a19",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  lift: {
    shadowColor: "#1a1a19",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  float: {
    shadowColor: "#1a1a19",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.14,
    shadowRadius: 48,
    elevation: 8,
  },
} as const;

export const tabs = ["Ask", "News", "Study", "Tools", "More"] as const;
export type MeanboxTab = (typeof tabs)[number];

export const tokens = {
  color,
  radius,
  spacing,
  motion,
  typography,
  icon,
  brandSurface,
  shadow,
  shadowCss,
  tabs,
} as const;

export type MeanboxTokens = typeof tokens;
