import "server-only";

import { YoutubeTranscript } from "youtube-transcript";
import { mapLibrarySegmentsToText } from "./captionFormat";

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
 */
export async function fetchTranscriptViaLibrary(
  videoId: string,
  opts?: { preferLangs?: string[] },
): Promise<LibraryTranscriptResult> {
  const langs = opts?.preferLangs?.length ? opts.preferLangs : ["en", "vi"];
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
      return { ok: true, text, language: lang };
    } catch (err) {
      const mapped = mapLibraryError(err);
      if (!mapped.ok && mapped.reason === "no_transcript") {
        // try next preferred language
        lastFail = mapped;
        continue;
      }
      // network / rate limit — stop early
      return mapped;
    }
  }

  // Last attempt: any available language (library default)
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { fetch: androidFetch });
    if (!items?.length) {
      return lastFail ?? { ok: false, reason: "empty" };
    }
    const text = mapLibrarySegmentsToText(
      items.map((i) => ({ text: i.text, offset: i.offset })),
    );
    if (!text) return lastFail ?? { ok: false, reason: "empty" };
    return { ok: true, text, language: items[0]?.lang };
  } catch (err) {
    return lastFail ?? mapLibraryError(err);
  }
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
