import { NextRequest, NextResponse } from "next/server";
import {
  getLearningPackByVideo,
  listLearningPackHistory,
} from "@/lib/youtube/learningPackHistory";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

function packJson(pack: {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoTitle: string;
  channelTitle: string | null;
  contentType: string | null;
  conceptCount: number;
  termCount: number;
  markdown: string;
  transcript: string | null;
  graphPayload: unknown;
  createdAt: number;
}) {
  return {
    id: pack.id,
    videoId: pack.videoId,
    videoUrl: pack.videoUrl,
    thumbnailUrl: pack.thumbnailUrl,
    videoTitle: pack.videoTitle,
    channelTitle: pack.channelTitle,
    contentType: pack.contentType,
    conceptCount: pack.conceptCount,
    termCount: pack.termCount,
    markdown: pack.markdown,
    transcript: pack.transcript,
    graphPayload: pack.graphPayload,
    createdAt: pack.createdAt,
  };
}

/** List saved packs, or one pack when `?videoId=` is set. Heals missing yt_oauth_sub. */
export async function GET(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Sign in with Google to view history (or sign out and back in to refresh your session)",
      },
      { status: 401 },
    );
  }

  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() ?? "";

  if (videoId) {
    if (!/^[\w-]{11}$/.test(videoId)) {
      return NextResponse.json(
        { success: false, error: "Invalid videoId" },
        { status: 400 },
      );
    }
    const result = await getLearningPackByVideo(
      ensured.identity.sub,
      videoId,
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: result.reason === "not_configured" ? 503 : 502 },
      );
    }
    const res = NextResponse.json({
      success: true,
      pack: result.data ? packJson(result.data) : null,
    });
    if (ensured.cookiesToSet) {
      applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
    }
    return res;
  }

  const result = await listLearningPackHistory(ensured.identity.sub);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  const res = NextResponse.json({
    success: true,
    packs: result.data.map(packJson),
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}
