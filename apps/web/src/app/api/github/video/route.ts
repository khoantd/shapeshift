import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchRepoReadme, fetchRepoTree } from "@/lib/github/client";
import { truncateReadmeForSummary } from "@/lib/github/readme";
import { parseRepoFullName } from "@/lib/github/readme";
import {
  getRepoVideoPlaybackUrl,
  MinioConfigError,
  parseRepoVideoRequest,
  RepoExplainerConfigError,
  RepoExplainerUpstreamError,
  RepoVideoRenderError,
  RepoVideoTtsConfigError,
  RepoVideoTtsUpstreamError,
  runGithubRepoVideo,
} from "@/lib/github/repoVideo";
import { parseLearningPackLanguage } from "@/lib/youtube/learningPackParse";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Generate a narrated Remotion MP4 for a public repo (TTS + MinIO).
 * Body: { repo, description?, readme?, treeOutline?, language?, force? }
 */
export async function POST(request: NextRequest) {
  const parsed = parseRepoVideoRequest(
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

    const result = await runGithubRepoVideo(
      { ...parsed.data, readme, treeOutline },
      request.signal,
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentHash: result.contentHash,
      cached: result.cached,
      resumedAudioCount: result.resumedAudioCount,
      chapters: result.chapters,
      language: result.language,
      fullName: result.fullName,
    });
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (
      err instanceof MinioConfigError ||
      err instanceof RepoVideoTtsConfigError ||
      err instanceof RepoExplainerConfigError ||
      err instanceof RepoExplainerUpstreamError ||
      err instanceof RepoVideoTtsUpstreamError ||
      err instanceof RepoVideoRenderError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-video] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not generate video" },
      { status: 502 },
    );
  }
}

/**
 * Look up an existing video by repo + optional contentHash.
 * Query: repo=owner/name&lang=en&hash=...
 */
export async function GET(request: NextRequest) {
  const repoRaw = request.nextUrl.searchParams.get("repo") ?? "";
  const parsed = parseRepoFullName(repoRaw);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }
  const language =
    parseLearningPackLanguage(request.nextUrl.searchParams.get("lang")) ??
    "en";
  const contentHash =
    request.nextUrl.searchParams.get("hash")?.trim() || undefined;

  try {
    const status = await getRepoVideoPlaybackUrl({
      fullName: parsed.fullName,
      language,
      contentHash,
    });
    if (status.status === "missing") {
      return NextResponse.json({
        success: true,
        status: "missing",
        fullName: parsed.fullName,
        language,
      });
    }
    return NextResponse.json({
      success: true,
      status: "ready",
      url: status.url,
      objectKey: status.objectKey,
      contentHash: status.contentHash,
      fullName: parsed.fullName,
      language,
    });
  } catch (err) {
    if (
      err instanceof MinioConfigError ||
      err instanceof RepoVideoTtsConfigError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-video] status failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not look up video" },
      { status: 502 },
    );
  }
}
