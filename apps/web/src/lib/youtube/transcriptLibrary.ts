import "server-only";

import { YoutubeTranscript } from "youtube-transcript";
import { mapLibrarySegmentsToText } from "./captionFormat";
import {
  DEFAULT_TRANSCRIPT_PREFER_LANGS,
  isAcceptableTranscriptLanguage,
} from "./captionLanguage";

const ANDROID_UA =
  "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";

/** Use Android UA for InnerTube + signed caption URLs (works better from datacenter IPs). */
function androidFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", ANDROID_UA);
  if (!headers.has("Referer")) {
    headers.set("Referer", "https://www.youtube.com/");
  }
  return fetch(input, { ...init, headers });
}

export type LibraryTranscriptResult =
  | { ok: true; text: string; language?: string }
  | {
      ok: false;
      reason: "no_transcript" | "network_blocked" | "empty" | "parse_error";
      message?: string;
    };

/**
 * Public-video captions via `youtube-transcript` (same approach as litellm-aid-studio).
 * Does not use YouTube Data API — works for third-party videos when captions exist.
 * Only returns preferred languages (no "any language" fallback — that often yields auto-translate).
 */
export async function fetchTranscriptViaLibrary(
  videoId: string,
  opts?: { preferLangs?: string[] },
): Promise<LibraryTranscriptResult> {
  const langs = opts?.preferLangs?.length
    ? opts.preferLangs
    : [...DEFAULT_TRANSCRIPT_PREFER_LANGS];
  let lastFail: LibraryTranscriptResult | null = null;

  for (const lang of langs) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, {
        lang,
        fetch: androidFetch,
      });
      if (!items?.length) {
        lastFail = { ok: false, reason: "empty" };
        continue;
      }
      const text = mapLibrarySegmentsToText(
        items.map((i) => ({ text: i.text, offset: i.offset })),
      );
      if (!text) {
        lastFail = { ok: false, reason: "empty" };
        continue;
      }
      if (
        !isAcceptableTranscriptLanguage({
          language: lang,
          text,
          preferLangs: langs,
        })
      ) {
        lastFail = { ok: false, reason: "no_transcript" };
        continue;
      }
      return { ok: true, text, language: lang };
    } catch (err) {
      const mapped = mapLibraryError(err);
      if (!mapped.ok && mapped.reason === "no_transcript") {
        lastFail = mapped;
        continue;
      }
      // network / rate limit — stop early
      return mapped;
    }
  }

  return lastFail ?? { ok: false, reason: "no_transcript" };
}

function mapLibraryError(err: unknown): LibraryTranscriptResult {
  const name = err instanceof Error ? err.constructor.name : "";
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    name.includes("NotAvailable") ||
    name.includes("Disabled") ||
    name.includes("Unavailable") ||
    name.includes("NotAvailableLanguage") ||
    lower.includes("transcript is disabled") ||
    lower.includes("no transcripts") ||
    lower.includes("not available")
  ) {
    return { ok: false, reason: "no_transcript", message };
  }

  if (
    name.includes("TooManyRequest") ||
    lower.includes("too many requests") ||
    lower.includes("captcha")
  ) {
    return { ok: false, reason: "network_blocked", message };
  }

  return { ok: false, reason: "network_blocked", message };
}
