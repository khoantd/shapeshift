import {
  parseLearningPackLanguage,
  type LearningPackLanguage,
} from "@/lib/youtube/learningPackParse";
import { parseRepoFullName, truncateReadmeForSummary } from "./readme";
import { TREE_OUTLINE_MAX_CHARS } from "./repoTree";
import type { RepoExplainerChapter } from "./repoExplainerParse";

export type RepoVideoLanguage = LearningPackLanguage;

export type RepoVideoRequest = {
  fullName: string;
  description: string | null;
  readme: string;
  treeOutline: string;
  language: RepoVideoLanguage;
  force?: boolean;
};

export type RepoVideoParseError = { ok: false; error: string };
export type RepoVideoParseOk = { ok: true; data: RepoVideoRequest };

const DESCRIPTION_MAX = 500;

/**
 * Bump when timing or Remotion composition changes so cached MP4s are rebuilt.
 */
export const VIDEO_PIPELINE_VERSION = "v2";

/** Simple non-crypto fingerprint for cache keys (stable, short). */
export function contentFingerprint(parts: string[]): string {
  const joined = parts.join("\n");
  let hash = 2166136261;
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function videoContentHash(input: {
  fullName: string;
  language: RepoVideoLanguage;
  chapters: RepoExplainerChapter[];
}): string {
  return contentFingerprint([
    VIDEO_PIPELINE_VERSION,
    input.fullName,
    input.language,
    ...input.chapters.flatMap((c) => [c.title, c.body]),
  ]);
}

export function videoObjectKey(input: {
  fullName: string;
  language: RepoVideoLanguage;
  contentHash: string;
}): string {
  const [owner, name] = input.fullName.split("/");
  return `github-videos/${owner}/${name}/${input.language}/${input.contentHash}.mp4`;
}

export function videoAudioObjectKey(input: {
  fullName: string;
  language: RepoVideoLanguage;
  contentHash: string;
  chapterIndex: number;
}): string {
  const [owner, name] = input.fullName.split("/");
  return `github-videos/${owner}/${name}/${input.language}/${input.contentHash}/audio/ch-${input.chapterIndex}.mp3`;
}

/**
 * Same-origin playback URL so browsers on HTTPS never load MinIO http://
 * (Firefox HTTPS-Only Mode upgrades/blocks insecure media).
 */
export function videoPlaybackProxyPath(input: {
  fullName: string;
  language: RepoVideoLanguage;
  contentHash: string;
}): string {
  const params = new URLSearchParams({
    repo: input.fullName,
    lang: input.language,
    hash: input.contentHash,
  });
  return `/api/github/video/file?${params.toString()}`;
}

/**
 * Estimate spoken duration in seconds from character count.
 * ~14 chars/sec ≈ 150 wpm English; Vietnamese is similar for our use.
 */
export function estimateSpeechDurationSeconds(text: string): number {
  const chars = text.trim().length;
  if (chars === 0) return 1.5;
  return Math.max(1.5, Math.min(45, chars / 14));
}

export function parseRepoVideoRequest(
  body: unknown,
): RepoVideoParseOk | RepoVideoParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { repo }" };
  }
  const raw = body as Record<string, unknown>;
  const repoRaw =
    typeof raw.repo === "string"
      ? raw.repo
      : typeof raw.fullName === "string"
        ? raw.fullName
        : "";
  const parsed = parseRepoFullName(repoRaw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const description =
    typeof raw.description === "string"
      ? raw.description.trim().slice(0, DESCRIPTION_MAX) || null
      : null;
  const readmeRaw =
    typeof raw.readme === "string" ? raw.readme.replace(/\r\n/g, "\n") : "";
  const treeRaw =
    typeof raw.treeOutline === "string"
      ? raw.treeOutline.replace(/\r\n/g, "\n")
      : typeof raw.outline === "string"
        ? raw.outline.replace(/\r\n/g, "\n")
        : "";
  const language = parseLearningPackLanguage(raw.language) ?? "en";
  const force = raw.force === true;

  return {
    ok: true,
    data: {
      fullName: parsed.fullName,
      description,
      readme: readmeRaw ? truncateReadmeForSummary(readmeRaw) : "",
      treeOutline: treeRaw.slice(0, TREE_OUTLINE_MAX_CHARS),
      language,
      ...(force ? { force: true } : {}),
    },
  };
}
