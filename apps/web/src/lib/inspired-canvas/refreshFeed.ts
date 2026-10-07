/** Orchestrate Inspired Canvas CXO feed pull (fetch RSS/scrape → upsert). */

export type CxoFeedFetchMode = "rss" | "scrape" | "failed";

export type RefreshableSource = {
  id: string;
  siteUrl: string;
  feedUrl: string | null;
  fetchMode: CxoFeedFetchMode;
  enabled: boolean;
};

export type FetchedFeedItem = {
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAtIso: string;
  contentHash: string;
  ingestMethod: "rss" | "scrape";
  thumbnailUrl?: string | null;
};

export type SourceRefreshResult = {
  sourceId: string;
  siteUrl: string;
  ok: boolean;
  insertedAttempted: number;
  error?: string;
  fetchMode?: CxoFeedFetchMode;
};

export type RefreshSourcesDeps = {
  fetchSource: (
    source: RefreshableSource,
  ) => Promise<
    | { ok: true; items: FetchedFeedItem[]; fetchMode?: CxoFeedFetchMode }
    | { ok: false; error: string; fetchMode?: CxoFeedFetchMode }
  >;
  upsertItems: (sourceId: string, items: FetchedFeedItem[]) => Promise<void>;
  markFetched: (
    sourceId: string,
    patch: {
      lastFetchedAt: string;
      lastError: string | null;
      fetchMode: CxoFeedFetchMode;
    },
  ) => Promise<void>;
};

/** Enabled sources that have a site URL (same filter Inspired Canvas uses). */
export function pickEnabledRefreshTargets(
  sources: readonly RefreshableSource[],
): RefreshableSource[] {
  return sources.filter((s) => s.enabled && s.siteUrl.trim().length > 0);
}

/**
 * Pull new articles for each source sequentially (IC parity).
 * Continues after failures so one dead feed does not block the rest.
 */
export async function refreshSourcesSequentially(
  sources: readonly RefreshableSource[],
  deps: RefreshSourcesDeps,
): Promise<{
  results: SourceRefreshResult[];
  okCount: number;
  failCount: number;
}> {
  const results: SourceRefreshResult[] = [];
  let okCount = 0;
  let failCount = 0;
  const nowIso = () => new Date().toISOString();

  for (const source of sources) {
    const fetched = await deps.fetchSource(source);
    if (fetched.ok === false) {
      failCount += 1;
      const fetchMode = fetched.fetchMode ?? source.fetchMode;
      try {
        await deps.markFetched(source.id, {
          lastFetchedAt: nowIso(),
          lastError: fetched.error,
          fetchMode,
        });
      } catch {
        /* best-effort meta update */
      }
      results.push({
        sourceId: source.id,
        siteUrl: source.siteUrl,
        ok: false,
        insertedAttempted: 0,
        error: fetched.error,
        fetchMode,
      });
      continue;
    }

    const items = fetched.items;
    const fetchMode = fetched.fetchMode ?? source.fetchMode;
    if (items.length > 0) {
      try {
        await deps.upsertItems(source.id, items);
        await deps.markFetched(source.id, {
          lastFetchedAt: nowIso(),
          lastError: null,
          fetchMode,
        });
        okCount += 1;
        results.push({
          sourceId: source.id,
          siteUrl: source.siteUrl,
          ok: true,
          insertedAttempted: items.length,
          fetchMode,
        });
      } catch (e) {
        failCount += 1;
        const message = e instanceof Error ? e.message : "Upsert failed";
        try {
          await deps.markFetched(source.id, {
            lastFetchedAt: nowIso(),
            lastError: message,
            fetchMode,
          });
        } catch {
          /* best-effort */
        }
        results.push({
          sourceId: source.id,
          siteUrl: source.siteUrl,
          ok: false,
          insertedAttempted: 0,
          error: message,
          fetchMode,
        });
      }
    } else {
      await deps.markFetched(source.id, {
        lastFetchedAt: nowIso(),
        lastError: "No new items",
        fetchMode,
      });
      okCount += 1;
      results.push({
        sourceId: source.id,
        siteUrl: source.siteUrl,
        ok: true,
        insertedAttempted: 0,
        fetchMode,
      });
    }
  }

  return { results, okCount, failCount };
}
