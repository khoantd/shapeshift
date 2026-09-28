import type { NewsBriefView, NewsFeedItem } from "@shapeshift/react";
import { briefScore } from "./newsStats";

export type NewsReadFilter = "all" | "unread" | "read";
export type NewsSortOrder = "newest" | "oldest";

export function parseReadFilter(raw: string | null | undefined): NewsReadFilter {
  if (raw === "unread" || raw === "read") return raw;
  return "all";
}

export function parseSortOrder(raw: string | null | undefined): NewsSortOrder {
  if (raw === "oldest") return "oldest";
  return "newest";
}

export function filterByReadStatus(
  items: readonly NewsFeedItem[],
  readFilter: NewsReadFilter,
): NewsFeedItem[] {
  if (readFilter === "all") return [...items];
  if (readFilter === "unread") return items.filter((item) => !item.isRead);
  return items.filter((item) => item.isRead);
}

/**
 * Sort feed: pinned first, then by publishedAt (newest/oldest).
 * When dates are equal and a query is active, brief score is a tiebreaker.
 */
export function sortFeed(
  items: readonly NewsFeedItem[],
  briefs: Record<string, NewsBriefView>,
  filterQ: string,
  sortOrder: NewsSortOrder = "newest",
): NewsFeedItem[] {
  const hasQuery = Boolean(filterQ.trim());
  const dateDir = sortOrder === "oldest" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    if (ta !== tb) return (ta - tb) * dateDir;
    if (hasQuery) {
      const scoreA = briefScore(briefs[a.id], true);
      const scoreB = briefScore(briefs[b.id], true);
      if (scoreA !== scoreB) return scoreB - scoreA;
    }
    return 0;
  });
}
