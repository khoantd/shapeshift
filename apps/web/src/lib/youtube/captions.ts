import "server-only";

import type { NextRequest } from "next/server";
import {
  pickApiCaptionTrack,
  parseSrtToTranscript,
  type ApiCaptionTrack,
} from "./captionFormat";
import { youtubeOAuthClientConfigured, youtubeOAuthEnvConfigured } from "./oauth";
import { resolveYouTubeAccessToken } from "./oauthSession";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type CaptionsApiResult =
  | {
      ok: true;
      text: string;
      language: string;
      trackId: string;
      /** Cookie refresh payload if access token was renewed from session. */
      refreshedSession?: {
        accessToken: string;
        refreshToken: string | null;
        expiresIn: number;
        email: string | null;
        sub: string | null;
      };
    }
  | {
      ok: false;
      reason: "oauth_not_configured" | "oauth_forbidden" | "no_transcript" | "parse_error" | "upstream";
      message?: string;
    };

type CaptionListItem = {
  id?: string;
  snippet?: {
    language?: string;
    trackKind?: string;
    name?: string;
    status?: string;
  };
};

/**
 * Fetch caption text via captions.list + captions.download (tfmt=srt).
 * Uses user session OAuth first, then env refresh token.
 */
export async function fetchTranscriptViaDataApi(
  videoId: string,
  opts?: { preferLangs?: string[]; signal?: AbortSignal; request?: NextRequest },
): Promise<CaptionsApiResult> {
  if (!youtubeOAuthClientConfigured() && !youtubeOAuthEnvConfigured()) {
    return { ok: false, reason: "oauth_not_configured" };
  }

  const resolved = await resolveYouTubeAccessToken({
    request: opts?.request,
    signal: opts?.signal,
  });

  if (!resolved.accessToken) {
    return {
      ok: false,
      reason: "oauth_not_configured",
      message: "Sign in with Google to load captions for videos you own, or paste the transcript.",
    };
  }

  const accessToken = resolved.accessToken;

  const listUrl = new URL(`${YT_API}/captions`);
  listUrl.searchParams.set("part", "snippet");
  listUrl.searchParams.set("videoId", videoId);

  let listRes: Response;
  try {
    listRes = await fetch(listUrl.toString(), {
      signal: opts?.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, reason: "upstream", message: "captions.list network error" };
  }

  if (listRes.status === 401 || listRes.status === 403) {
    return {
      ok: false,
      reason: "oauth_forbidden",
      message: `captions.list returned ${listRes.status} — check OAuth scopes and video ownership`,
    };
  }

  if (!listRes.ok) {
    return {
      ok: false,
      reason: "upstream",
      message: `captions.list HTTP ${listRes.status}`,
    };
  }

  const listJson = (await listRes.json().catch(() => null)) as {
    items?: CaptionListItem[];
  } | null;

  const tracks: ApiCaptionTrack[] = [];
  for (const item of listJson?.items ?? []) {
    const id = item.id?.trim();
    const language = item.snippet?.language?.trim();
    if (!id || !language) continue;
    const status = (item.snippet?.status ?? "").toLowerCase();
    if (status && status !== "serving") continue;
    tracks.push({
      id,
      language,
      trackKind: item.snippet?.trackKind,
      name: item.snippet?.name,
    });
  }

  const picked = pickApiCaptionTrack(tracks, opts?.preferLangs);
  if (!picked) {
    return { ok: false, reason: "no_transcript" };
  }

  const dlUrl = new URL(`${YT_API}/captions/${encodeURIComponent(picked.id)}`);
  dlUrl.searchParams.set("tfmt", "srt");

  let dlRes: Response;
  try {
    dlRes = await fetch(dlUrl.toString(), {
      signal: opts?.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, reason: "upstream", message: "captions.download network error" };
  }

  if (dlRes.status === 401 || dlRes.status === 403) {
    return {
      ok: false,
      reason: "oauth_forbidden",
      message: `captions.download returned ${dlRes.status} — video may not be owned by this account`,
    };
  }

  if (!dlRes.ok) {
    return {
      ok: false,
      reason: "upstream",
      message: `captions.download HTTP ${dlRes.status}`,
    };
  }

  const srt = await dlRes.text();
  const text = parseSrtToTranscript(srt);
  if (!text) {
    return { ok: false, reason: "parse_error" };
  }

  return {
    ok: true,
    text,
    language: picked.language,
    trackId: picked.id,
    ...(resolved.refreshed ? { refreshedSession: resolved.refreshed } : {}),
  };
}
