import type { NewsBriefView, NewsFeedItem } from "@shapeshift/react";

export const SCORE_UNSCORED_LIMIT = 10;
export const RANKED_LIMIT = 10;

export type NewsToneCounts = {
  neutral: number;
  caution: number;
  opportunity: number;
};

export type RankedNewsStat = {
  id: string;
  title: string;
  sourceDisplayName?: string;
  publishedAt: string;
  urgency: number;
  relevance: number;
  tone: NewsBriefView["tone"];
  line: string;
  score: number;
};

export type NewsBriefStats = {
  total: number;
  briefed: number;
  unscored: number;
  avgUrgency: number | null;
  avgRelevance: number | null;
  tone: NewsToneCounts;
  ranked: RankedNewsStat[];
  unscoredIds: string[];
};

/** Soft-rank score: relevance when filtering by query, else urgency. Missing brief → -1. */
export function briefScore(brief: NewsBriefView | undefined, hasQuery: boolean): number {
  if (!brief) return -1;
  return hasQuery ? brief.relevance : brief.urgency;
}

function resolveBrief(
  item: NewsFeedItem,
  briefs: Record<string, NewsBriefView>,
  filterQ: string,
): NewsBriefView | undefined {
  const q = filterQ.trim();
  if (q) {
    const keyed = briefs[`${item.id}::${q}`];
    if (keyed) return keyed;
  }
  return briefs[item.id];
}

/**
 * Aggregate Jev brief coverage, averages, tone mix, and ranked stories
 * for the current filtered feed slice.
 */
export function aggregateNewsBriefStats(
  items: NewsFeedItem[],
  briefs: Record<string, NewsBriefView>,
  filterQ: string,
): NewsBriefStats {
  const hasQuery = Boolean(filterQ.trim());
  const tone: NewsToneCounts = { neutral: 0, caution: 0, opportunity: 0 };
  const unscoredIds: string[] = [];
  const rankedCandidates: RankedNewsStat[] = [];

  let sumU = 0;
  let sumR = 0;
  let briefed = 0;

  for (const item of items) {
    const b = resolveBrief(item, briefs, filterQ);
    if (!b) {
      unscoredIds.push(item.id);
      continue;
    }
    briefed += 1;
    sumU += b.urgency;
    sumR += b.relevance;
    tone[b.tone] += 1;
    rankedCandidates.push({
      id: item.id,
      title: item.title,
      sourceDisplayName: item.sourceDisplayName,
      publishedAt: item.publishedAt,
      urgency: b.urgency,
      relevance: b.relevance,
      tone: b.tone,
      line: b.line,
      score: briefScore(b, hasQuery),
    });
  }

  rankedCandidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    return tb - ta;
  });

  return {
    total: items.length,
    briefed,
    unscored: unscoredIds.length,
    avgUrgency: briefed > 0 ? sumU / briefed : null,
    avgRelevance: briefed > 0 ? sumR / briefed : null,
    tone,
    ranked: rankedCandidates.slice(0, RANKED_LIMIT),
    unscoredIds,
  };
}
