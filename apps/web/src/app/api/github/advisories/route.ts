import { NextRequest, NextResponse } from "next/server";
import { fetchRepoSecurityAdvisories } from "@/lib/github/client";
import { parseRepoFullName } from "@/lib/github/readme";
import { parseAdvisoriesListQuery } from "@/lib/github/securityAdvisories";

export const runtime = "nodejs";

/**
 * List repository security advisories (published by default).
 * Query: ?repo=owner/name&state=published&sort=published&direction=desc&perPage=10
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = parseRepoFullName(url.searchParams.get("repo"));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  const query = parseAdvisoriesListQuery({
    state: url.searchParams.get("state"),
    sort: url.searchParams.get("sort"),
    direction: url.searchParams.get("direction"),
    perPage: url.searchParams.get("perPage"),
  });

  try {
    const result = await fetchRepoSecurityAdvisories({
      repo: parsed.fullName,
      query,
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
        error: e instanceof Error ? e.message : "Advisories fetch failed",
      },
      { status: 502 },
    );
  }
}
