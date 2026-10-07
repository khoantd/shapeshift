import { describe, expect, test } from "bun:test";
import {
  pickEnabledRefreshTargets,
  refreshSourcesSequentially,
  type FetchedFeedItem,
  type RefreshableSource,
} from "./refreshFeed";

const baseSource = (over: Partial<RefreshableSource> = {}): RefreshableSource => ({
  id: "src-1",
  siteUrl: "https://example.com",
  feedUrl: "https://example.com/rss",
  fetchMode: "rss",
  enabled: true,
  ...over,
});

describe("pickEnabledRefreshTargets", () => {
  test("keeps enabled sources with a site URL", () => {
    const sources = [
      baseSource({ id: "a" }),
      baseSource({ id: "b", enabled: false }),
      baseSource({ id: "c", siteUrl: "  " }),
      baseSource({ id: "d", fetchMode: "failed" }),
    ];
    expect(pickEnabledRefreshTargets(sources).map((s) => s.id)).toEqual(["a", "d"]);
  });
});

describe("refreshSourcesSequentially", () => {
  test("fetches, upserts, and marks success per source", async () => {
    const items: FetchedFeedItem[] = [
      {
        title: "Hello",
        excerpt: "World",
        canonicalUrl: "https://example.com/a",
        publishedAtIso: "2026-10-06T00:00:00.000Z",
        contentHash: "hash-a",
        ingestMethod: "rss",
        thumbnailUrl: null,
      },
    ];
    const upserted: Array<{ sourceId: string; count: number }> = [];
    const marked: Array<{ sourceId: string; lastError: string | null }> = [];

    const summary = await refreshSourcesSequentially([baseSource()], {
      fetchSource: async () => ({ ok: true, items, fetchMode: "rss" }),
      upsertItems: async (sourceId, next) => {
        upserted.push({ sourceId, count: next.length });
      },
      markFetched: async (sourceId, patch) => {
        marked.push({ sourceId, lastError: patch.lastError });
      },
    });

    expect(summary.okCount).toBe(1);
    expect(summary.failCount).toBe(0);
    expect(upserted).toEqual([{ sourceId: "src-1", count: 1 }]);
    expect(marked).toEqual([{ sourceId: "src-1", lastError: null }]);
    expect(summary.results[0]?.insertedAttempted).toBe(1);
  });

  test("continues after a failed source and records the error", async () => {
    const sources = [
      baseSource({ id: "ok", siteUrl: "https://ok.example" }),
      baseSource({ id: "bad", siteUrl: "https://bad.example" }),
    ];
    const summary = await refreshSourcesSequentially(sources, {
      fetchSource: async (src) => {
        if (src.id === "bad") return { ok: false, error: "timeout", fetchMode: "failed" };
        return { ok: true, items: [], fetchMode: "rss" };
      },
      upsertItems: async () => {},
      markFetched: async () => {},
    });

    expect(summary.okCount).toBe(1);
    expect(summary.failCount).toBe(1);
    expect(summary.results.find((r) => r.sourceId === "bad")?.error).toBe("timeout");
  });

  test("marks lastError when fetch succeeds but returns no items", async () => {
    const marked: Array<{ lastError: string | null }> = [];
    await refreshSourcesSequentially([baseSource()], {
      fetchSource: async () => ({ ok: true, items: [], fetchMode: "rss" }),
      upsertItems: async () => {
        throw new Error("should not upsert empty");
      },
      markFetched: async (_id, patch) => {
        marked.push({ lastError: patch.lastError });
      },
    });
    expect(marked[0]?.lastError).toBe("No new items");
  });
});
