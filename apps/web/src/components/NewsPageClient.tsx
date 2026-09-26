"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Newspaper, Pin, RefreshCw, Search } from "lucide-react";
import {
  newsDataFromSlashPick,
  parseNewsSlash,
  type NewsData,
} from "@shapeshift/core/parse/news";
import {
  NewsFeedItemCard,
  NewsReaderPane,
  NewsSourcePalette,
  NewsIntentConfirm,
  type NewsBriefView,
  type NewsDeepDiveView,
  type NewsFeedItem,
  type NewsSourceOption,
} from "@shapeshift/react";
import { NewsStatsPanel } from "@/components/NewsStatsPanel";
import {
  aggregateIntentStats,
  readIntentEvents,
  type IntentStats,
} from "@/lib/intentStats";
import {
  applyNewsPinOverrides,
  readNewsPinOverrides,
  writeNewsPinOverride,
} from "@/lib/newsPins";
import { buildNewsSourceOptions } from "@/lib/newsSources";
import {
  SCORE_UNSCORED_LIMIT,
  aggregateNewsBriefStats,
  briefScore,
} from "@/lib/newsStats";
import { deepDiveSourcesIncomplete } from "@/lib/perplexity/deepDiveParse";

type FeedResponse = {
  success: boolean;
  items?: NewsFeedItem[];
  sources?: Array<{ id?: string; name?: string; enabled?: boolean }>;
  error?: string;
};

type BriefApiResponse = NewsBriefView & {
  success?: boolean;
  error?: string;
};

type DeepDiveApiResponse = {
  success?: boolean;
  text?: string;
  sources?: NewsDeepDiveView["sources"];
  error?: string;
  persisted?: boolean;
};

function deepDiveFromItem(item: NewsFeedItem): NewsDeepDiveView | null {
  const dd = item.deepDive;
  if (!dd?.text?.trim()) return null;
  const sources = Array.isArray(dd.sources) ? dd.sources : [];
  return {
    text: dd.text.trim(),
    sources,
  };
}

function briefFromItem(item: NewsFeedItem): NewsBriefView | null {
  const b = item.brief;
  if (!b?.line?.trim()) return null;
  if (b.tone !== "neutral" && b.tone !== "caution" && b.tone !== "opportunity") return null;
  return {
    urgency: b.urgency,
    relevance: b.relevance,
    tone: b.tone,
    line: b.line.trim(),
    source: b.source,
  };
}

function seedDeepDiveCache(
  items: NewsFeedItem[],
  prev: Record<string, NewsDeepDiveView>,
): Record<string, NewsDeepDiveView> {
  let next = prev;
  let changed = false;
  for (const item of items) {
    if (next[item.id]) continue;
    const view = deepDiveFromItem(item);
    if (!view) continue;
    // Skip incomplete extracts — reader will force-refresh to recover sources.
    if (deepDiveSourcesIncomplete(view.text, view.sources)) continue;
    if (!changed) {
      next = { ...prev };
      changed = true;
    }
    next[item.id] = view;
  }
  return next;
}

function seedBriefCache(
  items: NewsFeedItem[],
  prev: Record<string, NewsBriefView>,
): Record<string, NewsBriefView> {
  let next = prev;
  let changed = false;
  for (const item of items) {
    const view = briefFromItem(item);
    if (!view) continue;
    const q = (item.brief?.query ?? "").trim();
    const keyed = `${item.id}::${q}`;
    if (next[keyed] && next[item.id]) continue;
    if (!changed) {
      next = { ...prev };
      changed = true;
    }
    if (!next[keyed]) next[keyed] = view;
    if (!next[item.id]) next[item.id] = view;
  }
  return next;
}

const CRITICAL_WORDS = /\b(critical|urgent|breaking|must[- ]know|key|crisis|risk|alert)\b/i;
const PAGE_SIZE = 10;

function matchesQuery(item: NewsFeedItem, q: string, source: string): boolean {
  const hay = `${item.title} ${item.excerpt} ${item.sourceDisplayName ?? ""}`.toLowerCase();
  if (q && !hay.includes(q.toLowerCase())) return false;
  if (source) {
    const src = (item.sourceDisplayName ?? "").toLowerCase();
    if (!src.includes(source.toLowerCase())) return false;
  }
  return true;
}

