import "server-only";

import { DEFAULT_TRANSCRIPT_PREFER_LANGS } from "./captionLanguage";
import { parseTextFlowTranscriptResponse } from "./textflowTranscriptParse";
import { textFlowTranscriptProxyUrl } from "./textflowTranscriptUrl";

export { parseTextFlowTranscriptResponse } from "./textflowTranscriptParse";

const DEFAULT_TIMEOUT_MS = 45_000;
const VIDEO_ID_RE = /^[\w-]{11}$/;

export function textFlowTranscriptConfigured(): boolean {
  return Boolean(
    process.env.TEXTFLOW_API_URL?.trim() && process.env.TEXTFLOW_API_KEY?.trim(),
  );
}

function baseUrl(): string {
  return (process.env.TEXTFLOW_API_URL ?? "").trim().replace(/\/$/, "");
}

function apiKey(): string {
  return (process.env.TEXTFLOW_API_KEY ?? "").trim();
}

/**
 * Fetch captions via TextFlow (litellm-aid-studio) transcript proxy.
 * Use when Vercel/cloud IPs are blocked by YouTube — TextFlow should run on a host that can scrape.
 *
 * Env: TEXTFLOW_API_URL (e.g. https://textflow.sutools.app or https://textflow.sutools.app/api)
 *      TEXTFLOW_API_KEY  (must match TextFlow TEXTFLOW_SERVICE_KEY)
 */
export async function fetchTranscriptViaTextFlow(
  videoId: string,
  opts?: { preferLangs?: string[]; signal?: AbortSignal },
): Promise<{ text: string; language?: string } | null> {
  if (!textFlowTranscriptConfigured()) return null;
  const id = videoId.trim();
  if (!VIDEO_ID_RE.test(id)) return null;

  const url = textFlowTranscriptProxyUrl(baseUrl());
  if (!url) return null;
  const preferLangs = opts?.preferLangs?.length
    ? opts.preferLangs
    : [...DEFAULT_TRANSCRIPT_PREFER_LANGS];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts?.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-TextFlow-Key": apiKey(),
      },
      body: JSON.stringify({
        videoId: id,
        preferLangs,
        lang: preferLangs[0] ?? "en",
      }),
    });

    const data = await res.json().catch(() => null);
    const parsed = parseTextFlowTranscriptResponse(data);
    if (!res.ok || !parsed) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    opts?.signal?.removeEventListener("abort", onAbort);
  }
}
