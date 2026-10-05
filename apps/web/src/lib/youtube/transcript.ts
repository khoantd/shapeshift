import "server-only";

import type { NextRequest } from "next/server";
import { fetchTranscriptViaDataApi } from "./captions";
import { parseCaptionBody } from "./captionFormat";
import { fetchTranscriptViaInnerTube } from "./innertubeTranscript";
import { youtubeOAuthClientConfigured, youtubeOAuthEnvConfigured } from "./oauth";
import { fetchTranscriptViaSerpApi } from "./serpapiTranscript";
import { fetchTranscriptViaTextFlow } from "./textflowTranscript";
import { fetchTranscriptViaLibrary } from "./transcriptLibrary";

export const TRANSCRIPT_MAX_CHARS = 100_000;

export type TranscriptFetchStatus = "ok" | "failed";

export type TranscriptSource =
  | "youtube_data_api"
  | "youtube_transcript"
  | "innertube"
  | "textflow"
  | "serpapi"
  | "timedtext";

export type TranscriptFetchResult = {
  status: TranscriptFetchStatus;
  reason?:
    | "network_blocked"
    | "no_transcript"
    | "parse_error"
    | "invalid_id"
    | "empty"
    | "oauth_forbidden";
  text?: string;
  language?: string;
  truncated?: boolean;
  source?: TranscriptSource;
  refreshedSession?: {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    email: string | null;
    sub: string | null;
  };
};

const VIDEO_ID_RE = /^[\w-]{11}$/;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
  Referer: "https://www.youtube.com/",
};

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

function unescapeCaptionUrl(url: string): string {
  return url
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\u003d/g, "=");
}

/** Balanced-brace extract of a JS object assigned to varName in HTML. */
function extractJsonObject(html: string, varName: string): unknown | null {
  const startPattern = new RegExp(`${varName}\\s*=\\s*\\{`, "i");
  const startMatch = html.search(startPattern);
  if (startMatch < 0) return null;
  const startPos = html.indexOf("{", startMatch);
  if (startPos < 0) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let stringChar = "";

  for (let i = startPos; i < html.length && i < startPos + 2_000_000; i++) {
    const ch = html[i]!;
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar) {
      inString = false;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(startPos, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function tracksFromUnknown(obj: unknown): CaptionTrack[] {
  if (!obj || typeof obj !== "object") return [];
  const find = (node: unknown): CaptionTrack[] => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) {
      const tracks: CaptionTrack[] = [];
      for (const item of node) {
        if (!item || typeof item !== "object") continue;
        const t = item as Record<string, unknown>;
        const baseUrl = typeof t.baseUrl === "string" ? unescapeCaptionUrl(t.baseUrl) : "";
        const languageCode = typeof t.languageCode === "string" ? t.languageCode : "";
        if (baseUrl && languageCode) {
          tracks.push({
            baseUrl,
            languageCode,
            kind: typeof t.kind === "string" ? t.kind : undefined,
          });
        }
      }
      if (tracks.length) return tracks;
      return [];
    }
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.captionTracks)) {
      return find(rec.captionTracks);
    }
    for (const v of Object.values(rec)) {
      const hit = find(v);
      if (hit.length) return hit;
    }
    return [];
  };
  return find(obj);
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  // Prefer player response object
  for (const name of [
    "ytInitialPlayerResponse",
    "var ytInitialPlayerResponse",
  ]) {
    const player = extractJsonObject(html, name.replace(/^var\s+/, ""));
    if (player) {
      const fromPlayer = tracksFromUnknown(
        (player as { captions?: unknown }).captions ?? player,
      );
      if (fromPlayer.length) return fromPlayer;
    }
  }

  // Fallback: "captionTracks":[ ... ]
  const marker = '"captionTracks":';
  const idx = html.indexOf(marker);
  if (idx >= 0) {
    const start = idx + marker.length - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < html.length && i < start + 200_000; i++) {
      const ch = html[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end > 0) {
      try {
        const parsed = JSON.parse(html.slice(start, end)) as unknown;
        const tracks = tracksFromUnknown(parsed);
        if (tracks.length) return tracks;
      } catch {
        // continue
      }
    }
  }

  return [];
}

