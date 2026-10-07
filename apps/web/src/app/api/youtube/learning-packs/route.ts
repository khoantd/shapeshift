import { NextRequest, NextResponse } from "next/server";
import { listLearningPackHistory } from "@/lib/youtube/learningPackHistory";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/** List saved learning packs for the signed-in Google user. Heals missing yt_oauth_sub. */
export async function GET(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error: "Sign in with Google to view history (or sign out and back in to refresh your session)",
      },
      { status: 401 },
    );
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
    packs: result.data.map(
      ({
        id,
        videoId,
        videoUrl,
        thumbnailUrl,
        videoTitle,
        channelTitle,
        contentType,
        conceptCount,
        termCount,
        markdown,
        transcript,
        graphPayload,
        createdAt,
      }) => ({
        id,
        videoId,
        videoUrl,
        thumbnailUrl,
        videoTitle,
        channelTitle,
        contentType,
        conceptCount,
        termCount,
        markdown,
        transcript,
        graphPayload,
        createdAt,
      }),
    ),
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}
