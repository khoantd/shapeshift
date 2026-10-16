/** Pure settings helpers (no React Native / AsyncStorage). */

export const DEFAULT_API_BASE = "https://meanbox.vercel.app";
export const DEFAULT_LOCALE = "en";

export type MeanboxLocale = "en" | "vi";

export type MeanboxSettings = {
  apiBase: string;
  locale: MeanboxLocale;
};

export function normalizeApiBase(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

export function normalizeLocale(raw: string | null | undefined): MeanboxLocale {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "vi" ? "vi" : DEFAULT_LOCALE;
}

export function deepDiveLanguage(locale: MeanboxLocale): "en" | "vi" {
  return locale === "vi" ? "vi" : "en";
}

export function meanboxHref(
  path: string,
  settings: Pick<MeanboxSettings, "apiBase" | "locale">,
): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const localePrefix =
    settings.locale && settings.locale !== "en" ? `/${settings.locale}` : "";
  return `${settings.apiBase}${localePrefix}${clean}`;
}
