import type { GithubRepoCard, GithubTopic } from "./types";

export const TRENDING_WINDOW_DAYS = 7;
export const TRENDING_MIN_STARS = 5;
export const TRENDING_PER_QUERY = 10;
export const TRENDING_MAX_REPOS = 30;

/** ISO date (YYYY-MM-DD) for `created:>` window. */
export function trendingCreatedAfter(
  now: Date = new Date(),
  windowDays: number = TRENDING_WINDOW_DAYS,
): string {
  const d = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a GitHub Search repositories `q` string for one topic
 * (or a global hot query when topic has no language).
 */
export function buildSearchQueryForTopic(
  topic: GithubTopic | null,
  opts?: { createdAfter?: string; minStars?: number },
): string {
  const createdAfter = opts?.createdAfter ?? trendingCreatedAfter();
  const minStars = opts?.minStars ?? TRENDING_MIN_STARS;
  const parts: string[] = [
    `created:>${createdAfter}`,
    `stars:>${minStars}`,
  ];
  if (topic?.githubLanguage) {
    parts.push(`language:${topic.githubLanguage}`);
  } else if (topic) {
    // Topic keywords for non-language interests (quoted OR tokens).
    const keywords = topic.newsQuery
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4);
    if (keywords.length) {
      parts.push(keywords.map((k) => `${k} in:name,description,topics`).join(" OR "));
    }
  }
  return parts.join(" ");
}

/** Global fallback when no favorites. */
export function buildGlobalHotQuery(opts?: {
  createdAfter?: string;
  minStars?: number;
}): string {
  return buildSearchQueryForTopic(null, opts);
}

export type GithubSearchRepoRaw = {
  id?: number;
  full_name?: string;
  name?: string;
  description?: string | null;
  html_url?: string;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  topics?: string[];
  pushed_at?: string | null;
  created_at?: string | null;
  owner?: { login?: string };
};

export function mapSearchItemToCard(
  raw: GithubSearchRepoRaw,
  matchedTopicIds: string[] = [],
): GithubRepoCard | null {
  const id = typeof raw.id === "number" ? raw.id : NaN;
  const fullName = (raw.full_name ?? "").trim();
  const htmlUrl = (raw.html_url ?? "").trim();
  if (!Number.isFinite(id) || !fullName || !htmlUrl) return null;
  const [ownerPart, namePart] = fullName.split("/");
  const owner = (raw.owner?.login ?? ownerPart ?? "").trim();
  const name = (raw.name ?? namePart ?? "").trim();
  if (!owner || !name) return null;
  return {
    id,
    fullName,
    owner,
    name,
    description: raw.description?.trim() || null,
    htmlUrl,
    language: raw.language?.trim() || null,
    stars: typeof raw.stargazers_count === "number" ? raw.stargazers_count : 0,
    forks: typeof raw.forks_count === "number" ? raw.forks_count : 0,
    openIssues:
      typeof raw.open_issues_count === "number" ? raw.open_issues_count : 0,
    topics: Array.isArray(raw.topics)
      ? raw.topics.filter((t): t is string => typeof t === "string")
      : [],
    pushedAt: raw.pushed_at?.trim() || null,
    createdAt: raw.created_at?.trim() || null,
    matchedTopicIds: [...matchedTopicIds],
  };
}

/**
 * Merge repo cards from multiple topic searches: highest stars first,
 * union matchedTopicIds, cap at maxRepos.
 */
export function mergeAndRankRepos(
  batches: Array<{ topicId: string | null; repos: GithubRepoCard[] }>,
  max = TRENDING_MAX_REPOS,
): GithubRepoCard[] {
  const byId = new Map<number, GithubRepoCard>();
  for (const batch of batches) {
    for (const repo of batch.repos) {
      const existing = byId.get(repo.id);
      if (!existing) {
        byId.set(repo.id, {
          ...repo,
          matchedTopicIds: batch.topicId
            ? Array.from(new Set([...repo.matchedTopicIds, batch.topicId]))
            : [...repo.matchedTopicIds],
        });
        continue;
      }
      const topics = new Set(existing.matchedTopicIds);
      for (const t of repo.matchedTopicIds) topics.add(t);
      if (batch.topicId) topics.add(batch.topicId);
      byId.set(repo.id, {
        ...existing,
        matchedTopicIds: Array.from(topics),
        stars: Math.max(existing.stars, repo.stars),
      });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, Math.max(0, max));
}
