import { describe, expect, test } from "bun:test";
import { parseRecentRepos, pushRecentRepo } from "./recentRepos";

describe("parseRecentRepos", () => {
  test("dedupes and sorts by visitedAt", () => {
    const list = parseRecentRepos([
      { fullName: "a/b", visitedAt: 1 },
      { fullName: "c/d", visitedAt: 3 },
      { fullName: "a/b", visitedAt: 2 },
      { fullName: "bad", visitedAt: 9 },
    ]);
    expect(list.map((r) => r.fullName)).toEqual(["c/d", "a/b"]);
  });
});

describe("pushRecentRepo", () => {
  test("moves repo to front", () => {
    const next = pushRecentRepo(
      [
        { fullName: "a/b", visitedAt: 1 },
        { fullName: "c/d", visitedAt: 2 },
      ],
      "a/b",
      10,
    );
    expect(next[0]).toEqual({ fullName: "a/b", visitedAt: 10 });
    expect(next).toHaveLength(2);
  });
});