function isCriticalItem(item: NewsFeedItem): boolean {
  if (item.isPinned || !item.isRead) return true;
  return CRITICAL_WORDS.test(`${item.title} ${item.excerpt}`);
}

function sortFeed(
  items: NewsFeedItem[],
  briefs: Record<string, NewsBriefView>,
  filterQ: string,
): NewsFeedItem[] {
  const hasQuery = Boolean(filterQ.trim());
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    const ba = briefs[a.id];
    const bb = briefs[b.id];
    if (ba || bb) {
      const scoreA = briefScore(ba, hasQuery);
      const scoreB = briefScore(bb, hasQuery);
      if (scoreA !== scoreB) return scoreB - scoreA;
    }
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    return tb - ta;
  });
}

type NewsView = "feed" | "stats";

function parseNewsView(raw: string | null): NewsView {
  return raw === "stats" ? "stats" : "feed";
}

function briefBadgeFor(brief: NewsBriefView | undefined, hasQuery: boolean): string | undefined {
  if (!brief) return undefined;
  if (hasQuery && brief.relevance >= 0.67) return "Highly relevant";
  if (brief.urgency >= 0.67) return "Urgent";
  if (brief.tone === "caution") return "Caution";
  return undefined;
}

function keywordsAfterSource(filterQuery: string, sourceName: string): string {
  const rest = filterQuery.trim();
  const lower = rest.toLowerCase();
  const name = sourceName.toLowerCase();
  if (lower === name) return "";
  if (lower.startsWith(`${name} `) || lower.startsWith(`${name}\t`)) {
    return rest.slice(name.length).trim();
  }
  return "";
}

type Props = {
  initialItems: NewsFeedItem[];
  /** Full Inspired Canvas source catalog display names (`ba_cxo_feed_sources`). */
  initialSourceNames?: string[];
  initialError: string | null;
};

