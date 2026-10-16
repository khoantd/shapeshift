import { describe, expect, test } from "bun:test";
import {
  formatRelativeTime,
  intentTopKey,
  newsCategoryMatch,
  type NewsFeedItem,
} from "./apiCore";

const item = (over: Partial<NewsFeedItem> = {}): NewsFeedItem => ({
  id: "1",
  title: "Apple ships on-device AI",
  excerpt: "Foundation Models API for third-party apps",
  canonicalUrl: "https://example.com",
  publishedAt: new Date().toISOString(),
  isRead: false,
  isPinned: false,
  sourceDisplayName: "The Verge",
  ...over,
});

describe("newsCategoryMatch", () => {
  test("Top matches all", () => {
    expect(newsCategoryMatch(item(), "Top")).toBe(true);
  });

  test("Tech matches AI/tech titles", () => {
    expect(newsCategoryMatch(item(), "Tech")).toBe(true);
    expect(
      newsCategoryMatch(
        item({
          title: "Central banks hold rates",
          excerpt: "markets",
          sourceDisplayName: "Reuters",
        }),
        "Tech",
      ),
    ).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  test("minutes and hours", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(
      formatRelativeTime(new Date(now - 14 * 60_000).toISOString(), now),
    ).toBe("14m");
    expect(
      formatRelativeTime(new Date(now - 3 * 3600_000).toISOString(), now),
    ).toBe("3h");
  });
});

describe("intentTopKey", () => {
  test("reads topIntent", () => {
    expect(intentTopKey({ topIntent: "Tip" })).toBe("tip");
    expect(intentTopKey({ intent: "news" })).toBe("news");
    expect(intentTopKey(null)).toBe("none");
  });
});
