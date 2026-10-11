/** Thin client for Meanbox BFF routes. */

import { getSettings } from "./config.js";

/** Meanbox YouTube/Google OAuth session cookies (httpOnly on the web app). */
export const SESSION_COOKIE_PREFIX = "yt_oauth_";

/**
 * Bridged to the BFF (fetch cannot set the forbidden Cookie header from an
 * extension page; SameSite=Lax also blocks credentials:include from moz-extension).
 */
export const MEANBOX_SESSION_COOKIE_HEADER = "X-Meanbox-Cookie";

/**
 * Build a Cookie-style value from browser.cookies entries, keeping only Meanbox
 * session cookies so history saves can resolve googleSub.
 *
 * @param {Array<{ name?: string, value?: string }> | null | undefined} cookies
 * @returns {string}
 */
export function buildSessionCookieHeader(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return "";
  const parts = [];
  for (const c of cookies) {
    const name = typeof c?.name === "string" ? c.name : "";
    const value = typeof c?.value === "string" ? c.value : "";
    if (!name || !value) continue;
    if (!name.startsWith(SESSION_COOKIE_PREFIX)) continue;
    parts.push(`${name}=${value}`);
  }
  return parts.join("; ");
}

/**
 * Read Meanbox session cookies for the configured API origin (httpOnly OK).
 * @param {string} apiBase
 * @returns {Promise<{ header: string, reason: "ok" | "no_cookies_api" | "empty" | "error" }>}
 */
export async function getSessionCookieBridge(apiBase) {
  try {
    if (typeof browser === "undefined" || !browser.cookies?.getAll) {
      return { header: "", reason: "no_cookies_api" };
    }
    const list = await browser.cookies.getAll({ url: `${apiBase}/` });
    const header = buildSessionCookieHeader(list);
    return { header, reason: header ? "ok" : "empty" };
  } catch {
    return { header: "", reason: "error" };
  }
}

/**
 * User-facing hint when a pack was generated but not persisted.
 * @param {{
 *   saveError?: string | null,
 *   sessionBridge?: { header?: string, reason?: string } | null,
 *   apiBase?: string,
 * }} input
 */
export function formatUnsavedPackHint(input) {
  const saveError =
    typeof input?.saveError === "string" ? input.saveError.trim() : "";
  if (saveError) return saveError;

  const reason = input?.sessionBridge?.reason;
  const apiBase =
    typeof input?.apiBase === "string" && input.apiBase.trim()
      ? input.apiBase.trim()
      : "Meanbox";

  if (reason === "no_cookies_api") {
    return "Reload the add-on so the cookies permission is active, then regenerate.";
  }
  if (reason === "error") {
    return `Cannot read session cookies for ${apiBase} — grant host access in Options, then regenerate.`;
  }
  if (reason === "empty" || !input?.sessionBridge?.header) {
    return `No Meanbox session cookies for ${apiBase} — sign in on that origin, reload the add-on, grant host access, then regenerate.`;
  }
  return "Generated but not saved — sign in on Meanbox, then regenerate.";
}

/**
 * @param {string} path
 * @param {RequestInit & { query?: Record<string, string | number | undefined | null> }} [init]
 */
export async function meanboxFetch(path, init = {}) {
  const { apiBase } = await getSettings();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase}/`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  const { query: _q, ...rest } = init;
  const sessionBridge = await getSessionCookieBridge(apiBase);
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(sessionBridge.header
        ? { [MEANBOX_SESSION_COOKIE_HEADER]: sessionBridge.header }
        : {}),
      ...(rest.headers || {}),
    },
    credentials: "omit",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.error || data.message)) ||
      `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (data && typeof data === "object") {
    data._sessionBridge = sessionBridge;
    data._apiBase = apiBase;
  }
  return data;
}

/** @param {string} fullName */
export function fetchRepo(fullName) {
  return meanboxFetch("/api/github/repo", { query: { repo: fullName } });
}

/** @param {string} fullName */
export function fetchAdvisories(fullName) {
  return meanboxFetch("/api/github/advisories", {
    query: { repo: fullName, state: "published", perPage: 10 },
  });
}

