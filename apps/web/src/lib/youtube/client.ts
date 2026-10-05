import { getYouTubeDataApiKey, missingYouTubeConfigMessage, youtubeConfigured } from "./config";
import type { YouTubeVideo } from "./types";

export { getYouTubeDataApiKey, missingYouTubeConfigMessage, youtubeConfigured };

const YT_API = "https://www.googleapis.com/youtube/v3";

export class YouTubeConfigError extends Error {
  code = "YOUTUBE_CONFIG" as const;
  constructor(message = missingYouTubeConfigMessage()) {
    super(message);
    this.name = "YouTubeConfigError";
  }
}

export class YouTubeApiError extends Error {
  code = "YOUTUBE_API" as const;
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
  }
}

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
    };
  };
};

type VideoItem = {
  id?: string;
  snippet?: SearchItem["snippet"];
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
};

function requireKey(): string {
  const key = getYouTubeDataApiKey();
  if (!key) throw new YouTubeConfigError();
  return key;
}

function pickThumbnail(snippet: SearchItem["snippet"]): string | undefined {
  const url =
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.default?.url;
  return url?.startsWith("https://") ? url : undefined;
}

function mapSearchItem(item: SearchItem): YouTubeVideo | null {
  const videoId = item.id?.videoId?.trim();
  const title = item.snippet?.title?.trim();
  if (!videoId || !/^[\w-]{11}$/.test(videoId) || !title) return null;
  return {
    videoId,
    title: title.slice(0, 500),
    description: (item.snippet?.description ?? "").slice(0, 5000) || undefined,
    channelTitle: item.snippet?.channelTitle?.slice(0, 200) || undefined,
    publishedAt: item.snippet?.publishedAt?.slice(0, 40) || undefined,
    thumbnailUrl: pickThumbnail(item.snippet),
  };
}

function mapVideoItem(item: VideoItem): YouTubeVideo | null {
  const videoId = item.id?.trim();
  const title = item.snippet?.title?.trim();
  if (!videoId || !/^[\w-]{11}$/.test(videoId) || !title) return null;
  return {
    videoId,
    title: title.slice(0, 500),
    description: (item.snippet?.description ?? "").slice(0, 5000) || undefined,
    channelTitle: item.snippet?.channelTitle?.slice(0, 200) || undefined,
    publishedAt: item.snippet?.publishedAt?.slice(0, 40) || undefined,
    thumbnailUrl: pickThumbnail(item.snippet),
    duration: item.contentDetails?.duration?.slice(0, 40) || undefined,
    viewCount: item.statistics?.viewCount?.slice(0, 40) || undefined,
  };
}

async function ytFetch<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const key = requireKey();
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  let res: Response;
  try {
    res = await fetch(url, { signal, next: { revalidate: 0 } });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new YouTubeApiError(e instanceof Error ? e.message : "YouTube request failed", 502);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const snippet = body.slice(0, 200);
    if (res.status === 403 || res.status === 401) {
      throw new YouTubeApiError(
        `YouTube API auth failed (${res.status}). Check YOUTUBE_DATA_API_KEY and that YouTube Data API v3 is enabled.`,
        res.status,
      );
    }
    if (res.status === 429) {
      throw new YouTubeApiError("YouTube API rate limit exceeded. Try again shortly.", 429);
    }
    throw new YouTubeApiError(
      snippet ? `YouTube API error (${res.status}): ${snippet}` : `YouTube API error (${res.status})`,
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  return (await res.json()) as T;
}

export async function searchVideos(
  query: string,
  signal?: AbortSignal,
  maxResults = 12,
): Promise<YouTubeVideo[]> {
  const data = await ytFetch<{ items?: SearchItem[] }>(
    "search",
    {
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
      safeSearch: "moderate",
    },
    signal,
  );
  return (data.items ?? []).map(mapSearchItem).filter((v): v is YouTubeVideo => v !== null);
}

export async function getVideo(videoId: string, signal?: AbortSignal): Promise<YouTubeVideo | null> {
  const data = await ytFetch<{ items?: VideoItem[] }>(
    "videos",
    {
      part: "snippet,contentDetails,statistics",
      id: videoId,
    },
    signal,
  );
  const item = data.items?.[0];
  if (!item) return null;
  return mapVideoItem(item);
}
