import { NextRequest, NextResponse } from "next/server";
import { fetchTopicHeadlines } from "@/lib/github/client";
import {
  githubNewsConfigured,
  missingGithubNewsConfigMessage,
} from "@/lib/github/config";
import { getGithubFavorites } from "@/lib/github/favoritesHistory";
import {
  DEFAULT_TRENDING_TOPICS,
  parseTopicsQueryParam,
} from "@/lib/github/topics";
import { ensureYouTubeOAuthIdentity } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/** Topic headlines via SerpAPI Google News. */
export async function GET(request: NextRequest) {
  if (!githubNewsConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: missingGithubNewsConfigMessage(),
        headlines: [],
        topicsUsed: [],
        fetchedAt: Date.now(),
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  let topicIds = parseTopicsQueryParam(url.searchParams.get("topics"));

  if (topicIds.length === 0) {
    const ensured = await ensureYouTubeOAuthIdentity(request);
    if (ensured.identity) {
      const fav = await getGithubFavorites(ensured.identity.sub);
      if (fav.ok && fav.data.topics.length > 0) {
        topicIds = fav.data.topics;
      }
    }
  }
  if (topicIds.length === 0) {
    topicIds = [...DEFAULT_TRENDING_TOPICS];
  }

  try {
    const data = await fetchTopicHeadlines({ topicIds });
    return NextResponse.json(
      { success: true, ...data },
      {
        headers: {
          "Cache-Control": "private, max-age=600",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "News fetch failed",
      },
      { status: 502 },
    );
  }
}
