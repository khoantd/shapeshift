import { describe, expect, test } from "bun:test";
import {
  mapSerpNewsItem,
  mergeHeadlines,
  parseSerpGoogleNewsPayload,
} from "./news";

describe("mapSerpNewsItem", () => {
  test("maps a valid news row", () => {
    const h = mapSerpNewsItem(
      {
        title: "New TypeScript release",
        link: "https://example.com/ts",
        source: "Example",
        date: "2 hours ago",
        snippet: "Ship it",
      },
      "typescript",
    );
    expect(h?.title).toBe("New TypeScript release");
    expect(h?.topicId).toBe("typescript");
    expect(h?.id).toMatch(/^h/);
  });

  test("rejects non-http links", () => {
    expect(
      mapSerpNewsItem(
        { title: "x", link: "javascript:alert(1)" },
        null,
      ),
    ).toBeNull();
  });
});

describe("mergeHeadlines", () => {
  test("dedupes by link", () => {
    const a = mapSerpNewsItem(
      { title: "A", link: "https://ex.com/a" },
      "ai",
    )!;
    const b = mapSerpNewsItem(
      { title: "A again", link: "https://ex.com/a" },
      "llm",
    )!;
    const c = mapSerpNewsItem(
      { title: "C", link: "https://ex.com/c" },
      "web",
    )!;
    expect(
      mergeHeadlines([
        { topicId: "ai", items: [a] },
        { topicId: "llm", items: [b, c] },
      ]),
    ).toHaveLength(2);
  });
});

describe("parseSerpGoogleNewsPayload", () => {
  test("parses news_results array", () => {
    const items = parseSerpGoogleNewsPayload(
      {
        news_results: [
          { title: "One", link: "https://ex.com/1" },
          { title: "", link: "https://ex.com/2" },
        ],
      },
      "rust",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.topicId).toBe("rust");
  });

  test("handles missing payload", () => {
    expect(parseSerpGoogleNewsPayload(null, null)).toEqual([]);
  });
});
