import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingRepos } from "@/lib/github/client";
import { getGithubFavorites } from "@/lib/github/favoritesHistory";
import {
  DEFAULT_TRENDING_TOPICS,
  parseTopicsQueryParam,
} from "@/lib/github/topics";
import { ensureYouTubeOAuthIdentity } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/**
 * Trending repos via GitHub Search, filtered by ?topics= or saved favorites.
 */
export async function GET(request: NextRequest) {
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
    const data = await fetchTrendingRepos({ topicIds });
    return NextResponse.json(
      { success: true, ...data },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "GitHub Search failed",
      },
      { status: 502 },
    );
  }
}
