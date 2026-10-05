import {
  getVideo,
  missingYouTubeConfigMessage,
  youtubeConfigured,
  YouTubeApiError,
  YouTubeConfigError,
} from "@/lib/youtube/client";
import { parseVideoIdParam } from "@/lib/youtube/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = parseVideoIdParam(url.searchParams.get("videoId"));

  if (!videoId) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "videoId is required" },
      },
      { status: 400 },
    );
  }

  if (!youtubeConfigured()) {
    return Response.json(
      {
        success: false,
        error: { code: "YOUTUBE_CONFIG", message: missingYouTubeConfigMessage() },
      },
      { status: 503 },
    );
  }

  try {
    const video = await getVideo(videoId, req.signal);
    if (!video) {
      return Response.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Video not found" },
        },
        { status: 404 },
      );
    }
    return Response.json({ success: true, video });
  } catch (e) {
    if (e instanceof YouTubeConfigError) {
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status: 503 },
      );
    }
    if (e instanceof YouTubeApiError) {
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status: e.status === 429 ? 429 : 502 },
      );
    }
    if (req.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: e instanceof Error ? e.message : "Details failed",
        },
      },
      { status: 500 },
    );
  }
}
