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
 * @returns {Promise<string>}
 */
async function sessionCookieHeaderFor(apiBase) {
  try {
    if (typeof browser === "undefined" || !browser.cookies?.getAll) {
      return "";
    }
    const list = await browser.cookies.getAll({ url: `${apiBase}/` });
    return buildSessionCookieHeader(list);
  } catch {
    return "";
  }
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
  const sessionCookie = await sessionCookieHeaderFor(apiBase);
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(sessionCookie
        ? { [MEANBOX_SESSION_COOKIE_HEADER]: sessionCookie }
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
