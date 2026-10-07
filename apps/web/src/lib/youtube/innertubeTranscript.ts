import "server-only";

import { parseCaptionBody } from "./captionFormat";
import {
  DEFAULT_TRANSCRIPT_PREFER_LANGS,
  pickPreferredCaptionTrack,
} from "./captionLanguage";

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

/** Client contexts that tend to work from serverless / datacenter IPs. */
const INNERTUBE_CLIENTS = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    clientName: "IOS",
    clientVersion: "20.10.38",
    userAgent:
      "com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)",
  },
  {
    clientName: "WEB",
    clientVersion: "2.20250301.00.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
] as const;

function tracksFromPlayerJson(data: unknown): CaptionTrack[] {
  if (!data || typeof data !== "object") return [];
  const renderer = (data as { captions?: { playerCaptionsTracklistRenderer?: unknown } })
    .captions?.playerCaptionsTracklistRenderer;
  if (!renderer || typeof renderer !== "object") return [];
  const raw = (renderer as { captionTracks?: unknown }).captionTracks;
  if (!Array.isArray(raw)) return [];
  const out: CaptionTrack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const baseUrl = typeof t.baseUrl === "string" ? t.baseUrl : "";
    const languageCode = typeof t.languageCode === "string" ? t.languageCode : "";
    if (!baseUrl || !languageCode) continue;
    out.push({
      baseUrl: baseUrl.replace(/\\u0026/g, "&").replace(/\\\//g, "/"),
      languageCode,
      kind: typeof t.kind === "string" ? t.kind : undefined,
    });
  }
  return out;
}

async function playerResponse(
  videoId: string,
  client: (typeof INNERTUBE_CLIENTS)[number],
  signal?: AbortSignal,
): Promise<unknown | null> {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": client.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: client.clientName,
            clientVersion: client.clientVersion,
          },
        },
        videoId,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function captionDownloadUrls(baseUrl: string): string[] {
  const base = baseUrl.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  const withoutFmt = base.replace(/([?&])fmt=[^&]*/g, "$1").replace(/[?&]$/, "");
  const join = withoutFmt.includes("?") ? "&" : "?";
  const fmts = ["json3", "srv3", "vtt"];
  const urls = fmts.map((fmt) => {
    if (/[?&]fmt=/.test(base)) {
      return base.replace(/([?&])fmt=[^&]*/, `$1fmt=${fmt}`);
    }
    return `${withoutFmt}${join}fmt=${fmt}`;
  });
  return [...new Set([base, ...urls])];
}

async function downloadCaptions(
  track: CaptionTrack,
  userAgent: string,
  signal?: AbortSignal,
): Promise<string | null> {
  for (const url of captionDownloadUrls(track.baseUrl)) {
    try {
      const res = await fetch(url, {
        signal,
        headers: {
          "User-Agent": userAgent,
          Referer: "https://www.youtube.com/",
          Accept: "application/json, text/xml, text/vtt, */*",
        },
      });
      if (!res.ok) continue;
      const body = await res.text();
      if (body.length >= 20 && parseCaptionBody(body).trim()) {
        return body;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetch public captions via YouTube InnerTube player API + signed timedtext URL.
 * Prefer this on serverless hosts where HTML scrape / bare timedtext often return empty.
 */
export type InnerTubeTranscriptOk = {
  text: string;
  language: string;
};

export async function fetchTranscriptViaInnerTube(
  videoId: string,
  opts?: { preferLangs?: string[]; signal?: AbortSignal },
): Promise<InnerTubeTranscriptOk | null> {
  const preferLangs = opts?.preferLangs?.length
    ? opts.preferLangs
    : [...DEFAULT_TRANSCRIPT_PREFER_LANGS];

  for (const client of INNERTUBE_CLIENTS) {
    const data = await playerResponse(videoId, client, opts?.signal);
    const tracks = tracksFromPlayerJson(data);
    if (tracks.length === 0) continue;

    const track = pickPreferredCaptionTrack(tracks, preferLangs);
    if (!track) continue;

    const body = await downloadCaptions(track, client.userAgent, opts?.signal);
    if (!body) continue;

    const text = parseCaptionBody(body);
    if (!text.trim()) continue;

    return { text, language: track.languageCode };
  }

  return null;
}
