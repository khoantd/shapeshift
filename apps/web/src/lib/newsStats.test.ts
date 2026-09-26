import { describe, expect, test } from "bun:test";
import type { NewsBriefView, NewsFeedItem } from "@shapeshift/react";
import {
  aggregateNewsBriefStats,
  briefScore,
  SCORE_UNSCORED_LIMIT,
} from "./newsStats";

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

function brief(partial: Partial<NewsBriefView> & Pick<NewsBriefView, "urgency" | "relevance" | "tone">): NewsBriefView {
  return {
    line: "test",
    ...partial,
  };
}

describe("briefScore", () => {
  test("uses urgency when no query", () => {
    expect(briefScore(brief({ urgency: 0.8, relevance: 0.2, tone: "neutral" }), false)).toBe(0.8);
  });

  test("uses relevance when query present", () => {
    expect(briefScore(brief({ urgency: 0.8, relevance: 0.2, tone: "neutral" }), true)).toBe(0.2);
  });

  test("returns -1 for missing brief", () => {
    expect(briefScore(undefined, false)).toBe(-1);
  });
});

describe("aggregateNewsBriefStats", () => {
  test("empty feed", () => {
    const stats = aggregateNewsBriefStats([], {}, "");
    expect(stats.total).toBe(0);
    expect(stats.briefed).toBe(0);
    expect(stats.unscored).toBe(0);
    expect(stats.avgUrgency).toBeNull();
    expect(stats.avgRelevance).toBeNull();
    expect(stats.tone).toEqual({ neutral: 0, caution: 0, opportunity: 0 });
    expect(stats.ranked).toEqual([]);
    expect(stats.unscoredIds).toEqual([]);
  });

  test("partial briefs — coverage and averages from briefed only", () => {
    const items = [
      item({ id: "a", title: "A", publishedAt: "2026-01-03T00:00:00Z" }),
      item({ id: "b", title: "B", publishedAt: "2026-01-02T00:00:00Z" }),
      item({ id: "c", title: "C", publishedAt: "2026-01-01T00:00:00Z" }),
    ];
    const briefs: Record<string, NewsBriefView> = {
      a: brief({ urgency: 0.9, relevance: 0.5, tone: "caution" }),
      b: brief({ urgency: 0.3, relevance: 0.7, tone: "opportunity" }),
    };
    const stats = aggregateNewsBriefStats(items, briefs, "");
    expect(stats.total).toBe(3);
    expect(stats.briefed).toBe(2);
    expect(stats.unscored).toBe(1);
    expect(stats.unscoredIds).toEqual(["c"]);
    expect(stats.avgUrgency).toBeCloseTo(0.6);
    expect(stats.avgRelevance).toBeCloseTo(0.6);
    expect(stats.tone).toEqual({ neutral: 0, caution: 1, opportunity: 1 });
  });

  test("ranks by urgency without query", () => {
    const items = [
      item({ id: "low", title: "Low", publishedAt: "2026-01-02T00:00:00Z" }),
      item({ id: "high", title: "High", publishedAt: "2026-01-01T00:00:00Z" }),
    ];
    const briefs: Record<string, NewsBriefView> = {
      low: brief({ urgency: 0.2, relevance: 0.9, tone: "neutral" }),
      high: brief({ urgency: 0.95, relevance: 0.1, tone: "caution" }),
    };
    const stats = aggregateNewsBriefStats(items, briefs, "");
    expect(stats.ranked.map((r) => r.id)).toEqual(["high", "low"]);
    expect(stats.ranked[0]?.score).toBe(0.95);
  });

  test("ranks by relevance with query", () => {
    const items = [
      item({ id: "urgent", title: "Urgent", publishedAt: "2026-01-02T00:00:00Z" }),
      item({ id: "relevant", title: "Relevant", publishedAt: "2026-01-01T00:00:00Z" }),
    ];
    const briefs: Record<string, NewsBriefView> = {
      urgent: brief({ urgency: 0.95, relevance: 0.1, tone: "neutral" }),
      relevant: brief({ urgency: 0.2, relevance: 0.9, tone: "opportunity" }),
    };
    const stats = aggregateNewsBriefStats(items, briefs, "ai");
    expect(stats.ranked.map((r) => r.id)).toEqual(["relevant", "urgent"]);
    expect(stats.ranked[0]?.score).toBe(0.9);
  });

  test("SCORE_UNSCORED_LIMIT is 10", () => {
    expect(SCORE_UNSCORED_LIMIT).toBe(10);
  });
});
