import type { CardIntent } from "@shapeshift/core/jev/types";
import type { SavedItem } from "./savedItems";

/** Initial / step size for the Saved cards list. */
export const SAVED_PAGE_SIZE = 5;

/**
 * Case-insensitive filter over summary, intent label, and card text.
 * Empty / whitespace query returns the input list unchanged.
 */
export function filterSavedItems(
  items: SavedItem[],
  query: string,
  labelForIntent: (intent: Exclude<CardIntent, "none">) => string,
): SavedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const label = labelForIntent(item.intent).toLowerCase();
    return (
      item.summary.toLowerCase().includes(q) ||
      label.includes(q) ||
      item.text.toLowerCase().includes(q)
    );
  });
}

/** Slice a filtered list for progressive disclosure. */
export function pageSavedItems(items: SavedItem[], visibleCount: number) {
  const count = Math.max(0, visibleCount);
  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    total: items.length,
  };
}
