import "server-only";

import { formatCaptionTimestamp } from "./captionFormat";

const SERP_URL = "https://serpapi.com/search.json";

type SerpTranscriptLine = {
  start_ms?: number;
  snippet?: string;
  start_time_text?: string;
};

export function serpApiTranscriptConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

function lineFromSerp(row: SerpTranscriptLine): string | null {
  const snippet = (row.snippet ?? "").replace(/\s+/g, " ").trim();
  if (!snippet) return null;
  const ms = typeof row.start_ms === "number" ? row.start_ms : NaN;
  if (Number.isFinite(ms)) {
    return `[${formatCaptionTimestamp(ms / 1000)}] ${snippet}`;
  }
  const label = (row.start_time_text ?? "").trim();
  if (label) {
    return `[${label}] ${snippet}`;
  }
  return snippet;
}

/**
 * Fetch captions via SerpAPI (works from cloud IPs; uses SERPAPI_API_KEY).
 * @see https://serpapi.com/youtube-video-transcript
 */
export async function fetchTranscriptViaSerpApi(
  videoId: string,
  opts?: { preferLangs?: string[]; signal?: AbortSignal },
): Promise<{ text: string; language?: string } | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const langs = opts?.preferLangs?.length ? opts.preferLangs : ["en", "vi"];
  const attempts = [...langs, undefined] as (string | undefined)[];

  for (const languageCode of attempts) {
    const url = new URL(SERP_URL);
    url.searchParams.set("engine", "youtube_video_transcript");
    url.searchParams.set("v", videoId);
    url.searchParams.set("api_key", apiKey);
    if (languageCode) {
      url.searchParams.set("language_code", languageCode);
    }

    try {
      const res = await fetch(url.toString(), { signal: opts?.signal });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        error?: string;
        transcript?: SerpTranscriptLine[];
      };
      if (data.error || !Array.isArray(data.transcript) || data.transcript.length === 0) {
        continue;
      }
      const lines = data.transcript
        .map(lineFromSerp)
        .filter((l): l is string => Boolean(l));
      const text = lines.join("\n").trim();
      if (!text) continue;
      return { text, language: languageCode };
    } catch {
      continue;
    }
  }

  return null;
}
