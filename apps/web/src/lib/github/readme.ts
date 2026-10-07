/** Pure helpers for GitHub README fetch + validation. */

import { parseRepoFullNames } from "./activity";
import type { GithubRepoReadme } from "./types";

/** Cap stored README markdown (bytes-ish chars) for API responses. */
export const README_MAX_CHARS = 400_000;

/** Cap README fed into the AI summarizer. */
export const README_SUMMARY_INPUT_MAX = 24_000;

const FULL_NAME_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export type ParseRepoFullNameResult =
  | { ok: true; fullName: string; owner: string; name: string }
  | { ok: false; error: string };

/** Parse a single `owner/name` from query or body. */
export function parseRepoFullName(
  raw: string | null | undefined,
): ParseRepoFullNameResult {
  const list = parseRepoFullNames(raw, 1);
  const fullName = list[0];
  if (!fullName || !FULL_NAME_RE.test(fullName)) {
    return { ok: false, error: "Expected repo as owner/name" };
  }
  const slash = fullName.indexOf("/");
  return {
    ok: true,
    fullName,
    owner: fullName.slice(0, slash),
    name: fullName.slice(slash + 1),
  };
}

export function truncateReadmeMarkdown(
  markdown: string,
  max = README_MAX_CHARS,
): { markdown: string; truncated: boolean } {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (normalized.length <= max) {
    return { markdown: normalized, truncated: false };
  }
  return {
    markdown:
      normalized.slice(0, max) +
      "\n\n[README truncated — remaining content omitted for length.]",
    truncated: true,
  };
}

export function truncateReadmeForSummary(
  markdown: string,
  max = README_SUMMARY_INPUT_MAX,
): string {
  const { markdown: out } = truncateReadmeMarkdown(markdown, max);
  return out;
}

export type ReadmeFetchOk = {
  ok: true;
  data: GithubRepoReadme;
};

export type ReadmeFetchErr = {
  ok: false;
  reason: "missing" | "upstream";
  message: string;
};

export type ReadmeFetchResult = ReadmeFetchOk | ReadmeFetchErr;

export function buildReadmeResult(input: {
  fullName: string;
  markdown: string;
  htmlUrl?: string | null;
}): GithubRepoReadme {
  const { markdown, truncated } = truncateReadmeMarkdown(input.markdown);
  return {
    fullName: input.fullName,
    markdown,
    truncated,
    htmlUrl: input.htmlUrl?.trim() || null,
    fetchedAt: Date.now(),
  };
}
