import { describe, expect, test } from "bun:test";
import type { NewsBriefView, NewsFeedItem } from "@shapeshift/react";
import {
  filterByReadStatus,
  parseReadFilter,
  parseSortOrder,
  sortFeed,
} from "./newsFeedView";

function item(partial: Partial<NewsFeedItem> & Pick<NewsFeedItem, "id" | "title">): NewsFeedItem {
  return {
    excerpt: "",
    canonicalUrl: "https://example.com",
    publishedAt: "2026-01-01T00:00:00Z",
    isRead: false,
    isPinned: false,
    ...partial,
  };
}

function brief(
  partial: Partial<NewsBriefView> & Pick<NewsBriefView, "urgency" | "relevance" | "tone">,
): NewsBriefView {
  return {
    line: "test",
    ...partial,
  };
}

describe("parseReadFilter", () => {
  test("accepts unread and read", () => {
    expect(parseReadFilter("unread")).toBe("unread");
    expect(parseReadFilter("read")).toBe("read");
  });

  test("defaults to all", () => {
    expect(parseReadFilter(null)).toBe("all");
    expect(parseReadFilter(undefined)).toBe("all");
    expect(parseReadFilter("")).toBe("all");
    expect(parseReadFilter("other")).toBe("all");
  });
});

describe("parseSortOrder", () => {
  test("accepts oldest", () => {
    expect(parseSortOrder("oldest")).toBe("oldest");
  });

  test("defaults to newest", () => {
    expect(parseSortOrder(null)).toBe("newest");
    expect(parseSortOrder("newest")).toBe("newest");
    expect(parseSortOrder("")).toBe("newest");
  });
});

describe("filterByReadStatus", () => {
  const rows = [
    item({ id: "1", title: "A", isRead: false }),
    item({ id: "2", title: "B", isRead: true }),
    item({ id: "3", title: "C", isRead: false }),
  ];

  test("all returns everything", () => {
    expect(filterByReadStatus(rows, "all").map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  test("unread filters", () => {
    expect(filterByReadStatus(rows, "unread").map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("read filters", () => {
    expect(filterByReadStatus(rows, "read").map((r) => r.id)).toEqual(["2"]);
  });
});

describe("sortFeed", () => {
  test("newest puts later dates first; pinned stays on top", () => {
    const rows = [
      item({ id: "old", title: "Old", publishedAt: "2026-01-01T00:00:00Z" }),
      item({ id: "new", title: "New", publishedAt: "2026-03-01T00:00:00Z" }),
      item({ id: "pin", title: "Pin", publishedAt: "2026-02-01T00:00:00Z", isPinned: true }),
    ];
    expect(sortFeed(rows, {}, "", "newest").map((r) => r.id)).toEqual(["pin", "new", "old"]);
  });

  test("oldest reverses date order under pinned", () => {
    const rows = [
      item({ id: "old", title: "Old", publishedAt: "2026-01-01T00:00:00Z" }),
      item({ id: "new", title: "New", publishedAt: "2026-03-01T00:00:00Z" }),
      item({ id: "mid", title: "Mid", publishedAt: "2026-02-01T00:00:00Z" }),
    ];
    expect(sortFeed(rows, {}, "", "oldest").map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });

  test("equal dates use brief score when query active", () => {
    const rows = [
      item({ id: "a", title: "A", publishedAt: "2026-01-01T00:00:00Z" }),
      item({ id: "b", title: "B", publishedAt: "2026-01-01T00:00:00Z" }),
    ];
    const briefs = {
      a: brief({ urgency: 0.2, relevance: 0.9, tone: "neutral" }),
      b: brief({ urgency: 0.9, relevance: 0.1, tone: "neutral" }),
    };
    expect(sortFeed(rows, briefs, "topic", "newest").map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("does not prefer unread over read", () => {
    const rows = [
      item({ id: "read", title: "R", publishedAt: "2026-03-01T00:00:00Z", isRead: true }),
      item({ id: "unread", title: "U", publishedAt: "2026-01-01T00:00:00Z", isRead: false }),
    ];
    expect(sortFeed(rows, {}, "", "newest").map((r) => r.id)).toEqual(["read", "unread"]);
  });
});
