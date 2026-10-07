import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { resolveVideoStudyGate } from "@shapeshift/core/server";
import { NextRequest, NextResponse } from "next/server";
import {
  LearningPackConfigError,
  LearningPackUpstreamError,
  parseLearningPackRequest,
  runYouTubeLearningPack,
  type LearningPackRequest,
} from "@/lib/youtube/learningPack";
import { saveLearningPackHistory } from "@/lib/youtube/learningPackHistory";
import { packToKnowledgeGraph } from "@/lib/youtube/packKnowledgeGraph";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
  YT_COOKIE_ACCESS,
  YT_COOKIE_REFRESH,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = parseLearningPackRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const forceOffline = process.env.NEXT_PUBLIC_USE_MOCK === "true";
    const studyGate = await resolveVideoStudyGate(
      {
        title: parsed.data.title,
        description: parsed.data.transcript.slice(0, 1500),
        channelTitle: parsed.data.channelTitle,
        topic: parsed.data.contentType,
        transcriptHead: parsed.data.transcript.slice(0, 1200),
      },
      { forceOffline, signal: request.signal },
    );

    const packInput: LearningPackRequest = {
      ...parsed.data,
      depth: parsed.data.depth ?? studyGate.depth,
      audience: parsed.data.audience ?? studyGate.audience,
    };

    const result = await runYouTubeLearningPack(packInput, request.signal);

    const graphPayload = packToKnowledgeGraph({
      videoId: packInput.videoId,
      title: packInput.title,
      channelTitle: packInput.channelTitle,
      contentType: packInput.contentType,
      markdown: result.text,
    });

    const ensured = await ensureYouTubeOAuthIdentity(request);
    let saved = false;
    let historyPackId: string | null = null;
    let saveError: string | null = null;
    if (ensured.identity) {
      const row = await saveLearningPackHistory({
        googleSub: ensured.identity.sub,
        email: ensured.identity.email,
        videoId: packInput.videoId,
        videoTitle: packInput.title,
        channelTitle: packInput.channelTitle ?? null,
        contentType: packInput.contentType,
        markdown: result.text,
        transcript: packInput.transcript,
        graphPayload,
      });
      if (row.ok) {
        saved = true;
        historyPackId = row.id;
      } else {
        saveError = row.message;
      }
    } else if (
      ensured.cookiesToSet ||
      request.cookies.get(YT_COOKIE_ACCESS) ||
      request.cookies.get(YT_COOKIE_REFRESH)
    ) {
      // Session cookies present but googleSub could not be resolved.
      saveError =
        "Sign out and sign in again, then regenerate to save this pack to history.";
    }

    const res = NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
      responseId: result.responseId,
      cached: result.cached,
      contentType: packInput.contentType,
      language: packInput.language ?? "en",
      videoId: packInput.videoId,
      depth: packInput.depth ?? null,
      audience: packInput.audience ?? null,
      studyGate: {
        depth: studyGate.depth,
        audience: studyGate.audience,
        packSuitable: studyGate.packSuitable,
        line: studyGate.line,
        source: studyGate.source,
      },
      saved,
      historyPackId,
      saveError: saved ? null : saveError,
      graphPayload,
    });

    if (ensured.cookiesToSet) {
      applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
    }

    return res;
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    if (err instanceof LearningPackConfigError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof LearningPackUpstreamError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[youtube/learning-pack] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate learning pack" },
      { status: 502 },
    );
  }
}
