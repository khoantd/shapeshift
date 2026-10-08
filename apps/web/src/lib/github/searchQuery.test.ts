import { describe, expect, test } from "bun:test";
import {
  filterReposByQuery,
  parseSearchQuery,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
} from "./searchQuery";
import type { GithubRepoCard } from "./types";

function card(
  overrides: Partial<GithubRepoCard> & Pick<GithubRepoCard, "id" | "fullName">,
): GithubRepoCard {
  const [owner, name] = overrides.fullName.split("/");
  return {
    owner: owner ?? "o",
    name: name ?? "n",
    description: null,
    htmlUrl: `https://github.com/${overrides.fullName}`,
    language: null,
    stars: 0,
    forks: 0,
    openIssues: 0,
    topics: [],
    pushedAt: null,
    createdAt: null,
    matchedTopicIds: [],
    ...overrides,
  };
}

describe("parseSearchQuery", () => {
  test("returns null for short or empty input", () => {
    expect(parseSearchQuery(null)).toBeNull();
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery("  ")).toBeNull();
    expect(parseSearchQuery("a")).toBeNull();
    expect(parseSearchQuery(" a ")).toBeNull();
  });

  test("trims and collapses whitespace at min length", () => {
    expect(parseSearchQuery("  ts  ")).toBe("ts");
    expect(parseSearchQuery("react  query")).toBe("react query");
    expect(SEARCH_QUERY_MIN).toBe(2);
  });

  test("caps length at SEARCH_QUERY_MAX", () => {
    const long = "x".repeat(SEARCH_QUERY_MAX + 20);
    const parsed = parseSearchQuery(long);
    expect(parsed).toHaveLength(SEARCH_QUERY_MAX);
  });
});

describe("filterReposByQuery", () => {
  const repos = [
    card({
      id: 1,
      fullName: "vercel/next.js",
      description: "The React Framework",
      language: "JavaScript",
      topics: ["react", "framework"],
    }),
    card({
      id: 2,
      fullName: "facebook/react",
      description: "A library for web UIs",
      language: "JavaScript",
      topics: ["ui"],
    }),
    card({
      id: 3,
      fullName: "rust-lang/rust",
      description: "Empowering everyone",
      language: "Rust",
      topics: ["systems"],
    }),
  ];

  test("empty query returns all repos", () => {
    expect(filterReposByQuery(repos, "")).toHaveLength(3);
    expect(filterReposByQuery(repos, "   ")).toHaveLength(3);
  });

  test("matches fullName and name", () => {
    expect(filterReposByQuery(repos, "next").map((r) => r.id)).toEqual([1]);
    expect(filterReposByQuery(repos, "facebook").map((r) => r.id)).toEqual([
      2,
    ]);
  });

  test("matches description, language, and topics", () => {
    expect(filterReposByQuery(repos, "framework").map((r) => r.id)).toEqual([
      1,
    ]);
    expect(filterReposByQuery(repos, "rust").map((r) => r.id)).toEqual([3]);
    expect(filterReposByQuery(repos, "systems").map((r) => r.id)).toEqual([
      3,
    ]);
  });

  test("requires all tokens (AND)", () => {
    expect(
      filterReposByQuery(repos, "react javascript").map((r) => r.id),
    ).toEqual([1, 2]);
    expect(filterReposByQuery(repos, "react rust")).toEqual([]);
  });
});
