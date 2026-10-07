import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchRepoReadme } from "@/lib/github/client";
import { truncateReadmeForSummary } from "@/lib/github/readme";
import {
  parseRepoSummaryRequest,
  RepoSummaryConfigError,
  RepoSummaryUpstreamError,
  runGithubRepoSummary,
} from "@/lib/github/repoSummary";

export const runtime = "nodejs";

/**
 * AI summary of a public repo README (Perplexity).
 * Body: { repo, description?, readme?, language?, force? }
 * When `readme` is omitted, fetches README from GitHub.
 */
export async function POST(request: NextRequest) {
  const parsed = parseRepoSummaryRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    let readme = parsed.data.readme;
    if (!readme.trim()) {
      const fetched = await fetchRepoReadme({
        repo: parsed.data.fullName,
        signal: request.signal,
      });
      if (!fetched.ok) {
        const status = fetched.reason === "missing" ? 404 : 502;
        return NextResponse.json(
          { success: false, error: fetched.message, reason: fetched.reason },
          { status },
        );
      }
      readme = truncateReadmeForSummary(fetched.data.markdown);
    }

    const result = await runGithubRepoSummary(
      { ...parsed.data, readme },
      request.signal,
    );

    return NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
      responseId: result.responseId,
      cached: result.cached,
      language: parsed.data.language,
      fullName: parsed.data.fullName,
    });
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (
      err instanceof RepoSummaryConfigError ||
      err instanceof RepoSummaryUpstreamError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-summarize] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate summary" },
      { status: 502 },
    );
  }
}
