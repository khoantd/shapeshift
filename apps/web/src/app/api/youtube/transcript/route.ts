import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeTranscript } from "@/lib/youtube/transcript";
import { extractYouTubeVideoId } from "@/lib/youtube/url";
import { youtubeOAuthClientConfigured, youtubeOAuthEnvConfigured } from "@/lib/youtube/oauth";
import { serpApiTranscriptConfigured } from "@/lib/youtube/serpapiTranscript";
import { textFlowTranscriptConfigured } from "@/lib/youtube/textflowTranscript";
import { applyYouTubeOAuthCookies } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

function resolveVideoId(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const direct = raw.trim();
  if (/^[\w-]{11}$/.test(direct)) return direct;
  return extractYouTubeVideoId(direct);
}

async function handle(request: NextRequest, videoIdRaw: string | null) {
  const videoId = resolveVideoId(videoIdRaw);
  if (!videoId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_ID", message: "videoId required (11-char id or URL)" },
      },
      { status: 400 },
    );
  }

  const result = await fetchYouTubeTranscript(videoId, {
    signal: request.signal,
    request,
  });

  if (result.status !== "ok") {
    const oauthNote =
      youtubeOAuthClientConfigured() || youtubeOAuthEnvConfigured()
        ? " Data API only works for videos your Google account owns — Sign in with Google on this page."
        : "";
    const res = NextResponse.json({
      success: false,
      status: "failed",
      reason: result.reason ?? "no_transcript",
      message:
        result.reason === "network_blocked"
          ? `Could not fetch captions from this host.${oauthNote} Paste the transcript from YouTube (⋯ → Show transcript).`
          : result.reason === "oauth_forbidden"
            ? "YouTube Data API denied caption access (ownership or OAuth). Sign in with Google for videos you own, or paste the transcript."
            : result.reason === "no_transcript"
              ? `No captions available to fetch.${oauthNote}${
                  textFlowTranscriptConfigured() || serpApiTranscriptConfigured()
                    ? ""
                    : " YouTube often blocks cloud servers — set TEXTFLOW_API_URL + TEXTFLOW_API_KEY (TextFlow proxy) or SERPAPI_API_KEY for automatic transcripts on production, or paste the transcript."
                } Paste the transcript instead.`
              : "Could not parse captions. Paste the transcript instead.",
    });
    return res;
  }

  const res = NextResponse.json({
    success: true,
    status: "ok",
    text: result.text,
    language: result.language ?? null,
    truncated: result.truncated ?? false,
    source: result.source ?? null,
  });
  if (result.refreshedSession) {
    applyYouTubeOAuthCookies(res, result.refreshedSession);
  }
  return res;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  return handle(request, videoId);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : null;
  return handle(request, videoId);
}
