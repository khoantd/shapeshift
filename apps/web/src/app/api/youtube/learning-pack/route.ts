import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import {
  LearningPackConfigError,
  LearningPackUpstreamError,
  parseLearningPackRequest,
  runYouTubeLearningPack,
} from "@/lib/youtube/learningPack";
import { saveLearningPackHistory } from "@/lib/youtube/learningPackHistory";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = parseLearningPackRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const result = await runYouTubeLearningPack(parsed.data, request.signal);

    const ensured = await ensureYouTubeOAuthIdentity(request);
    let saved = false;
    if (ensured.identity) {
      const row = await saveLearningPackHistory({
        googleSub: ensured.identity.sub,
        email: ensured.identity.email,
        videoId: parsed.data.videoId,
        videoTitle: parsed.data.title,
        channelTitle: parsed.data.channelTitle ?? null,
        markdown: result.text,
        transcript: parsed.data.transcript,
      });
      saved = Boolean(row?.id);
    }

    const res = NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
      responseId: result.responseId,
      cached: result.cached,
      contentType: parsed.data.contentType,
      language: parsed.data.language ?? "en",
      videoId: parsed.data.videoId,
      saved,
    });

    if (ensured.cookiesToSet) {
      applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
    }

    return res;
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (err instanceof LearningPackConfigError || err instanceof LearningPackUpstreamError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.warn(
      `[youtube-learning-pack] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate learning pack" },
      { status: 502 },
    );
  }
}
