/** Thin client for Meanbox BFF routes. */

import { loadSettings } from "./settings";
import { type IntentResult, type NewsFeedItem } from "./apiCore";
import {
  MEANBOX_SESSION_COOKIE_HEADER,
  loadSession,
} from "./session";

export type { IntentResult, NewsFeedItem } from "./apiCore";

export {
  formatRelativeTime,
  intentTopKey,
  languageFromLocale,
  newsCategoryMatch,
  oauthStartUrl,
} from "./apiCore";

export type MeanboxApiError = Error & {
  status?: number;
  data?: unknown;
};

export type NewsFeedResponse = {
  success: boolean;
  items: NewsFeedItem[];
  sources: Array<{ id: string; name: string; enabled: boolean }>;
  error?: string;
};

export type DeepDiveResponse = {
  success: boolean;
  text?: string;
  sources?: Array<{ title: string; url: string; id?: number }>;
  language?: string;
  cached?: boolean;
  persisted?: boolean;
  error?: string;
};

export type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  duration?: string;
};

export type LearningPackResponse = {
  success: boolean;
  text?: string;
  saved?: boolean;
  historyPackId?: string | null;
  saveError?: string | null;
  error?: string;
};

type FetchInit = RequestInit & {
  query?: Record<string, string | number | undefined | null>;
  apiBase?: string;
};

export async function meanboxFetch<T = unknown>(
  path: string,
  init: FetchInit = {},
): Promise<T> {
  const settings = await loadSettings();
  const apiBase = normalizeOverrideBase(init.apiBase) || settings.apiBase;
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase}/`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  const { query: _q, apiBase: _b, ...rest } = init;
  const session = await loadSession();
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.bridge
        ? { [MEANBOX_SESSION_COOKIE_HEADER]: session.bridge }
        : {}),
      ...(rest.headers || {}),
    },
  });
  const data = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      data !== null &&
      ("error" in data || "message" in data)
        ? extractErrorMessage(data)
        : `HTTP ${res.status}`;
    const err = new Error(msg) as MeanboxApiError;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function normalizeOverrideBase(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  try {
    return new URL(raw.trim().replace(/\/+$/, "")).origin;
  } catch {
    return "";
  }
}

function extractErrorMessage(data: object): string {
  const d = data as {
    error?: { message?: string } | string;
    message?: string;
  };
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (
    d.error &&
    typeof d.error === "object" &&
    typeof d.error.message === "string"
  ) {
    return d.error.message;
  }
  if (typeof d.message === "string" && d.message.trim()) return d.message;
  return "Request failed";
}

export function fetchNews(opts: {
  q?: string;
  limit?: number;
  apiBase?: string;
} = {}) {
  return meanboxFetch<NewsFeedResponse>("/api/news", {
    query: { q: opts.q, limit: opts.limit ?? 50 },
    apiBase: opts.apiBase,
  });
}

export function generateNewsDeepDive(body: {
  title: string;
  excerpt: string;
  canonicalUrl?: string;
  id?: string;
  language?: "en" | "vi";
  force?: boolean;
  apiBase?: string;
}) {
  const payload: Record<string, unknown> = {
    title: String(body.title || "").trim().slice(0, 500),
    excerpt: String(body.excerpt || "").trim().slice(0, 4000),
    language: body.language === "vi" ? "vi" : "en",
  };
  const canonicalUrl = String(body.canonicalUrl || "").trim().slice(0, 2000);
  if (canonicalUrl) payload.canonicalUrl = canonicalUrl;
  const id = String(body.id || "").trim().slice(0, 128);
  if (id) payload.id = id;
  if (body.force === true) payload.force = true;
  return meanboxFetch<DeepDiveResponse>("/api/news/deep-dive", {
    method: "POST",
    body: JSON.stringify(payload),
    apiBase: body.apiBase,
  });
}

export function searchYouTube(q: string, apiBase?: string) {
  return meanboxFetch<{
    success: boolean;
    videos: YouTubeVideo[];
    mode?: string;
    error?: string;
  }>("/api/youtube/search", {
    query: { q },
    apiBase,
  });
}

export function fetchVideoDetails(videoId: string, apiBase?: string) {
  return meanboxFetch<{ success: boolean; video?: YouTubeVideo; error?: string }>(
    "/api/youtube/details",
    { query: { videoId }, apiBase },
  );
}

export function fetchTranscript(videoId: string, apiBase?: string) {
  return meanboxFetch<{
    success: boolean;
    text?: string;
    language?: string;
    error?: string;
  }>("/api/youtube/transcript", { query: { videoId }, apiBase });
}

export function generateLearningPack(body: {
  videoId: string;
  title: string;
  channelTitle?: string;
  contentType?: string;
  transcript: string;
  language?: string;
  apiBase?: string;
}) {
  return meanboxFetch<LearningPackResponse>("/api/youtube/learning-pack", {
    method: "POST",
    body: JSON.stringify({
      contentType: "lecture",
      language: "en",
      ...body,
    }),
    apiBase: body.apiBase,
  });
}

export async function fetchSavedLearningPack(
  videoId: string,
  apiBase?: string,
): Promise<{
  success?: boolean;
  pack?: { markdown?: string } | null;
  unauthorized?: boolean;
}> {
  try {
    return await meanboxFetch("/api/youtube/learning-packs", {
      query: { videoId },
      apiBase,
    });
  } catch (err) {
    const e = err as MeanboxApiError;
    if (e.status === 401) {
      return { success: false, pack: null, unauthorized: true };
    }
    throw err;
  }
}

export function fetchOAuthSession(apiBase?: string) {
  return meanboxFetch<{
    success: boolean;
    connected: boolean;
    email: string | null;
    hasSub?: boolean;
    clientConfigured?: boolean;
  }>("/api/youtube/oauth/session", { apiBase });
}

export function classifyIntent(text: string, apiBase?: string) {
  return meanboxFetch<IntentResult>("/api/intent", {
    method: "POST",
    body: JSON.stringify({ text: String(text || "").trim().slice(0, 2000) }),
    apiBase,
  });
}

export function structureRtcfc(body: {
  text: string;
  force?: boolean;
  apiBase?: string;
}) {
  const text = String(body.text || "").trim().slice(0, 8000);
  const payload: Record<string, unknown> = { text };
  if (body.force === true) payload.force = true;
  return meanboxFetch<{
    success: boolean;
    data?: {
      role?: string;
      task?: string;
      context?: string;
      format?: string;
      constraints?: string;
    };
    error?: string;
  }>("/api/rtcfc/structure", {
    method: "POST",
    body: JSON.stringify(payload),
    apiBase: body.apiBase,
  });
}