/**
 * @param {string} fullName
 * @param {{ description?: string | null, language?: string | null }} [extra]
 */
export function summarizeRepo(fullName, extra = {}) {
  return meanboxFetch("/api/github/summarize", {
    method: "POST",
    body: JSON.stringify({
      repo: fullName,
      description: extra.description ?? undefined,
      language: extra.language ?? "en",
    }),
  });
}

/** @param {string} q */
export function searchGithub(q) {
  return meanboxFetch("/api/github/search", { query: { q } });
}

/** @param {string} videoId */
export function fetchVideoDetails(videoId) {
  return meanboxFetch("/api/youtube/details", { query: { videoId } });
}

/**
 * Load a saved learning pack for the signed-in Meanbox user (cookie bridge).
 * @param {string} videoId
 * @returns {Promise<{ success?: boolean, pack?: { markdown?: string } | null, unauthorized?: boolean }>}
 */
export async function fetchSavedLearningPack(videoId) {
  try {
    return await meanboxFetch("/api/youtube/learning-packs", {
      query: { videoId },
    });
  } catch (err) {
    if (err && err.status === 401) {
      return { success: false, pack: null, unauthorized: true };
    }
    throw err;
  }
}

/** @param {string} videoId */
export function fetchTranscript(videoId) {
  return meanboxFetch("/api/youtube/transcript", { query: { videoId } });
}

/**
 * @param {{
 *   videoId: string,
 *   title: string,
 *   channelTitle?: string,
 *   contentType?: string,
 *   transcript: string,
 *   language?: string,
 * }} body
 */
export function generateLearningPack(body) {
  return meanboxFetch("/api/youtube/learning-pack", {
    method: "POST",
    body: JSON.stringify({
      contentType: "lecture",
      language: "en",
      ...body,
    }),
  });
}

/** @param {string} q */
export function searchYouTube(q) {
  return meanboxFetch("/api/youtube/search", { query: { q } });
}

/**
 * Upsert a clipped article into Meanbox news (Inspired Canvas) and return feed id.
 * @param {{
 *   title: string,
 *   excerpt: string,
 *   canonicalUrl?: string,
 * }} body
 */
export function clipNewsArticle(body) {
  const payload = {
    title: String(body.title || "").trim().slice(0, 500),
    excerpt: String(body.excerpt || "").trim().slice(0, 4000),
  };
  const canonicalUrl = String(body.canonicalUrl || "").trim().slice(0, 2000);
  if (canonicalUrl) payload.canonicalUrl = canonicalUrl;
  return meanboxFetch("/api/news/clip", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Generate a news/article deep dive. Pass `id` (from clipNewsArticle) to persist.
 * @param {{
 *   title: string,
 *   excerpt: string,
 *   canonicalUrl?: string,
 *   id?: string,
 *   language?: "en" | "vi",
 *   force?: boolean,
 * }} body
 */
export async function generateNewsDeepDive(body) {
  const { locale } = await getSettings();
  const language =
    body.language === "en" || body.language === "vi"
      ? body.language
      : locale === "vi"
        ? "vi"
        : "en";
  const payload = {
    title: String(body.title || "").trim().slice(0, 500),
    excerpt: String(body.excerpt || "").trim().slice(0, 4000),
    language,
  };
  const canonicalUrl = String(body.canonicalUrl || "").trim().slice(0, 2000);
  if (canonicalUrl) payload.canonicalUrl = canonicalUrl;
  const id = String(body.id || "").trim().slice(0, 128);
  if (id) payload.id = id;
  if (body.force === true) payload.force = true;
  return meanboxFetch("/api/news/deep-dive", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * AI-structure a freeform prompt into RTCFC fields.
 * @param {{ text: string, force?: boolean }} body
 * @returns {Promise<{
 *   success: boolean,
 *   data?: {
 *     role?: string,
 *     task?: string,
 *     context?: string,
 *     format?: string,
 *     constraints?: string,
 *   },
 *   error?: string,
 * }>}
 */
export async function structureRtcfc(body) {
  const text = String(body?.text || "").trim().slice(0, 8000);
  const payload = { text };
  if (body?.force === true) payload.force = true;
  return meanboxFetch("/api/rtcfc/structure", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
