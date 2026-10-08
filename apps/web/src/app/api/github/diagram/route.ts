import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchRepoReadme, fetchRepoTree } from "@/lib/github/client";
import { truncateReadmeForSummary } from "@/lib/github/readme";
import {
  parseRepoDiagramRequest,
  RepoDiagramConfigError,
  RepoDiagramUpstreamError,
  runGithubRepoDiagram,
} from "@/lib/github/repoDiagram";

export const runtime = "nodejs";

/**
 * AI Mermaid architecture diagram for a public repo (Perplexity).
 * Body: { repo, description?, readme?, treeOutline?, language?, force? }
 */
export async function POST(request: NextRequest) {
  const parsed = parseRepoDiagramRequest(
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
      if (treeFetched) {
        if (!treeFetched.ok) {
          const status = treeFetched.reason === "missing" ? 404 : 502;
          return NextResponse.json(
            {
              success: false,
              error: treeFetched.message,
              reason: treeFetched.reason,
            },
            { status },
          );
        }
        treeOutline = treeFetched.data.outline;
      }
    }

    const result = await runGithubRepoDiagram(
      { ...parsed.data, readme, treeOutline },
      request.signal,
    );

    return NextResponse.json({
      success: true,
      mermaid: result.mermaid,
      notes: result.notes,
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
      err instanceof RepoDiagramConfigError ||
      err instanceof RepoDiagramUpstreamError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-diagram] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate diagram" },
      { status: 502 },
    );
  }
}
