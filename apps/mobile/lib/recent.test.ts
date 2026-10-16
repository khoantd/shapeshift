import { describe, expect, test } from "bun:test";
import {
  RECENT_PAGE_SIZE,
  filterRecentItems,
  pageRecentItems,
  type RecentItem,
} from "./recentCore";

const sample: RecentItem[] = [
  {
    id: "1",
    title: "Summarize this article",
    meta: "nytimes.com · 2h ago",
    kind: "link",
    createdAt: 3,
  },
  {
    id: "2",
    title: "Split dinner bill 4 ways",
    meta: "Gadget · Yesterday",
    kind: "split",
    createdAt: 2,
  },
  {
    id: "3",
    title: "Translate menu to English",
    meta: "Camera · 2 days ago",
    kind: "translate",
    createdAt: 1,
  },
];

describe("filterRecentItems", () => {
  test("matches title meta and kind", () => {
    expect(filterRecentItems(sample, "split")).toHaveLength(1);
    expect(filterRecentItems(sample, "gadget")).toHaveLength(1);
    expect(filterRecentItems(sample, "")).toHaveLength(3);
  });
});

describe("pageRecentItems", () => {
  test("pages by five", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...sample[0]!,
      id: String(i),
      createdAt: i,
    }));
    expect(pageRecentItems(many, 1)).toHaveLength(RECENT_PAGE_SIZE);
    expect(pageRecentItems(many, 2)).toHaveLength(10);
    expect(pageRecentItems(many, 3)).toHaveLength(12);
  });
});
