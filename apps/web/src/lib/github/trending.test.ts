import { describe, expect, test } from "bun:test";
import { getTopicById } from "./topics";
import {
  buildGlobalHotQuery,
  buildSearchQueryForTopic,
  mapSearchItemToCard,
  mergeAndRankRepos,
  trendingCreatedAfter,
} from "./trending";
import type { GithubRepoCard } from "./types";

describe("trendingCreatedAfter", () => {
  test("returns YYYY-MM-DD seven days before", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    expect(trendingCreatedAfter(now, 7)).toBe("2026-09-30");
  });
});

describe("buildSearchQueryForTopic", () => {
  test("includes language for TypeScript topic", () => {
    const topic = getTopicById("typescript")!;
    const q = buildSearchQueryForTopic(topic, {
      createdAfter: "2026-09-30",
      minStars: 5,
    });
    expect(q).toContain("created:>2026-09-30");
    expect(q).toContain("stars:>5");
    expect(q).toContain("language:TypeScript");
  });

  test("global hot query has no language", () => {
    const q = buildGlobalHotQuery({
      createdAfter: "2026-09-30",
      minStars: 10,
    });
    expect(q).toContain("created:>2026-09-30");
    expect(q).toContain("stars:>10");
    expect(q).not.toContain("language:");
  });
});

describe("mapSearchItemToCard", () => {
  test("maps a valid search hit", () => {
    const card = mapSearchItemToCard(
      {
        id: 1,
        full_name: "acme/widget",
        name: "widget",
        html_url: "https://github.com/acme/widget",
        description: "A widget",
        language: "TypeScript",
        stargazers_count: 42,
        forks_count: 3,
        open_issues_count: 1,
        topics: ["cli"],
        owner: { login: "acme" },
      },
      ["typescript"],
    );
    expect(card).toEqual({
      id: 1,
      fullName: "acme/widget",
      owner: "acme",
      name: "widget",
      description: "A widget",
      htmlUrl: "https://github.com/acme/widget",
      language: "TypeScript",
      stars: 42,
      forks: 3,
      openIssues: 1,
      topics: ["cli"],
      pushedAt: null,
      createdAt: null,
      matchedTopicIds: ["typescript"],
    });
  });

  test("rejects incomplete rows", () => {
    expect(mapSearchItemToCard({ id: 1 })).toBeNull();
  });
});

describe("mergeAndRankRepos", () => {
  const base = (overrides: Partial<GithubRepoCard>): GithubRepoCard => ({
    id: 1,
    fullName: "a/b",
    owner: "a",
    name: "b",
    description: null,
    htmlUrl: "https://github.com/a/b",
    language: null,
    stars: 10,
    forks: 0,
    openIssues: 0,
    topics: [],
    pushedAt: null,
    createdAt: null,
    matchedTopicIds: [],
    ...overrides,
  });

  test("dedupes by id and unions topic ids; sorts by stars", () => {
    const merged = mergeAndRankRepos([
      {
        topicId: "typescript",
        repos: [base({ id: 1, stars: 10, fullName: "a/low" })],
      },
      {
        topicId: "ai",
        repos: [
          base({ id: 1, stars: 50, fullName: "a/low" }),
          base({ id: 2, stars: 100, fullName: "b/hot", name: "hot", owner: "b", htmlUrl: "https://github.com/b/hot" }),
        ],
      },
    ]);
    expect(merged.map((r) => r.id)).toEqual([2, 1]);
    expect(merged[1]?.matchedTopicIds.sort()).toEqual(["ai", "typescript"]);
  });
});
