import { NextRequest, NextResponse } from "next/server";
import { fetchRepoSearch } from "@/lib/github/client";
import {
  parseSearchQuery,
  SEARCH_QUERY_MIN,
} from "@/lib/github/searchQuery";

export const runtime = "nodejs";

/**
 * Free-text public repo search via GitHub Search API.
 * GET /api/github/search?q=
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = parseSearchQuery(url.searchParams.get("q"));

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Provide a search query (min ${SEARCH_QUERY_MIN} chars)`,
        },
        repos: [],
      },
      { status: 400 },
    );
  }

  try {
    const data = await fetchRepoSearch({
      q: query,
      signal: request.signal,
    });
    return NextResponse.json(
      { success: true, ...data },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (e) {
    if (request.signal.aborted) {
      throw e;
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GITHUB_SEARCH_FAILED",
          message:
            e instanceof Error ? e.message : "GitHub Search failed",
        },
        repos: [],
      },
      { status: 502 },
    );
  }
}
