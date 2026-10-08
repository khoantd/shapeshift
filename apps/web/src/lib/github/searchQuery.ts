import type { GithubRepoCard } from "./types";

export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 100;
export const SEARCH_API_PER_PAGE = 20;

/**
 * Normalize a free-text GitHub repo search query for the Search API.
 * Returns null when the query is too short or empty after trim.
 */
export function parseSearchQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().replace(/\s+/g, " ");
  if (q.length < SEARCH_QUERY_MIN) return null;
  if (q.length > SEARCH_QUERY_MAX) return q.slice(0, SEARCH_QUERY_MAX);
  return q;
}

function haystack(repo: GithubRepoCard): string {
  return [
    repo.fullName,
    repo.name,
    repo.owner,
    repo.description ?? "",
    repo.language ?? "",
    ...repo.topics,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Client-side filter over an already-loaded trending list.
 * Empty / whitespace-only query returns the original list.
 */
export function filterReposByQuery(
  repos: readonly GithubRepoCard[],
  query: string,
): GithubRepoCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...repos];
  const tokens = q.split(/\s+/).filter(Boolean);
  return repos.filter((repo) => {
    const text = haystack(repo);
    return tokens.every((token) => text.includes(token));
  });
}
