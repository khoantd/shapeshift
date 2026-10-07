import { describe, expect, test } from "bun:test";
import {
  MAX_FAVORITE_TOPICS,
  normalizeFavoriteTopics,
  normalizeTopicId,
  parseTopicsQueryParam,
  resolveTopics,
  topicsToQueryParam,
} from "./topics";

describe("normalizeTopicId", () => {
  test("trims and lowercases", () => {
    expect(normalizeTopicId("  TypeScript ")).toBe("typescript");
  });

  test("collapses spaces to dashes", () => {
    expect(normalizeTopicId("AI  ML")).toBe("ai-ml");
  });
});

describe("normalizeFavoriteTopics", () => {
  test("keeps known ids, dedupes, drops unknown", () => {
    expect(
      normalizeFavoriteTopics(["TypeScript", "typescript", "nope", "rust"]),
    ).toEqual(["typescript", "rust"]);
  });

  test("caps at MAX_FAVORITE_TOPICS", () => {
    const many = [
      "typescript",
      "javascript",
      "python",
      "rust",
      "go",
      "ai",
      "llm",
      "web",
      "devops",
      "security",
      "database",
      "mobile",
      "typescript",
    ];
    expect(normalizeFavoriteTopics(many)).toHaveLength(MAX_FAVORITE_TOPICS);
  });
});

describe("parseTopicsQueryParam / topicsToQueryParam", () => {
  test("parses comma and plus", () => {
    expect(parseTopicsQueryParam("typescript,ai+rust")).toEqual([
      "typescript",
      "ai",
      "rust",
    ]);
  });

  test("round-trips", () => {
    expect(topicsToQueryParam(["rust", "ai"])).toBe("rust,ai");
  });
});

describe("resolveTopics", () => {
  test("returns catalog entries", () => {
    const topics = resolveTopics(["typescript", "unknown"]);
    expect(topics).toHaveLength(1);
    expect(topics[0]?.githubLanguage).toBe("TypeScript");
  });
});
