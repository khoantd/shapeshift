import { NextRequest, NextResponse } from "next/server";
import { fetchRepoSecurityAdvisory } from "@/lib/github/client";
import { parseRepoFullName } from "@/lib/github/readme";
import { parseGhsaId } from "@/lib/github/securityAdvisories";

export const runtime = "nodejs";

/**
 * Get a single repository security advisory by GHSA id.
 * Query: ?repo=owner/name
 * Path: /api/github/advisories/{ghsaId}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ghsaId: string }> },
) {
  const { ghsaId: rawGhsa } = await context.params;
  const parsedGhsa = parseGhsaId(rawGhsa);
  if (!parsedGhsa.ok) {
    return NextResponse.json(
      { success: false, error: parsedGhsa.error },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const parsed = parseRepoFullName(url.searchParams.get("repo"));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    const result = await fetchRepoSecurityAdvisory({
      repo: parsed.fullName,
      ghsaId: parsedGhsa.ghsaId,
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
      { success: true, advisory: result.data },
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
        error: e instanceof Error ? e.message : "Advisory fetch failed",
      },
      { status: 502 },
    );
  }
}
