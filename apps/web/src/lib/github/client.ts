import "server-only";

import {
  ACTIVITY_RELEASES_PER_REPO,
  mapReleaseItem,
  mergeReleases,
  parseRepoFullNames,
} from "./activity";
import { githubToken, serpApiKey } from "./config";
import {
  mergeHeadlines,
  parseSerpGoogleNewsPayload,
} from "./news";
import {
  DEFAULT_TRENDING_TOPICS,
  resolveTopics,
} from "./topics";
import {
  SEARCH_API_PER_PAGE,
  parseSearchQuery,
} from "./searchQuery";
import {
  TRENDING_PER_QUERY,
  TRENDING_WINDOW_DAYS,
  buildGlobalHotQuery,
  buildSearchQueryForTopic,
  mapSearchItemToCard,
  mergeAndRankRepos,
  trendingCreatedAfter,
  type GithubSearchRepoRaw,
} from "./trending";
import {
  buildReadmeResult,
  parseRepoFullName,
  type ReadmeFetchResult,
} from "./readme";
import type {
  GithubActivityResult,
  GithubNewsResult,
  GithubSearchResult,
  GithubTrendingResult,
} from "./types";

const GH_API = "https://api.github.com";
const SERP_URL = "https://serpapi.com/search.json";
const UA = "Meanbox-GitHub-Monitor/1.0";

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function searchRepositories(
  q: string,
  opts?: { perPage?: number; signal?: AbortSignal; revalidate?: number },
): Promise<GithubSearchRepoRaw[]> {
  const url = new URL(`${GH_API}/search/repositories`);
  url.searchParams.set("q", q);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set(
    "per_page",
    String(opts?.perPage ?? TRENDING_PER_QUERY),
  );

  const res = await fetch(url.toString(), {
    headers: githubHeaders(),
    signal: opts?.signal,
    next: { revalidate: opts?.revalidate ?? 600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GitHub Search failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await res.json()) as { items?: GithubSearchRepoRaw[] };
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Free-text public repository search (GitHub Search API).
 * Caller must pass a query already validated via parseSearchQuery, or a raw string.
 */
export async function fetchRepoSearch(input: {
  q: string;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<GithubSearchResult> {
  const query = parseSearchQuery(input.q);
  if (!query) {
    throw new Error("Search query must be at least 2 characters");
  }
  const raw = await searchRepositories(query, {
    perPage: input.perPage ?? SEARCH_API_PER_PAGE,
    signal: input.signal,
    revalidate: 60,
  });
  return {
    query,
    fetchedAt: Date.now(),
    repos: raw
      .map((r) => mapSearchItemToCard(r, []))
      .filter((r): r is NonNullable<typeof r> => Boolean(r)),
  };
}

export async function fetchTrendingRepos(input: {
  topicIds?: readonly string[];
  signal?: AbortSignal;
}): Promise<GithubTrendingResult> {
  const topics = resolveTopics(
    input.topicIds?.length
      ? input.topicIds
      : [...DEFAULT_TRENDING_TOPICS],
  );
  const createdAfter = trendingCreatedAfter();
  const batches: Array<{
    topicId: string | null;
    repos: ReturnType<typeof mapSearchItemToCard>[];
  }> = [];

  if (topics.length === 0) {
    const raw = await searchRepositories(
      buildGlobalHotQuery({ createdAfter }),
      { signal: input.signal },
    );
    batches.push({
      topicId: null,
      repos: raw
        .map((r) => mapSearchItemToCard(r, []))
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    });
  } else {
    // Sequential to stay under rate limits; small topic sets.
    for (const topic of topics.slice(0, 5)) {
      const q = buildSearchQueryForTopic(topic, { createdAfter });
      try {
        const raw = await searchRepositories(q, { signal: input.signal });
        batches.push({
          topicId: topic.id,
          repos: raw
            .map((r) => mapSearchItemToCard(r, [topic.id]))
            .filter((r): r is NonNullable<typeof r> => Boolean(r)),
        });
      } catch {
        // Skip failed topic query; continue others.
      }
    }
    if (batches.every((b) => b.repos.length === 0)) {
      const raw = await searchRepositories(
        buildGlobalHotQuery({ createdAfter }),
        { signal: input.signal },
      );
      batches.push({
        topicId: null,
        repos: raw
          .map((r) => mapSearchItemToCard(r, []))
          .filter((r): r is NonNullable<typeof r> => Boolean(r)),
      });
    }
  }

  return {
    repos: mergeAndRankRepos(
      batches.map((b) => ({
        topicId: b.topicId,
        repos: b.repos.filter((r): r is NonNullable<typeof r> => Boolean(r)),
      })),
    ),
    topicsUsed: topics.map((t) => t.id),
    fetchedAt: Date.now(),
    windowDays: TRENDING_WINDOW_DAYS,
  };
}

async function fetchRepoReleases(
  fullName: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof mapReleaseItem>[]> {
  const url = new URL(
    `${GH_API}/repos/${fullName}/releases`,
  );
  url.searchParams.set("per_page", String(ACTIVITY_RELEASES_PER_REPO));
  const res = await fetch(url.toString(), {
    headers: githubHeaders(),
    signal,
    next: { revalidate: 600 },
  });
  if (res.status === 404) return [];
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapReleaseItem(fullName, row as Parameters<typeof mapReleaseItem>[1]))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
}

export async function fetchRepoActivity(input: {
  repos: readonly string[];
  signal?: AbortSignal;
}): Promise<GithubActivityResult> {
  const repos = parseRepoFullNames([...input.repos]);
  const batches: Array<{
    repoFullName: string;
    releases: NonNullable<ReturnType<typeof mapReleaseItem>>[];
  }> = [];
  for (const fullName of repos) {
    const releases = await fetchRepoReleases(fullName, input.signal);
    batches.push({
      repoFullName: fullName,
      releases: releases.filter(
        (r): r is NonNullable<typeof r> => Boolean(r),
      ),
    });
  }
  return {
    releases: mergeReleases(batches),
    reposQueried: repos,
    fetchedAt: Date.now(),
  };
}

async function fetchSerpNewsForQuery(
  query: string,
  topicId: string | null,
  signal?: AbortSignal,
): Promise<ReturnType<typeof parseSerpGoogleNewsPayload>> {
  const apiKey = serpApiKey();
  if (!apiKey) return [];
  const url = new URL(SERP_URL);
  url.searchParams.set("engine", "google_news");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  const res = await fetch(url.toString(), {
    signal,
    next: { revalidate: 900 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return parseSerpGoogleNewsPayload(data, topicId);
}

/**
 * Fetch default-branch README markdown for a public repo.
 * Uses the Contents API with raw Accept so the body is markdown text.
 */
export async function fetchRepoReadme(input: {
  repo: string;
  signal?: AbortSignal;
}): Promise<ReadmeFetchResult> {
  const parsed = parseRepoFullName(input.repo);
  if (!parsed.ok) {
    return { ok: false, reason: "upstream", message: parsed.error };
  }

  const url = `${GH_API}/repos/${parsed.owner}/${parsed.name}/readme`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        ...githubHeaders(),
        Accept: "application/vnd.github.raw+json",
      },
      signal: input.signal,
      next: { revalidate: 600 },
    });
  } catch (e) {
    if (input.signal?.aborted) throw e;
    return {
      ok: false,
      reason: "upstream",
      message: e instanceof Error ? e.message : "README fetch failed",
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      reason: "missing",
      message: "This repository has no README",
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "upstream",
      message: `GitHub README failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    };
  }

  const markdown = await res.text();
  if (!markdown.trim()) {
    return {
      ok: false,
      reason: "missing",
      message: "This repository has no README",
    };
  }

  return {
    ok: true,
    data: buildReadmeResult({
      fullName: parsed.fullName,
      markdown,
      htmlUrl: `https://github.com/${parsed.fullName}#readme`,
    }),
  };
}

export async function fetchTopicHeadlines(input: {
  topicIds?: readonly string[];
  signal?: AbortSignal;
}): Promise<GithubNewsResult> {
  const topics = resolveTopics(
    input.topicIds?.length
      ? input.topicIds
      : [...DEFAULT_TRENDING_TOPICS],
  );
  const batches: Array<{
    topicId: string | null;
    items: ReturnType<typeof parseSerpGoogleNewsPayload>;
  }> = [];

  for (const topic of topics.slice(0, 4)) {
    const items = await fetchSerpNewsForQuery(
      topic.newsQuery,
      topic.id,
      input.signal,
    );
    batches.push({ topicId: topic.id, items });
  }

  return {
    headlines: mergeHeadlines(batches),
    topicsUsed: topics.map((t) => t.id),
    fetchedAt: Date.now(),
  };
}
