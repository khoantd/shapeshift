import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchRepoReadme, fetchRepoTree } from "@/lib/github/client";
import { truncateReadmeForSummary } from "@/lib/github/readme";
import {
  parseRepoExplainerRequest,
  RepoExplainerConfigError,
  RepoExplainerUpstreamError,
  runGithubRepoExplainer,
} from "@/lib/github/repoExplainer";

export const runtime = "nodejs";

/**
 * AI chapter explainer script for a public repo (Perplexity).
 * Body: { repo, description?, readme?, treeOutline?, language?, force? }
 */
export async function POST(request: NextRequest) {
  const parsed = parseRepoExplainerRequest(
    await request.json().catch(() => null),
  );
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  try {
    let readme = parsed.data.readme;
    let treeOutline = parsed.data.treeOutline;

    if (!readme.trim() || !treeOutline.trim()) {
      const [readmeFetched, treeFetched] = await Promise.all([
        readme.trim()
          ? Promise.resolve(null)
          : fetchRepoReadme({
              repo: parsed.data.fullName,
              signal: request.signal,
            }),
        treeOutline.trim()
          ? Promise.resolve(null)
          : fetchRepoTree({
              repo: parsed.data.fullName,
              signal: request.signal,
            }),
      ]);

      if (readmeFetched && readmeFetched.ok) {
        readme = truncateReadmeForSummary(readmeFetched.data.markdown);
      }
      if (treeFetched && treeFetched.ok) {
        treeOutline = treeFetched.data.outline;
      }
    }

    const result = await runGithubRepoExplainer(
      { ...parsed.data, readme, treeOutline },
      request.signal,
    );

    return NextResponse.json({
      success: true,
      chapters: result.chapters,
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
      err instanceof RepoExplainerConfigError ||
      err instanceof RepoExplainerUpstreamError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-explainer] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate explainer" },
      { status: 502 },
    );
  }
}
