import {
  getVideo,
  missingYouTubeConfigMessage,
  searchVideos,
  youtubeConfigured,
  YouTubeApiError,
  YouTubeConfigError,
} from "@/lib/youtube/client";
import { extractYouTubeVideoId } from "@/lib/youtube/url";
import { parseSearchQuery, parseVideoIdParam } from "@/lib/youtube/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = url.searchParams.get("q")?.trim() ?? "";
  const videoIdFromUrl = extractYouTubeVideoId(qRaw);
  const q = videoIdFromUrl ? null : parseSearchQuery(qRaw);
  const videoId = videoIdFromUrl ?? parseVideoIdParam(url.searchParams.get("videoId"));

  if (!videoId && !q) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide a search query (min 2 chars) or a YouTube URL / videoId",
        },
        videos: [],
      },
      { status: 400 },
    );
  }

  if (!youtubeConfigured()) {
    return Response.json(
      {
        success: false,
        error: { code: "YOUTUBE_CONFIG", message: missingYouTubeConfigMessage() },
        videos: [],
      },
      { status: 503 },
    );
  }

  try {
    if (videoId) {
      const video = await getVideo(videoId, req.signal);
      if (!video) {
        return Response.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Video not found" },
            videos: [],
          },
          { status: 404 },
        );
      }
      return Response.json({ success: true, videos: [video], mode: "url" as const });
    }

    const videos = await searchVideos(q!, req.signal);
    return Response.json({ success: true, videos, mode: "search" as const });
  } catch (e) {
    if (e instanceof YouTubeConfigError) {
      return Response.json(
        {
          success: false,
          error: { code: e.code, message: e.message },
          videos: [],
        },
        { status: 503 },
      );
    }
    if (e instanceof YouTubeApiError) {
      return Response.json(
        {
          success: false,
          error: { code: e.code, message: e.message },
          videos: [],
        },
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
          message: e instanceof Error ? e.message : "Search failed",
        },
        videos: [],
      },
      { status: 500 },
    );
  }
}