function pickTrack(tracks: CaptionTrack[], preferLangs: string[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  for (const lang of preferLangs) {
    const hit = tracks.find((t) => t.languageCode.toLowerCase().startsWith(lang.toLowerCase()));
    if (hit) return hit;
  }
  const manual = tracks.find((t) => (t.kind ?? "").toLowerCase() !== "asr");
  return manual ?? tracks[0] ?? null;
}

function truncateTranscript(text: string): { text: string; truncated: boolean } {
  if (text.length <= TRANSCRIPT_MAX_CHARS) return { text, truncated: false };
  return {
    text:
      text.slice(0, TRANSCRIPT_MAX_CHARS) +
      "\n\n[Transcript truncated — remaining content omitted for length.]",
    truncated: true,
  };
}

async function fetchPageHtml(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal,
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchCaptionUrl(
  captionUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(captionUrl, {
      signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: "https://www.youtube.com/",
        Accept: "text/vtt, application/json, text/xml, */*",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function probeManualTimedtext(
  id: string,
  preferLangs: string[],
  signal?: AbortSignal,
): Promise<TranscriptFetchResult | null> {
  const langs = [...preferLangs, "en"];
  const urls: string[] = [];
  for (const lang of langs) {
    urls.push(
      `https://www.youtube.com/api/timedtext?v=${id}&lang=${encodeURIComponent(lang)}&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${id}&lang=${encodeURIComponent(lang)}&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${id}&lang=${encodeURIComponent(lang)}&fmt=vtt`,
    );
  }
  urls.push(
    `https://www.youtube.com/api/timedtext?v=${id}&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${id}&fmt=srv3`,
  );

  for (const url of urls.slice(0, 12)) {
    const body = await fetchCaptionUrl(url, signal);
    if (!body || body.length < 20) continue;
    const text = parseCaptionBody(body);
    if (!text) continue;
    const capped = truncateTranscript(text);
    return {
      status: "ok",
      text: capped.text,
      truncated: capped.truncated,
      source: "timedtext",
    };
  }
  return null;
}

/**
 * Hardened timedtext scrape (aid-studio style): browser UA, embed-first, player JSON.
 */
async function fetchViaTimedtext(
  id: string,
  preferLangs: string[],
  signal?: AbortSignal,
): Promise<TranscriptFetchResult> {
  const embedHtml = await fetchPageHtml(
    `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
    signal,
  );
  const watchHtml =
    embedHtml ??
    (await fetchPageHtml(
      `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&hl=en`,
      signal,
    ));

  if (!watchHtml) {
    const probed = await probeManualTimedtext(id, preferLangs, signal);
    if (probed) return probed;
    return { status: "failed", reason: "network_blocked" };
  }

  // If embed had no tracks, also try watch page
  let html = watchHtml;
  let tracks = extractCaptionTracks(html);
  if (tracks.length === 0 && embedHtml) {
    const watchOnly = await fetchPageHtml(
      `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&hl=en`,
      signal,
    );
    if (watchOnly) {
      html = watchOnly;
      tracks = extractCaptionTracks(html);
    }
  }

  if (tracks.length === 0) {
    const probed = await probeManualTimedtext(id, preferLangs, signal);
    if (probed) return probed;
    return { status: "failed", reason: "no_transcript" };
  }

  const track = pickTrack(tracks, preferLangs);
  if (!track) {
    return { status: "failed", reason: "no_transcript" };
  }

  let captionUrl = unescapeCaptionUrl(track.baseUrl);
  if (!/[?&]fmt=/.test(captionUrl)) {
    captionUrl += (captionUrl.includes("?") ? "&" : "?") + "fmt=json3";
  }

  const captionBody = await fetchCaptionUrl(captionUrl, signal);
  if (!captionBody) {
    const probed = await probeManualTimedtext(id, preferLangs, signal);
    if (probed) return probed;
    return { status: "failed", reason: "network_blocked" };
  }

  const text = parseCaptionBody(captionBody);
  if (!text) {
    return { status: "failed", reason: "parse_error" };
  }

  const capped = truncateTranscript(text);
  if (!capped.text.trim()) {
    return { status: "failed", reason: "empty" };
  }

  return {
    status: "ok",
    text: capped.text,
    language: track.languageCode,
    truncated: capped.truncated,
    source: "timedtext",
  };
}

/**
 * Caption cascade (public videos):
 * InnerTube → youtube-transcript → timedtext → TextFlow proxy → SerpAPI → OAuth Data API → paste.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  opts?: { preferLangs?: string[]; signal?: AbortSignal; request?: NextRequest },
): Promise<TranscriptFetchResult> {
  const id = videoId.trim();
  if (!VIDEO_ID_RE.test(id)) {
    return { status: "failed", reason: "invalid_id" };
  }

  const preferLangs = opts?.preferLangs ?? ["en", "vi", "en-US", "en-GB"];

  const okFromText = (
    text: string,
    language: string | undefined,
    source: TranscriptSource,
    extra?: Pick<TranscriptFetchResult, "refreshedSession">,
  ): TranscriptFetchResult => {
    const capped = truncateTranscript(text);
    if (!capped.text.trim()) {
      return { status: "failed", reason: "empty" };
    }
    return {
      status: "ok",
      text: capped.text,
      language,
      truncated: capped.truncated,
      source,
      ...extra,
    };
  };

  // 1) InnerTube player API + signed caption URL (best on serverless / datacenter IPs)
  const inner = await fetchTranscriptViaInnerTube(id, {
    preferLangs,
    signal: opts?.signal,
  });
  if (inner) {
    return okFromText(inner.text, inner.language, "innertube");
  }

  // 2) Public captions via youtube-transcript
  const lib = await fetchTranscriptViaLibrary(id, { preferLangs });
  if (lib.ok) {
    return okFromText(lib.text, lib.language, "youtube_transcript");
  }

  // 3) Hardened timedtext HTML scrape
  const scraped = await fetchViaTimedtext(id, preferLangs, opts?.signal);
  if (scraped.status === "ok") {
    return scraped;
  }

  // 4) TextFlow proxy — host with a non-blocked IP (TEXTFLOW_API_URL + TEXTFLOW_API_KEY)
  const textflow = await fetchTranscriptViaTextFlow(id, { signal: opts?.signal });
  if (textflow) {
    return okFromText(textflow.text, textflow.language, "textflow");
  }

  // 5) SerpAPI — reliable from cloud IPs when YouTube blocks Vercel (uses SERPAPI_API_KEY)
  const serp = await fetchTranscriptViaSerpApi(id, {
    preferLangs,
    signal: opts?.signal,
  });
  if (serp) {
    return okFromText(serp.text, serp.language, "serpapi");
  }

  // 6) Owned-video Data API (session or env OAuth) — last resort for your uploads
  if (youtubeOAuthClientConfigured() || youtubeOAuthEnvConfigured()) {
    const api = await fetchTranscriptViaDataApi(id, {
      preferLangs,
      signal: opts?.signal,
      request: opts?.request,
    });
    if (api.ok) {
      return okFromText(api.text, api.language, "youtube_data_api", {
        ...(api.refreshedSession ? { refreshedSession: api.refreshedSession } : {}),
      });
    }
  }

  return scraped;
}

export function normalizePastedTranscript(raw: string): {
  text: string;
  truncated: boolean;
} {
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  return truncateTranscript(trimmed);
}
