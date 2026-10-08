import { NextRequest, NextResponse } from "next/server";
import { fetchRepoTree } from "@/lib/github/client";
import { parseRepoFullName } from "@/lib/github/readme";

export const runtime = "nodejs";

/**
 * Trimmed recursive tree outline for a public `owner/name` repo.
 * Query: ?repo=owner/name
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fromRepo = url.searchParams.get("repo");
  const owner = url.searchParams.get("owner");
  const name = url.searchParams.get("name");
  const raw =
    fromRepo?.trim() ||
    (owner && name ? `${owner.trim()}/${name.trim()}` : null);

  const parsed = parseRepoFullName(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    const result = await fetchRepoTree({
      repo: parsed.fullName,
      signal: request.signal,
    });
    if (!result.ok) {
      const status = result.reason === "missing" ? 404 : 502;
      return NextResponse.json(
        { success: false, error: result.message, reason: result.reason },
        { status },
      );
    }
    return NextResponse.json(
      { success: true, ...result.data },
      {
        headers: {
          "Cache-Control": "private, max-age=600",
        },
      },
    );
  } catch (e) {
    if (request.signal.aborted) {
      return NextResponse.json(
        { success: false, error: "Aborted" },
        { status: 499 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Tree fetch failed",
      },
      { status: 502 },
    );
  }
}
