import type { HistoryPack } from "@/lib/youtube/historyPack";

/** Suggested search topics for the home empty state. */
export const HOME_TOPIC_CHIPS = [
  "system design",
  "distributed systems",
  "software architecture",
  "kubernetes",
  "database internals",
  "API design",
] as const;

/** Latest pack (history is newest-first). */
export function pickContinuePack(
  packs: readonly HistoryPack[],
): HistoryPack | null {
  return packs[0] ?? null;
}

/**
 * Prefer the continue pack’s graph; otherwise the first pack with a graphPayload.
 */
export function pickTeaserGraphPack(
  packs: readonly HistoryPack[],
): HistoryPack | null {
  const continuePack = pickContinuePack(packs);
  if (continuePack?.graphPayload) return continuePack;
  for (const pack of packs) {
    if (pack.graphPayload) return pack;
  }
  return null;
}

/** Packs after the continue hero, capped for the home “More packs” row. */
export function pickMorePacks(
  packs: readonly HistoryPack[],
  limit = 4,
): HistoryPack[] {
  if (packs.length <= 1) return [];
  return packs.slice(1, 1 + Math.max(0, limit));
}
