import type { GithubReleaseItem } from "./types";

export const ACTIVITY_MAX_REPOS = 8;
export const ACTIVITY_RELEASES_PER_REPO = 3;

const FULL_NAME_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/** Parse and cap `owner/repo` list from query or UI. */
export function parseRepoFullNames(
  raw: string | readonly string[] | null | undefined,
  max = ACTIVITY_MAX_REPOS,
): string[] {
  const parts: string[] =
    typeof raw === "string"
      ? raw.split(/[,+]/)
      : Array.isArray(raw)
        ? [...raw]
        : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const name = p.trim().replace(/^https?:\/\/github\.com\//i, "");
    if (!FULL_NAME_RE.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export type GithubReleaseRaw = {
  id?: number;
  tag_name?: string;
  name?: string | null;
  html_url?: string;
  published_at?: string | null;
  prerelease?: boolean;
};

export function mapReleaseItem(
  repoFullName: string,
  raw: GithubReleaseRaw,
): GithubReleaseItem | null {
  const id = typeof raw.id === "number" ? raw.id : NaN;
  const tagName = (raw.tag_name ?? "").trim();
  const htmlUrl = (raw.html_url ?? "").trim();
  if (!Number.isFinite(id) || !tagName || !htmlUrl) return null;
  return {
    id,
    repoFullName,
    tagName,
    name: raw.name?.trim() || null,
    htmlUrl,
    publishedAt: raw.published_at?.trim() || null,
    prerelease: raw.prerelease === true,
  };
}

/** Newest published first across repos. */
export function mergeReleases(
  batches: Array<{ repoFullName: string; releases: GithubReleaseItem[] }>,
  max = 24,
): GithubReleaseItem[] {
  const all = batches.flatMap((b) => b.releases);
  return all
    .sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    })
    .slice(0, Math.max(0, max));
}
