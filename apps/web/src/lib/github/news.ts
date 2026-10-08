import type { GithubHeadline } from "./types";

/** SerpAPI google_news may return source as a string or `{ name, icon, authors }`. */
export type SerpNewsSource =
  | string
  | {
      name?: string;
      icon?: string;
      authors?: string[];
    };

export type SerpNewsResultRaw = {
  title?: string;
  link?: string;
  source?: SerpNewsSource;
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

function normalizeSerpSource(source: SerpNewsSource | undefined): string | null {
  if (typeof source === "string") {
    const trimmed = source.trim();
    return trimmed || null;
  }
  if (source && typeof source === "object" && typeof source.name === "string") {
    const trimmed = source.name.trim();
    return trimmed || null;
  }
  return null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function mapSerpNewsItem(
  raw: SerpNewsResultRaw,
  topicId: string | null,
): GithubHeadline | null {
  const title = (raw.title ?? "").replace(/\s+/g, " ").trim();
  const link = (raw.link ?? "").trim();
  if (!title || !link) return null;
  if (!/^https?:\/\//i.test(link)) return null;
  const snippet =
    typeof raw.snippet === "string"
      ? raw.snippet.replace(/\s+/g, " ").trim() || null
      : null;
  return {
    id: stableHeadlineId(link, title),
    title,
    link,
    source: normalizeSerpSource(raw.source),
    date: asTrimmedString(raw.date),
    snippet,
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
