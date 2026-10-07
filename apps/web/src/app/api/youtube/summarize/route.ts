import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
  YT_COOKIE_ACCESS,
  YT_COOKIE_REFRESH,
} from "@/lib/youtube/oauthSession";
import {
  getTranscriptSummaryHistory,
  saveTranscriptSummaryHistory,
} from "@/lib/youtube/transcriptSummaryHistory";
import {
  parseTranscriptSummaryRequest,
  runYouTubeTranscriptSummary,
  TranscriptSummaryConfigError,
  TranscriptSummaryUpstreamError,
} from "@/lib/youtube/transcriptSummary";

export const runtime = "nodejs";

/** Load saved VN/EN summaries for a video (signed-in user). */
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() ?? "";
  if (!/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { success: false, error: "videoId must be an 11-character YouTube id" },
      { status: 400 },
    );
  }

  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error: "Sign in with Google to load saved summaries",
      },
      { status: 401 },
    );
  }

  const result = await getTranscriptSummaryHistory(ensured.identity.sub, videoId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  const row = result.data;
  const res = NextResponse.json({
    success: true,
    videoId,
    summaryVi: row?.summaryVi ?? null,
    summaryEn: row?.summaryEn ?? null,
    updatedAt: row?.updatedAt ?? null,
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}

export async function POST(request: NextRequest) {
  const parsed = parseTranscriptSummaryRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const result = await runYouTubeTranscriptSummary(parsed.data, request.signal);

    const ensured = await ensureYouTubeOAuthIdentity(request);
    let saved = false;
    let saveError: string | null = null;
    if (ensured.identity) {
      const row = await saveTranscriptSummaryHistory({
        googleSub: ensured.identity.sub,
        email: ensured.identity.email,
        videoId: parsed.data.videoId,
        videoTitle: parsed.data.title,
        channelTitle: parsed.data.channelTitle ?? null,
        language: parsed.data.language,
        markdown: result.text,
        transcript: parsed.data.transcript,
      });
      if (row.ok) {
        saved = true;
      } else {
        saveError = row.message;
      }
    } else if (
      ensured.cookiesToSet ||
      request.cookies.get(YT_COOKIE_ACCESS) ||
      request.cookies.get(YT_COOKIE_REFRESH)
    ) {
      saveError =
        "Sign out and sign in again, then re-summarize to save this summary.";
    }

    const res = NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
      responseId: result.responseId,
      cached: result.cached,
      language: parsed.data.language,
      videoId: parsed.data.videoId,
      saved,
      saveError: saved ? null : saveError,
    });

    if (ensured.cookiesToSet) {
      applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
    }

    return res;
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (
      err instanceof TranscriptSummaryConfigError ||
      err instanceof TranscriptSummaryUpstreamError
    ) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.warn(
      `[youtube-summarize] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate summary" },
      { status: 502 },
    );
  }
}