export function NewsPageClient({
  initialItems,
  initialSourceNames = [],
  initialError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialCritical = searchParams.get("critical") === "1";
  const initialSource = searchParams.get("source") ?? "";
  const initialView = parseNewsView(searchParams.get("view"));

  const [query, setQuery] = useState(initialQ);
  const [criticalOnly, setCriticalOnly] = useState(initialCritical);
  const [sourceHint, setSourceHint] = useState(initialSource);
  const [view, setView] = useState<NewsView>(initialView);
  const [scoringUnscored, setScoringUnscored] = useState(false);
  const [intentStats, setIntentStats] = useState<IntentStats>(() =>
    aggregateIntentStats([]),
  );
  const [items, setItems] = useState(() =>
    applyNewsPinOverrides(initialItems, readNewsPinOverrides()),
  );
  const [itemsFromServer, setItemsFromServer] = useState(initialItems);
  const [catalogSourceNames, setCatalogSourceNames] = useState(initialSourceNames);
  const [catalogFromServer, setCatalogFromServer] = useState(initialSourceNames);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [readerId, setReaderId] = useState<string | null>(null);
  const [readerShellOpen, setReaderShellOpen] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [briefCache, setBriefCache] = useState<Record<string, NewsBriefView>>(() =>
    seedBriefCache(initialItems, {}),
  );
  const [briefErrors, setBriefErrors] = useState<Record<string, string>>({});
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null);
  const briefCacheRef = useRef(briefCache);
  briefCacheRef.current = briefCache;

  const [deepDiveCache, setDeepDiveCache] = useState<Record<string, NewsDeepDiveView>>(() =>
    seedDeepDiveCache(initialItems, {}),
  );
  const [deepDiveErrors, setDeepDiveErrors] = useState<Record<string, string>>({});
  const [deepDiveLoadingId, setDeepDiveLoadingId] = useState<string | null>(null);
  const deepDiveAbortRef = useRef<AbortController | null>(null);
  const deepDiveCacheRef = useRef(deepDiveCache);
  deepDiveCacheRef.current = deepDiveCache;
  /** Story ids we already tried to recover sources for (avoid regen loops). */
  const deepDiveHealAttemptedRef = useRef(new Set<string>());

  const [slashDraft, setSlashDraft] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<NewsData | null>(null);
  const [preSlashQuery, setPreSlashQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (initialItems !== itemsFromServer) {
    setItemsFromServer(initialItems);
    setItems(applyNewsPinOverrides(initialItems, readNewsPinOverrides()));
    setDeepDiveCache((prev) => seedDeepDiveCache(initialItems, prev));
    setBriefCache((prev) => seedBriefCache(initialItems, prev));
  }

  if (initialSourceNames !== catalogFromServer) {
    setCatalogFromServer(initialSourceNames);
    setCatalogSourceNames(initialSourceNames);
  }

  const readerItem = readerId ? (items.find((row) => row.id === readerId) ?? null) : null;
  const highlightQuery = query.startsWith("/") ? "" : query;
  const readerBriefKey = readerItem ? `${readerItem.id}::${highlightQuery}` : null;

  useEffect(() => {
    if (!readerItem || !readerBriefKey) return;
    if (briefCacheRef.current[readerBriefKey]) return;

    // Prefer item-embedded brief when query matches (or both empty).
    const embedded = briefFromItem(readerItem);
    const embeddedQuery = (readerItem.brief?.query ?? "").trim();
    if (embedded && embeddedQuery === highlightQuery.trim()) {
      void (async () => {
        await Promise.resolve();
        setBriefCache((prev) => ({
          ...prev,
          [readerBriefKey]: embedded,
          [readerItem.id]: embedded,
        }));
      })();
      return;
    }

    const ctrl = new AbortController();
    const cacheKey = readerBriefKey;
    const storyId = readerItem.id;
    const title = readerItem.title;
    const excerpt = readerItem.excerpt;
    const queryForBrief = highlightQuery;

    void (async () => {
      // Yield so setState is not synchronous inside the effect body (lint).
      await Promise.resolve();
      if (ctrl.signal.aborted) return;
      if (briefCacheRef.current[cacheKey]) return;

      setBriefLoadingId(storyId);
      setBriefErrors((prev) => {
        if (!(cacheKey in prev) && !(storyId in prev)) return prev;
        const next = { ...prev };
        delete next[cacheKey];
        delete next[storyId];
        return next;
      });
      try {
        const res = await fetch("/api/news/brief", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            id: storyId,
            title,
            excerpt,
            query: queryForBrief || undefined,
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json()) as BriefApiResponse;
        if (!res.ok || body.success === false) {
          throw new Error(body.error ?? `Brief failed (${res.status})`);
        }
        const view: NewsBriefView = {
          urgency: body.urgency,
          relevance: body.relevance,
          tone: body.tone,
          line: body.line,
          source: body.source,
        };
        setBriefCache((prev) => ({
          ...prev,
          [cacheKey]: view,
          [storyId]: view,
        }));
        setItems((prev) =>
          prev.map((row) =>
            row.id === storyId
              ? {
                  ...row,
                  brief: {
                    urgency: view.urgency,
                    relevance: view.relevance,
                    tone: view.tone,
                    line: view.line,
                    source: view.source,
                    query: queryForBrief,
                  },
                }
              : row,
          ),
        );
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setBriefErrors((prev) => ({
          ...prev,
          [cacheKey]: e instanceof Error ? e.message : "Could not load brief",
        }));
      } finally {
        if (!ctrl.signal.aborted) {
          setBriefLoadingId((id) => (id === storyId ? null : id));
        }
      }
    })();

    return () => ctrl.abort();
  }, [readerItem, readerBriefKey, highlightQuery]);

  const load = useCallback(async (opts?: { source?: string }) => {
    const source = (opts?.source ?? sourceHint).trim();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (source) params.set("source", source);
      const res = await fetch(`/api/news?${params}`, { headers: { Accept: "application/json" } });
      const body = (await res.json()) as FeedResponse;
      if (!res.ok || body.success !== true) {
        setError(body.error ?? `Could not load feed (${res.status})`);
        return;
      }
      const next = Array.isArray(body.items) ? body.items : [];
      setItems(applyNewsPinOverrides(next, readNewsPinOverrides()));
      if (Array.isArray(body.sources)) {
        setCatalogSourceNames(
          body.sources
            .map((s) => (typeof s?.name === "string" ? s.name.trim() : ""))
            .filter(Boolean),
        );
      }
      setDeepDiveCache((prev) => seedDeepDiveCache(next, prev));
      setBriefCache((prev) => seedBriefCache(next, prev));
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feed");
    } finally {
      setLoading(false);
    }
  }, [sourceHint]);

  // Refetch when the source filter changes (slash confirm / Clear). Skip first
  // mount — SSR already loaded with the URL `source` param when present.
  const sourceFetchSkipRef = useRef(true);
  useEffect(() => {
    if (sourceFetchSkipRef.current) {
      sourceFetchSkipRef.current = false;
      return;
    }
    void load({ source: sourceHint });
  }, [sourceHint, load]);

  const togglePin = useCallback(async (item: NewsFeedItem) => {
    const nextPinned = !item.isPinned;
    setPinningId(item.id);
    setError(null);

    writeNewsPinOverride(item.id, nextPinned);
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, isPinned: nextPinned } : row)),
    );

    try {
      const res = await fetch("/api/news", {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, pinned: nextPinned }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || body.success !== true) {
        setError(body.error ?? `Could not sync pin (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync pin");
    } finally {
      setPinningId(null);
    }
  }, []);

  const setItemRead = useCallback(async (item: NewsFeedItem, isRead: boolean) => {
    if (item.isRead === isRead) return;
    setReadingId(item.id);
    setError(null);
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, isRead } : row)),
    );

    try {
      const res = await fetch("/api/news", {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, read: isRead }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || body.success !== true) {
        setError(body.error ?? `Could not sync read state (${res.status})`);
        // Roll back optimistic update on failure
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, isRead: item.isRead } : row)),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync read state");
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isRead: item.isRead } : row)),
      );
    } finally {
      setReadingId(null);
    }
  }, []);

  const toggleRead = useCallback(
    (item: NewsFeedItem) => {
      void setItemRead(item, !item.isRead);
    },
    [setItemRead],
  );

  const syncUrl = useCallback(
    (nextQ: string, nextCritical: boolean, nextSource: string, nextView: NewsView = view) => {
      const params = new URLSearchParams();
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextCritical) params.set("critical", "1");
      if (nextSource.trim()) params.set("source", nextSource.trim());
      if (nextView === "stats") params.set("view", "stats");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/news?${qs}` : "/news", { scroll: false });
      });
    },
    [router, view],
  );

  const sourceOptions: NewsSourceOption[] = useMemo(
    () => buildNewsSourceOptions(catalogSourceNames, items),
    [catalogSourceNames, items],
  );

  const sourceNames = useMemo(
    () => sourceOptions.map((s) => s.name),
    [sourceOptions],
  );

  const slashParse = useMemo(
    () => parseNewsSlash(slashDraft || (query.startsWith("/") ? query : ""), sourceNames),
    [slashDraft, query, sourceNames],
  );

  const filterQ = query.startsWith("/") ? "" : query.trim();

  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!matchesQuery(item, filterQ, sourceHint.trim())) return false;
      if (criticalOnly && !isCriticalItem(item)) return false;
      return true;
    });
    return sortFeed(filtered, briefCache, filterQ);
  }, [items, filterQ, criticalOnly, sourceHint, briefCache]);

  const pinned = useMemo(() => visible.filter((item) => item.isPinned), [visible]);
  const feed = useMemo(() => visible.filter((item) => !item.isPinned), [visible]);

  const newsStats = useMemo(
    () => aggregateNewsBriefStats(visible, briefCache, filterQ),
    [visible, briefCache, filterQ],
  );

  const paged = useMemo(() => feed.slice(0, visibleCount), [feed, visibleCount]);
  const hasMore = visibleCount < feed.length;

  useEffect(() => {
    if (view !== "stats") return;
    void (async () => {
      await Promise.resolve();
      setIntentStats(aggregateIntentStats(readIntentEvents()));
    })();
  }, [view]);

  const resetPage = useCallback(() => setVisibleCount(PAGE_SIZE), []);

  const clearSlashSession = useCallback(() => {
    setPaletteOpen(false);
    setConfirmOpen(false);
    setConfirmData(null);
    setSlashDraft("");
  }, []);

  const setNewsView = useCallback(
    (next: NewsView) => {
      setView(next);
      if (next === "stats") {
        setReaderId(null);
        setReaderShellOpen(false);
        clearSlashSession();
      }
      syncUrl(query.startsWith("/") ? "" : query, criticalOnly, sourceHint, next);
    },
    [clearSlashSession, criticalOnly, query, sourceHint, syncUrl],
  );

  const scoreUnscored = useCallback(async () => {
    const ids = newsStats.unscoredIds.slice(0, SCORE_UNSCORED_LIMIT);
    if (ids.length === 0 || scoringUnscored) return;
    setScoringUnscored(true);
    const queryForBrief = filterQ;
    try {
      for (let i = 0; i < ids.length; i += 2) {
        const batch = ids.slice(i, i + 2);
        await Promise.all(
          batch.map(async (storyId) => {
            const story = items.find((row) => row.id === storyId);
            if (!story) return;
            const cacheKey = `${storyId}::${queryForBrief}`;
            try {
              const res = await fetch("/api/news/brief", {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: storyId,
                  title: story.title,
                  excerpt: story.excerpt,
                  query: queryForBrief || undefined,
                }),
              });
              const body = (await res.json()) as BriefApiResponse;
              if (!res.ok || body.success === false) return;
              const viewBrief: NewsBriefView = {
                urgency: body.urgency,
                relevance: body.relevance,
                tone: body.tone,
                line: body.line,
                source: body.source,
              };
              setBriefCache((prev) => ({
                ...prev,
                [cacheKey]: viewBrief,
                [storyId]: viewBrief,
              }));
              setItems((prev) =>
                prev.map((row) =>
                  row.id === storyId
                    ? {
                        ...row,
                        brief: {
                          urgency: viewBrief.urgency,
                          relevance: viewBrief.relevance,
                          tone: viewBrief.tone,
                          line: viewBrief.line,
                          source: viewBrief.source,
                          query: queryForBrief,
                        },
                      }
                    : row,
                ),
              );
            } catch {
              // skip failed item; continue batch
            }
          }),
        );
      }
    } finally {
      setScoringUnscored(false);
    }
  }, [filterQ, items, newsStats.unscoredIds, scoringUnscored]);

  const applyIntent = useCallback(
    (data: NewsData) => {
      const nextQ = data.topic;
      const nextSource = data.sourceHint ?? "";
      const nextCritical = data.criticalOnly || criticalOnly;
      setQuery(nextQ);
      setSourceHint(nextSource);
      if (data.criticalOnly) setCriticalOnly(true);
      resetPage();
      syncUrl(nextQ, nextCritical, nextSource);
      clearSlashSession();
    },
    [criticalOnly, syncUrl, clearSlashSession, resetPage],
  );

  const openConfirm = useCallback((data: NewsData) => {
    setConfirmData(data);
    setConfirmOpen(true);
    setPaletteOpen(false);
  }, []);

  const onSearchChange = (next: string) => {
    if (next.startsWith("/")) {
      if (!query.startsWith("/") && !slashDraft.startsWith("/")) {
        setPreSlashQuery(query);
      }
      setSlashDraft(next);
      setQuery(next);
      setPaletteOpen(true);
      return;
    }
    if (paletteOpen) {
      clearSlashSession();
    }
    setQuery(next);
    resetPage();
    syncUrl(next, criticalOnly, sourceHint);
  };

  const onPaletteFilterChange = (filterQuery: string) => {
    const next = `/${filterQuery}`;
    setSlashDraft(next);
    setQuery(next);
  };

  const onPickSource = (sourceName: string) => {
    const filterQuery = slashParse.filterQuery || slashDraft.replace(/^\//, "");
    const trailing = keywordsAfterSource(filterQuery, sourceName);
    openConfirm(newsDataFromSlashPick(sourceName, trailing));
  };

  const onClearConfirm = () => {
    setConfirmOpen(false);
    setConfirmData(null);
    setQuery(preSlashQuery);
    setSlashDraft("");
    setPaletteOpen(false);
  };

  const readerIdRef = useRef(readerId);
  readerIdRef.current = readerId;

  const onSelectItem = useCallback(
    (item: NewsFeedItem) => {
      setReaderShellOpen(true);
      setReaderId(item.id);
      if (!item.isRead) {
        void setItemRead(item, true);
      }
    },
    [setItemRead],
  );

  const onSelectRankedStory = useCallback(
    (id: string) => {
      const item = items.find((row) => row.id === id);
      if (!item) return;
      setView("feed");
      syncUrl(query.startsWith("/") ? "" : query, criticalOnly, sourceHint, "feed");
      onSelectItem(item);
    },
    [criticalOnly, items, onSelectItem, query, sourceHint, syncUrl],
  );

  const closeReader = useCallback(() => {
    deepDiveAbortRef.current?.abort();
    deepDiveAbortRef.current = null;
    setReaderId(null);
    setBriefLoadingId(null);
    setDeepDiveLoadingId(null);
  }, []);

  const onReaderExitComplete = useCallback(() => {
    if (readerIdRef.current == null) setReaderShellOpen(false);
  }, []);

  const generateDeepDive = useCallback(
    (opts?: { force?: boolean }) => {
      if (!readerItem) return;
      const storyId = readerItem.id;
      const force = opts?.force === true;
      if (!force && deepDiveCacheRef.current[storyId]) return;

      deepDiveAbortRef.current?.abort();
      const ctrl = new AbortController();
      deepDiveAbortRef.current = ctrl;

      const title = readerItem.title;
      const excerpt = readerItem.excerpt;
      const canonicalUrl = readerItem.canonicalUrl?.trim() || undefined;

      void (async () => {
        await Promise.resolve();
        if (ctrl.signal.aborted) return;

        setDeepDiveLoadingId(storyId);
        setDeepDiveErrors((prev) => {
          if (!(storyId in prev)) return prev;
          const next = { ...prev };
          delete next[storyId];
          return next;
        });
        try {
          const res = await fetch("/api/news/deep-dive", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
              id: storyId,
              title,
              excerpt,
              canonicalUrl,
              force: force || undefined,
            }),
            signal: ctrl.signal,
          });
          const body = (await res.json()) as DeepDiveApiResponse;
          if (!res.ok || body.success === false) {
            throw new Error(body.error ?? `Deep dive failed (${res.status})`);
          }
          if (!body.text?.trim()) {
            throw new Error("Deep dive returned empty content");
          }
          const view: NewsDeepDiveView = {
            text: body.text.trim(),
            sources: Array.isArray(body.sources) ? body.sources : [],
          };
          setDeepDiveCache((prev) => ({ ...prev, [storyId]: view }));
          setItems((prev) =>
            prev.map((row) =>
              row.id === storyId ? { ...row, deepDive: { text: view.text, sources: view.sources } } : row,
            ),
          );
        } catch (e) {
          if (ctrl.signal.aborted) return;
          setDeepDiveErrors((prev) => ({
            ...prev,
            [storyId]: e instanceof Error ? e.message : "Could not load deep dive",
          }));
        } finally {
          if (!ctrl.signal.aborted) {
            setDeepDiveLoadingId((id) => (id === storyId ? null : id));
          }
        }
      })();
    },
    [readerItem],
  );

  // Auto-heal deep dives that were persisted with cite marks but empty sources.
  useEffect(() => {
    if (!readerItem) return;
    const storyId = readerItem.id;
    const view = deepDiveCache[storyId] ?? deepDiveFromItem(readerItem);
    if (!view || !deepDiveSourcesIncomplete(view.text, view.sources)) return;
    if (deepDiveLoadingId === storyId) return;
    if (deepDiveHealAttemptedRef.current.has(storyId)) return;
    deepDiveHealAttemptedRef.current.add(storyId);
    generateDeepDive({ force: true });
  }, [readerItem, deepDiveCache, deepDiveLoadingId, generateDeepDive]);

  const reading = readerShellOpen && view === "feed";
  const showStats = view === "stats";
  const readerBrief = readerBriefKey
    ? briefCache[readerBriefKey] ?? (readerItem ? briefCache[readerItem.id] ?? null : null)
    : null;
  const briefError = readerBriefKey
    ? briefErrors[readerBriefKey] ?? (readerItem ? briefErrors[readerItem.id] ?? null : null)
    : null;
  const readerDeepDive =
    readerItem != null
      ? (deepDiveCache[readerItem.id] ?? deepDiveFromItem(readerItem) ?? null)
      : null;
  const deepDiveError = readerItem ? deepDiveErrors[readerItem.id] ?? null : null;
  const hasQuery = Boolean(filterQ);

  return (
    <div
      className={
        reading
          ? "flex h-[100dvh] w-full min-h-0 overflow-hidden"
          : "mx-auto flex w-full max-w-xl flex-col px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]"
      }
    >
      <div
        className={
          reading
            ? "flex h-full min-h-0 w-full min-w-0 flex-col overflow-y-auto border-e px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] md:w-[min(100%,24rem)] md:max-w-md md:shrink-0 lg:w-[28rem] lg:max-w-lg"
            : "contents"
        }
      >
        <header className="mb-8 flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Shapeshift
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                <Newspaper className="size-3.5" aria-hidden />
                Critical brief
              </p>
              <h1 className="text-[28px] leading-8 font-[550] tracking-tight text-balance">News worth knowing</h1>
              {!reading && !showStats ? (
                <p className="max-w-md text-[15px] leading-[22px] text-ink-2">
                  Curated from your Inspired Canvas feed — type{" "}
                  <kbd className="rounded border bg-muted px-1 font-mono text-[12px]">/</kbd> for a
                  source, then keywords.
                </p>
              ) : null}
              {showStats ? (
                <p className="max-w-md text-[15px] leading-[22px] text-ink-2">
                  Scores and rankings from Jev briefs, plus intent morphing from the demo.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-busy={loading}
              title="Refresh feed from Inspired Canvas"
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          </div>
          <div
            role="tablist"
            aria-label="News views"
            className="inline-flex h-9 w-fit items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showStats}
              onClick={() => setNewsView("feed")}
              className={
                !showStats
                  ? "inline-flex h-8 cursor-pointer items-center rounded-md bg-background px-3 text-[13px] font-medium text-foreground shadow-xs transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  : "inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-[color,background-color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              }
            >
              Feed
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showStats}
              onClick={() => setNewsView("stats")}
              className={
                showStats
                  ? "inline-flex h-8 cursor-pointer items-center rounded-md bg-background px-3 text-[13px] font-medium text-foreground shadow-xs transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  : "inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-[color,background-color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              }
            >
              Stats
            </button>
          </div>
        </header>

        {showStats ? (
          <NewsStatsPanel
            news={newsStats}
            hasQuery={hasQuery}
            scoring={scoringUnscored}
            onScoreUnscored={() => void scoreUnscored()}
            onSelectStory={onSelectRankedStory}
            intent={intentStats}
          />
        ) : (
          <>
        <div className="mb-6 flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Filter news</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "/" && !query.startsWith("/") && (e.currentTarget.selectionStart ?? 0) === 0) {
                  return;
                }
                if (e.key === "Escape" && (paletteOpen || confirmOpen || query.startsWith("/"))) {
                  e.preventDefault();
                  onClearConfirm();
                }
              }}
              placeholder="Filter by topic, or /source keywords…"
              autoComplete="off"
              className="h-11 w-full rounded-lg border bg-background pe-3 ps-10 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <span className="sr-only" aria-live="polite">
            {paletteOpen ? "Source command list open" : confirmOpen ? "News search confirmation open" : ""}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => {
                const next = e.currentTarget.checked;
                setCriticalOnly(next);
                resetPage();
                syncUrl(query.startsWith("/") ? "" : query, next, sourceHint);
              }}
              className="size-4 rounded border accent-[var(--brand)]"
            />
            Critical only
            <span className="font-normal text-muted-foreground">(pinned, unread, or urgent)</span>
          </label>
          {sourceHint && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>
                Source filter: <span className="font-medium text-ink-2">{sourceHint}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSourceHint("");
                  resetPage();
                  syncUrl(query.startsWith("/") ? "" : query, criticalOnly, "");
                }}
                className="cursor-pointer text-[13px] font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Clear
              </button>
            </p>
          )}
        </div>

        <div aria-live="polite" className="min-h-[12rem]">
          {loading && items.length === 0 ? (
            <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading feed…
            </p>
          ) : error && items.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong px-4 py-6">
              <p className="text-[15px] leading-[22px] text-ink-2">{error}</p>
              <p className="text-[13px] text-muted-foreground">
                Put <code className="font-mono text-[12px]">INSPIRED_CANVAS_EMAIL</code> +{" "}
                <code className="font-mono text-[12px]">INSPIRED_CANVAS_PASSWORD</code> in{" "}
                <code className="font-mono text-[12px]">apps/web/.env</code> or the monorepo root{" "}
                <code className="font-mono text-[12px]">.env</code>, then restart the dev server.
                The password must match your Inspired Canvas (IC Supabase) login.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-8 w-fit cursor-pointer items-center rounded-md border bg-background px-2.5 text-[13px] font-medium transition-[color,background-color,scale] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="text-[15px] leading-[22px] text-muted-foreground">
              {items.length === 0
                ? "No items in your Inspired Canvas feed yet."
                : "No stories match this filter."}
            </p>
          ) : (
            <div
              className={
                loading || pending
                  ? "flex flex-col gap-8 opacity-80 transition-opacity duration-150"
                  : "flex flex-col gap-8"
              }
            >
              {error ? (
                <p className="text-[13px] leading-5 text-[var(--caution)]" role="alert">
                  {error}
                </p>
              ) : null}

              {pinned.length > 0 ? (
                <section aria-label="Pinned for later" className="flex flex-col gap-1">
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                    <Pin className="size-3" aria-hidden />
                    Pinned for later
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">
                      · {pinned.length}
                    </span>
                  </p>
                  {pinned.map((item, i) => (
                    <NewsFeedItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onSelect={onSelectItem}
                      onTogglePin={togglePin}
                      pinBusy={pinningId === item.id}
                      className={readerId === item.id ? "bg-muted/60" : undefined}
                      briefBadge={briefBadgeFor(briefCache[item.id], hasQuery)}
                    />
                  ))}
                </section>
              ) : null}

              {feed.length > 0 ? (
                <section aria-label="Feed" className="flex flex-col gap-1">
                  <p className="mb-1 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                    {hasMore
                      ? `Showing ${paged.length} of ${feed.length}`
                      : `${feed.length} ${feed.length === 1 ? "story" : "stories"}`}
                  </p>
                  {paged.map((item, i) => (
                    <NewsFeedItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onSelect={onSelectItem}
                      onTogglePin={togglePin}
                      pinBusy={pinningId === item.id}
                      className={readerId === item.id ? "bg-muted/60" : undefined}
                      briefBadge={briefBadgeFor(briefCache[item.id], hasQuery)}
                    />
                  ))}
                  {hasMore ? (
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleCount((n) => Math.min(n + PAGE_SIZE, feed.length))
                        }
                        className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border bg-background px-2.5 text-[13px] font-medium transition-[color,background-color,scale] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                      >
                        Load more
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : pinned.length > 0 ? (
                <p className="text-[15px] leading-[22px] text-muted-foreground">
                  No other stories match this filter.
                </p>
              ) : null}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <NewsReaderPane
        item={showStats ? null : readerItem}
        onClose={closeReader}
        onExitComplete={onReaderExitComplete}
        highlightQuery={highlightQuery}
        onTogglePin={togglePin}
        pinBusy={readerItem ? pinningId === readerItem.id : false}
        onToggleRead={toggleRead}
        readBusy={readerItem ? readingId === readerItem.id : false}
        brief={readerBrief}
        briefLoading={readerItem ? briefLoadingId === readerItem.id : false}
        briefError={briefError}
        deepDive={readerDeepDive}
        deepDiveLoading={readerItem ? deepDiveLoadingId === readerItem.id : false}
        deepDiveError={deepDiveError}
        onGenerateDeepDive={readerItem ? () => generateDeepDive() : undefined}
        onRegenerateDeepDive={readerItem ? () => generateDeepDive({ force: true }) : undefined}
        className="fixed inset-0 z-50 flex min-h-0 flex-col bg-background md:static md:z-auto md:min-w-0 md:flex-1 md:border-s"
      />

      <NewsSourcePalette
        open={paletteOpen && !confirmOpen && !showStats}
        onOpenChange={(open) => {
          if (!open) {
            if (!confirmOpen) onClearConfirm();
            else setPaletteOpen(false);
          } else {
            setPaletteOpen(true);
          }
        }}
        sources={sourceOptions}
        filterQuery={slashParse.filterQuery}
        onFilterQueryChange={onPaletteFilterChange}
        onPick={onPickSource}
      />

      <NewsIntentConfirm
        open={confirmOpen}
        data={confirmData}
        onOpenChange={(open) => {
          if (!open) onClearConfirm();
          else setConfirmOpen(true);
        }}
        onConfirm={applyIntent}
        onClear={onClearConfirm}
      />
    </div>
  );
}
