import { NextRequest, NextResponse } from "next/server";
import { parseRepoFullNames } from "@/lib/github/activity";
import { fetchRepoActivity } from "@/lib/github/client";

export const runtime = "nodejs";

/** Recent releases for a shortlist of owner/repo names. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const repos = parseRepoFullNames(url.searchParams.get("repos"));
  if (repos.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Expected ?repos=owner/name,owner/other",
      },
      { status: 422 },
    );
  }

  try {
    const data = await fetchRepoActivity({ repos });
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
        error: e instanceof Error ? e.message : "Activity fetch failed",
      },
      { status: 502 },
    );
  }
}
