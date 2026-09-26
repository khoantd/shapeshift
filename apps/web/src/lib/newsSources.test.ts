import { describe, expect, test } from "bun:test";
import type { NewsFeedItem } from "@shapeshift/react";
import { buildNewsSourceOptions, resolveNewsSourceId } from "./newsSources";

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

describe("resolveNewsSourceId", () => {
  const catalog = [
    { id: "uuid-reuters", name: "Reuters" },
    { id: "uuid-wired", name: "Wired" },
  ];

  test("matches display name case-insensitively", () => {
    expect(resolveNewsSourceId(catalog, "reuters")).toBe("uuid-reuters");
  });

  test("matches source id", () => {
    expect(resolveNewsSourceId(catalog, "uuid-wired")).toBe("uuid-wired");
  });

  test("returns null for unknown hint", () => {
    expect(resolveNewsSourceId(catalog, "Bloomberg")).toBeNull();
  });

  test("returns null for blank hint", () => {
    expect(resolveNewsSourceId(catalog, "  ")).toBeNull();
  });
});

describe("buildNewsSourceOptions", () => {
  test("includes catalog sources even when no feed items carry that name", () => {
    const options = buildNewsSourceOptions(
      ["Reuters", "Bloomberg", "TechCrunch"],
      [item({ id: "1", title: "Only Reuters story", sourceDisplayName: "Reuters" })],
    );
    expect(options.map((o) => o.name)).toEqual(["Bloomberg", "Reuters", "TechCrunch"]);
    expect(options.find((o) => o.name === "Bloomberg")?.example).toBe("topic keywords…");
    expect(options.find((o) => o.name === "Reuters")?.example).toBe("Only Reuters story");
  });

  test("unions item-only sources that are missing from the catalog", () => {
    const options = buildNewsSourceOptions(
      ["Reuters"],
      [item({ id: "1", title: "Wire story", sourceDisplayName: "AP" })],
    );
    expect(options.map((o) => o.name)).toEqual(["AP", "Reuters"]);
  });

  test("ignores blank names", () => {
    const options = buildNewsSourceOptions(
      ["  ", "Wired"],
      [item({ id: "1", title: "x", sourceDisplayName: "  " })],
    );
    expect(options.map((o) => o.name)).toEqual(["Wired"]);
  });
});
