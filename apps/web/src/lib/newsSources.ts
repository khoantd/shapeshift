import type { NewsFeedItem, NewsSourceOption } from "@shapeshift/react";

export type NewsSourceCatalogEntry = {
  id: string;
  name: string;
};

/**
 * Resolve a `/source` hint (display name or uuid) to a catalog source id.
 * Prefers exact case-insensitive display-name match, then id match.
 */
export function resolveNewsSourceId(
  catalog: readonly NewsSourceCatalogEntry[],
  hint: string,
): string | null {
  const needle = hint.trim().toLowerCase();
  if (!needle) return null;
  const byName = catalog.find((s) => s.name.trim().toLowerCase() === needle);
  if (byName) return byName.id;
  const byId = catalog.find((s) => s.id.trim().toLowerCase() === needle);
  return byId?.id ?? null;
}

/**
 * Build `/source` palette rows from the Inspired Canvas source catalog,
 * enriched with a sample headline from currently loaded feed items when available.
 *
 * Catalog names should come from `ba_cxo_feed_sources` (full list), not only
 * sources that happen to appear in the recent-items window.
 */
export function buildNewsSourceOptions(
  catalogNames: readonly string[],
  items: readonly NewsFeedItem[],
): NewsSourceOption[] {
  const names = new Set<string>();
  for (const raw of catalogNames) {
    const n = raw.trim();
    if (n) names.add(n);
  }
  for (const item of items) {
    const n = item.sourceDisplayName?.trim();
    if (n) names.add(n);
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const sample = items.find((i) => i.sourceDisplayName?.trim() === name);
      const example = sample?.title?.trim() || "topic keywords…";
      return { name, example };
    });
}
