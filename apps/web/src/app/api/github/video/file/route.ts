import { NextRequest, NextResponse } from "next/server";
import { parseRepoFullName } from "@/lib/github/readme";
import { videoObjectKey } from "@/lib/github/repoVideoParse";
import {
  getObject,
  hasMinioConfig,
  MinioConfigError,
  MinioObjectNotFoundError,
  MISSING_MINIO_MESSAGE,
} from "@/lib/minio/client";
import { parseLearningPackLanguage } from "@/lib/youtube/learningPackParse";

export const runtime = "nodejs";

/**
 * Same-origin MP4 proxy so HTTPS pages never load MinIO http:// URLs
 * (avoids Firefox HTTPS-Only Mode upgrade failures).
 * Query: repo=owner/name&lang=en&hash=abcdef12
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
  const contentHash = request.nextUrl.searchParams.get("hash")?.trim() ?? "";
  if (!/^[0-9a-f]{8}$/i.test(contentHash)) {
    return NextResponse.json(
      { success: false, error: "Invalid or missing hash" },
      { status: 400 },
    );
  }

  if (!hasMinioConfig()) {
    return NextResponse.json(
      { success: false, error: MISSING_MINIO_MESSAGE },
      { status: 503 },
    );
  }

  const objectKey = videoObjectKey({
    fullName: parsed.fullName,
    language,
    contentHash: contentHash.toLowerCase(),
  });
  const range = request.headers.get("range") ?? undefined;

  try {
    const obj = await getObject({ key: objectKey, range });
    if (!obj.body) {
      return NextResponse.json(
        { success: false, error: "Empty object body" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", obj.contentType || "video/mp4");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=300");
    if (obj.contentLength != null) {
      headers.set("Content-Length", String(obj.contentLength));
    }
    if (obj.contentRange) {
      headers.set("Content-Range", obj.contentRange);
    }
    if (obj.etag) {
      headers.set("ETag", obj.etag);
    }
    headers.set(
      "Content-Disposition",
      `inline; filename="${parsed.fullName.replace("/", "-")}-${contentHash}.mp4"`,
    );

    return new NextResponse(obj.body, {
      status: obj.statusCode,
      headers,
    });
  } catch (err) {
    if (err instanceof MinioObjectNotFoundError) {
      return NextResponse.json(
        { success: false, error: "Video not found" },
        { status: 404 },
      );
    }
    if (err instanceof MinioConfigError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[github-video-file] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not stream video" },
      { status: 502 },
    );
  }
}
