import type { GithubHeadline } from "./types";

export type SerpNewsResultRaw = {
  title?: string;
  link?: string;
  source?: string;
  date?: string;
  snippet?: string;
};

function stableHeadlineId(link: string, title: string): string {
  const base = `${link}|${title}`.toLowerCase();
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(h).toString(36)}`;
}

export function mapSerpNewsItem(
  raw: SerpNewsResultRaw,
  topicId: string | null,
): GithubHeadline | null {
  const title = (raw.title ?? "").replace(/\s+/g, " ").trim();
  const link = (raw.link ?? "").trim();
  if (!title || !link) return null;
  if (!/^https?:\/\//i.test(link)) return null;
  return {
    id: stableHeadlineId(link, title),
    title,
    link,
    source: raw.source?.trim() || null,
    date: raw.date?.trim() || null,
    snippet: raw.snippet?.replace(/\s+/g, " ").trim() || null,
    topicId,
  };
}

/**
 * Merge headlines from multiple topic searches; prefer first occurrence,
 * union is by link.
 */
export function mergeHeadlines(
  batches: Array<{ topicId: string | null; items: GithubHeadline[] }>,
  max = 40,
): GithubHeadline[] {
  const byLink = new Map<string, GithubHeadline>();
  for (const batch of batches) {
    for (const item of batch.items) {
      const key = item.link.toLowerCase();
      if (byLink.has(key)) continue;
      byLink.set(key, {
        ...item,
        topicId: item.topicId ?? batch.topicId,
      });
    }
  }
  return Array.from(byLink.values()).slice(0, Math.max(0, max));
}

export function parseSerpGoogleNewsPayload(
  data: unknown,
  topicId: string | null,
): GithubHeadline[] {
  if (!data || typeof data !== "object") return [];
  const newsResults = (data as { news_results?: unknown }).news_results;
  if (!Array.isArray(newsResults)) return [];
  const out: GithubHeadline[] = [];
  for (const row of newsResults) {
    if (!row || typeof row !== "object") continue;
    const mapped = mapSerpNewsItem(row as SerpNewsResultRaw, topicId);
    if (mapped) out.push(mapped);
  }
  return out;
}
