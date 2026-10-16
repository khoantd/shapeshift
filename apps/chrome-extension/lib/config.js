/** Meanbox API base + locale preferences. */

export const DEFAULT_API_BASE = "https://meanbox.vercel.app";
export const DEFAULT_LOCALE = "en";

/**
 * @returns {Promise<{ apiBase: string, locale: string }>}
 */
export async function getSettings() {
  const stored = await chrome.storage.sync.get({
    apiBase: DEFAULT_API_BASE,
    locale: DEFAULT_LOCALE,
  });
  const apiBase = normalizeApiBase(stored.apiBase) || DEFAULT_API_BASE;
  const locale =
    typeof stored.locale === "string" && stored.locale.trim()
      ? stored.locale.trim()
      : DEFAULT_LOCALE;
  return { apiBase, locale };
}

/**
 * @param {string | undefined | null} raw
 */
export function normalizeApiBase(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return `${u.origin}`;
  } catch {
    return "";
  }
}

/**
 * @param {{ apiBase?: string, locale?: string }} next
 */
export async function saveSettings(next) {
  const patch = {};
  if (next.apiBase !== undefined) {
    const base = normalizeApiBase(next.apiBase);
    if (!base) throw new Error("API base must be a valid http(s) URL");
    patch.apiBase = base;
  }
  if (next.locale !== undefined) {
    patch.locale = String(next.locale).trim() || DEFAULT_LOCALE;
  }
  await chrome.storage.sync.set(patch);
}

/**
 * Deep-link into the Meanbox web app.
 * @param {string} path e.g. "/github?repo=owner/name"
 * @param {{ apiBase?: string, locale?: string }} [opts]
 */
export async function meanboxHref(path, opts = {}) {
  const settings = opts.apiBase
    ? { apiBase: opts.apiBase, locale: opts.locale || DEFAULT_LOCALE }
    : await getSettings();
  const clean = path.startsWith("/") ? path : `/${path}`;
  // localePrefix as-needed: default locale has no prefix on the site
  const localePrefix =
    settings.locale && settings.locale !== "en" ? `/${settings.locale}` : "";
  return `${settings.apiBase}${localePrefix}${clean}`;
}
