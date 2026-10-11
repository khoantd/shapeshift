/** Meanbox deep-link path builders (extension → web app). */

import { parseGitHubRepoUrl, parseYouTubeVideoUrl } from "./parse.js";

const GADGETS_Q_MAX = 500;
const NEWS_Q_MAX = 200;
const PLACES_Q_MAX = 200;

/**
 * @param {string} [text]
 */
export function gadgetsPath(text = "") {
  const q = String(text || "")
    .trim()
    .slice(0, GADGETS_Q_MAX);
  return q ? `/gadgets?q=${encodeURIComponent(q)}` : "/gadgets";
}

/**
 * @param {{ q?: string, source?: string }} [opts]
 */
export function newsPath(opts = {}) {
  const params = new URLSearchParams();
  const q = String(opts.q || "")
    .trim()
    .slice(0, NEWS_Q_MAX);
  const source = String(opts.source || "").trim();
  if (q) params.set("q", q);
  if (source) params.set("source", source);
  const qs = params.toString();
  return qs ? `/news?${qs}` : "/news";
}

/**
 * @param {string} [text]
 */
export function placesPath(text = "") {
  const q = String(text || "")
    .trim()
    .slice(0, PLACES_Q_MAX);
  return q ? `/places?q=${encodeURIComponent(q)}` : "/places";
}

/**
 * Resolve omnibox input to a Meanbox app path.
 * @param {string} text
 */
export function resolveOmniboxPath(text) {
  const raw = String(text || "").trim();
  if (!raw) return "/gadgets";

  const lower = raw.toLowerCase();

  if (lower.startsWith("yt:") || lower.startsWith("youtube:")) {
    const q = raw.replace(/^(yt|youtube):\s*/i, "").trim();
    return `/youtube?q=${encodeURIComponent(q.slice(0, 200))}`;
  }
  if (lower.startsWith("gh:") || lower.startsWith("github:")) {
    const q = raw.replace(/^(gh|github):\s*/i, "").trim();
    return `/github?q=${encodeURIComponent(q.slice(0, 100))}`;
  }
  if (
    lower.startsWith("g:") ||
    lower.startsWith("gadget:") ||
    lower.startsWith("gadgets:")
  ) {
    const q = raw.replace(/^(g|gadget|gadgets):\s*/i, "").trim();
    return gadgetsPath(q);
  }
  if (lower.startsWith("news:")) {
    const q = raw.replace(/^news:\s*/i, "").trim();
    return newsPath({ q });
  }
  if (lower.startsWith("places:") || lower.startsWith("place:")) {
    const q = raw.replace(/^places?:\s*/i, "").trim();
    return placesPath(q);
  }

  if (parseYouTubeVideoUrl(raw) || /^[\w-]{11}$/.test(raw)) {
    const yt = parseYouTubeVideoUrl(raw);
    const id = yt?.videoId || raw;
    return `/youtube?videoId=${encodeURIComponent(id)}`;
  }
  if (parseGitHubRepoUrl(raw) || /^[\w.-]+\/[\w.-]+$/.test(raw)) {
    const gh = parseGitHubRepoUrl(raw);
    const repo = gh?.fullName || raw;
    return `/github?repo=${encodeURIComponent(repo)}`;
  }

  return `/github?q=${encodeURIComponent(raw.slice(0, 100))}`;
}
