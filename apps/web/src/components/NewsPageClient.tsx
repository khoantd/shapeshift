"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle, Newspaper, Pin, RefreshCw, Search } from "lucide-react";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { toAiLanguage } from "@/lib/i18n/appLocale";
import { SITE_CHROME_OFFSET_CLASS } from "@/lib/site-chrome";
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
  type NewsDeepDiveLanguage,
  type NewsFeedItem,
  type NewsReaderTab,
  type NewsSourceOption,
} from "@shapeshift/react";
import { NewsStatsPanel } from "@/components/NewsStatsPanel";
import { NewsKnowledgeGraphPanel } from "@/components/news/NewsKnowledgeGraphPanel";
import { NewsCompareLinkPanel } from "@/components/news/NewsCompareLinkPanel";
import { NewsExploreLinks } from "@/components/news/NewsExploreLinks";
import { RelatedReposFromNews } from "@/components/news/RelatedReposFromNews";
import { RelatedVideosFromNews } from "@/components/news/RelatedVideosFromNews";
import type { GraphPayload } from "@/lib/neo4j/types";
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
} from "@/lib/newsStats";
import {
  filterByReadStatus,
  parseReadFilter,
  parseSortOrder,
  sortFeed,
  type NewsReadFilter,
  type NewsSortOrder,
} from "@/lib/newsFeedView";
import {
  deepDiveSourcesIncomplete,
  resolveStoredDeepDiveLanguage,
} from "@/lib/perplexity/deepDiveParse";
import { ToggleGroup, ToggleGroupItem } from "@shapeshift/react/ui/toggle-group";

type FeedResponse = {
  success: boolean;
  items?: NewsFeedItem[];
  sources?: Array<{ id?: string; name?: string; enabled?: boolean }>;
  error?: string;
  pull?: {
    targetCount: number;
    okCount: number;
    failCount: number;
  } | null;
};

type BriefApiResponse = NewsBriefView & {
  success?: boolean;
  error?: string;
};

function briefViewFromApi(body: BriefApiResponse): NewsBriefView {
  return {
    urgency: body.urgency,
    relevance: body.relevance,
    tone: body.tone,
    line: body.line,
    source: body.source,
    ...(typeof body.worthDeepDive === "boolean" ? { worthDeepDive: body.worthDeepDive } : {}),
    ...(typeof body.worthGraph === "boolean" ? { worthGraph: body.worthGraph } : {}),
  };
}

type DeepDiveApiResponse = {
  success?: boolean;
  text?: string;
  sources?: NewsDeepDiveView["sources"];
  language?: NewsDeepDiveLanguage;
  error?: string;
  persisted?: boolean;
};

function deepDiveCacheEntryKey(storyId: string, language: NewsDeepDiveLanguage): string {
  return `${storyId}:${language}`;
}

function deepDiveFromItem(item: NewsFeedItem): NewsDeepDiveView | null {
  const dd = item.deepDive;
  if (!dd?.text?.trim()) return null;
  const sources = Array.isArray(dd.sources) ? dd.sources : [];
  const language = resolveStoredDeepDiveLanguage({
    language: dd.language,
    text: dd.text,
  });
  return {
    text: dd.text.trim(),
    sources,
    language,
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
    ...(typeof b.worthDeepDive === "boolean" ? { worthDeepDive: b.worthDeepDive } : {}),
    ...(typeof b.worthGraph === "boolean" ? { worthGraph: b.worthGraph } : {}),
  };
}

function seedDeepDiveCache(
  items: NewsFeedItem[],
  prev: Record<string, NewsDeepDiveView>,
): Record<string, NewsDeepDiveView> {
  let next = prev;
  let changed = false;
  for (const item of items) {
    const view = deepDiveFromItem(item);
    if (!view) continue;
    // Skip incomplete extracts — reader will force-refresh to recover sources.
    if (deepDiveSourcesIncomplete(view.text, view.sources)) continue;
    const lang = view.language ?? "vi";
    const key = deepDiveCacheEntryKey(item.id, lang);
    if (next[key]) continue;
    if (!changed) {
      next = { ...prev };
      changed = true;
    }
    next[key] = view;
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

type NewsView = "feed" | "stats" | "knowledge";

function parseNewsView(raw: string | null): NewsView {
  if (raw === "stats") return "stats";
  if (raw === "knowledge") return "knowledge";
  return "feed";
}

type SyncUrlParams = {
  q: string;
  critical: boolean;
  source: string;
  view?: NewsView;
  read?: NewsReadFilter;
  sort?: NewsSortOrder;
  /** Selected story id for deep links; omit to leave unchanged, null to clear. */
  story?: string | null;
};

function briefBadgeFor(brief: NewsBriefView | undefined, hasQuery: boolean): string | undefined {
  if (!brief) return undefined;
  if (hasQuery && brief.relevance >= 0.67) return "Highly relevant";
  if (brief.urgency >= 0.67) return "Urgent";
  if (brief.worthDeepDive) return "Deep dive";
  if (brief.worthGraph) return "Graph";
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
  const locale = useLocale();
  const t = useTranslations("News");
  const initialQ = searchParams.get("q") ?? "";
  const initialCritical = searchParams.get("critical") === "1";
  const initialSource = searchParams.get("source") ?? "";
  const initialView = parseNewsView(searchParams.get("view"));
  const initialRead = parseReadFilter(searchParams.get("read"));
  const initialSort = parseSortOrder(searchParams.get("sort"));
  const initialStory = (searchParams.get("story") ?? "").trim();

  const [query, setQuery] = useState(initialQ);
  const [criticalOnly, setCriticalOnly] = useState(initialCritical);
  const [sourceHint, setSourceHint] = useState(initialSource);
  const [view, setView] = useState<NewsView>(initialView);
  const [readFilter, setReadFilter] = useState<NewsReadFilter>(initialRead);
  const [sortOrder, setSortOrder] = useState<NewsSortOrder>(initialSort);
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
  const readerIdRef = useRef(readerId);
  readerIdRef.current = readerId;
  const [readerShellOpen, setReaderShellOpen] = useState(false);
  const storyHydratedRef = useRef(false);
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
  const [deepDiveLanguage, setDeepDiveLanguage] = useState<NewsDeepDiveLanguage>(() =>
    toAiLanguage(locale),
  );
  const deepDiveAbortRef = useRef<AbortController | null>(null);
  const deepDiveCacheRef = useRef(deepDiveCache);
  deepDiveCacheRef.current = deepDiveCache;
  useEffect(() => {
    setDeepDiveLanguage(toAiLanguage(locale));
  }, [locale]);
  const deepDiveLanguageRef = useRef(deepDiveLanguage);
  deepDiveLanguageRef.current = deepDiveLanguage;
  /** Story ids we already tried to recover sources for (avoid regen loops). */
  const deepDiveHealAttemptedRef = useRef(new Set<string>());

  const [readerTab, setReaderTab] = useState<NewsReaderTab>("read");
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [graphCache, setGraphCache] = useState<Record<string, GraphPayload>>({});
  const [knowledgeRefreshKey, setKnowledgeRefreshKey] = useState(0);

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
            language: toAiLanguage(locale),
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json()) as BriefApiResponse;
        if (!res.ok || body.success === false) {
          throw new Error(body.error ?? `Brief failed (${res.status})`);
        }
        const view: NewsBriefView = briefViewFromApi(body);
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
                    ...(typeof view.worthDeepDive === "boolean"
                      ? { worthDeepDive: view.worthDeepDive }
                      : {}),
                    ...(typeof view.worthGraph === "boolean"
                      ? { worthGraph: view.worthGraph }
                      : {}),
                  },
                }
              : row,
          ),
        );
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setBriefErrors((prev) => ({
          ...prev,
          [cacheKey]: e instanceof Error ? e.message : t("errorBrief"),
        }));
      } finally {
        if (!ctrl.signal.aborted) {
          setBriefLoadingId((id) => (id === storyId ? null : id));
        }
      }
    })();

    return () => ctrl.abort();
  }, [readerItem, readerBriefKey, highlightQuery, locale]);

  const load = useCallback(async (opts?: { source?: string; pull?: boolean }) => {
    const source = (opts?.source ?? sourceHint).trim();
    const pull = opts?.pull === true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (source) params.set("source", source);
      const res = pull
        ? await fetch(`/api/news/refresh?${params}`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(source ? { source } : {}),
          })
        : await fetch(`/api/news?${params}`, { headers: { Accept: "application/json" } });
      const body = (await res.json()) as FeedResponse;
      if (!res.ok || body.success !== true) {
        setError(body.error ?? `Could not ${pull ? "pull" : "load"} feed (${res.status})`);
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
      if (pull && body.pull && body.pull.failCount > 0 && body.pull.okCount === 0) {
        setError(
          `Could not pull new articles from ${body.pull.failCount} source${body.pull.failCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorFeed"));
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
      setError(e instanceof Error ? e.message : t("errorPin"));
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
      setError(e instanceof Error ? e.message : t("errorRead"));
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
    (params: SyncUrlParams) => {
      const nextView = params.view ?? view;
      const nextRead = params.read ?? readFilter;
      const nextSort = params.sort ?? sortOrder;
      const nextStory =
        params.story === undefined
          ? readerIdRef.current
          : params.story;
      const search = new URLSearchParams();
      if (params.q.trim()) search.set("q", params.q.trim());
      if (params.critical) search.set("critical", "1");
      if (params.source.trim()) search.set("source", params.source.trim());
      if (nextView === "stats") search.set("view", "stats");
      if (nextRead !== "all") search.set("read", nextRead);
      if (nextSort !== "newest") search.set("sort", nextSort);
      if (nextStory?.trim() && nextView === "feed") {
        search.set("story", nextStory.trim().slice(0, 200));
      }
      const qs = search.toString();
      startTransition(() => {
        router.replace(qs ? `/news?${qs}` : "/news", { scroll: false });
      });
    },
    [router, view, readFilter, sortOrder],
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
    return sortFeed(filterByReadStatus(filtered, readFilter), briefCache, filterQ, sortOrder);
  }, [items, filterQ, criticalOnly, sourceHint, briefCache, readFilter, sortOrder]);

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
      if (next === "stats" || next === "knowledge") {
        setReaderId(null);
        setReaderShellOpen(false);
        clearSlashSession();
      }
      syncUrl({
        q: query.startsWith("/") ? "" : query,
        critical: criticalOnly,
        source: sourceHint,
        view: next,
        story: next === "stats" || next === "knowledge" ? null : undefined,
      });
    },
    [clearSlashSession, criticalOnly, query, sourceHint, syncUrl],
  );

  // One-shot deep link: /news?story=<id> opens the matching reader item.
  useEffect(() => {
    if (storyHydratedRef.current) return;
    if (!initialStory) {
      storyHydratedRef.current = true;
      return;
    }
    if (initialView !== "feed") {
      storyHydratedRef.current = true;
      return;
    }
    const match = items.find((row) => row.id === initialStory);
    if (!match) return;
    storyHydratedRef.current = true;
    setReaderShellOpen(true);
    setReaderId(match.id);
    setReaderTab("read");
  }, [initialStory, initialView, items]);

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
                  language: toAiLanguage(locale),
                }),
              });
              const body = (await res.json()) as BriefApiResponse;
              if (!res.ok || body.success === false) return;
              const viewBrief: NewsBriefView = briefViewFromApi(body);
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
                          ...(typeof viewBrief.worthDeepDive === "boolean"
                            ? { worthDeepDive: viewBrief.worthDeepDive }
                            : {}),
                          ...(typeof viewBrief.worthGraph === "boolean"
                            ? { worthGraph: viewBrief.worthGraph }
                            : {}),
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
  }, [filterQ, items, locale, newsStats.unscoredIds, scoringUnscored]);

  const applyIntent = useCallback(
    (data: NewsData) => {
      const nextQ = data.topic;
      const nextSource = data.sourceHint ?? "";
      const nextCritical = data.criticalOnly || criticalOnly;
      setQuery(nextQ);
      setSourceHint(nextSource);
      if (data.criticalOnly) setCriticalOnly(true);
      resetPage();
      syncUrl({ q: nextQ, critical: nextCritical, source: nextSource });
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
    syncUrl({ q: next, critical: criticalOnly, source: sourceHint });
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

  const onSelectItem = useCallback(
    (item: NewsFeedItem) => {
      setReaderShellOpen(true);
      setReaderId(item.id);
      setReaderTab("read");
      const stored = deepDiveFromItem(item);
      if (stored?.language === "vi" || stored?.language === "en") {
        setDeepDiveLanguage(stored.language);
      }
      if (!item.isRead) {
        void setItemRead(item, true);
      }
      syncUrl({
        q: query.startsWith("/") ? "" : query,
        critical: criticalOnly,
        source: sourceHint,
        story: item.id,
      });
    },
    [setItemRead, syncUrl, query, criticalOnly, sourceHint],
  );

  const onSelectRankedStory = useCallback(
    (id: string) => {
      const item = items.find((row) => row.id === id);
      if (!item) return;
      setView("feed");
      syncUrl({
        q: query.startsWith("/") ? "" : query,
        critical: criticalOnly,
        source: sourceHint,
        view: "feed",
      });
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
    syncUrl({
      q: query.startsWith("/") ? "" : query,
      critical: criticalOnly,
      source: sourceHint,
      story: null,
    });
  }, [syncUrl, query, criticalOnly, sourceHint]);

  const onReaderExitComplete = useCallback(() => {
    if (readerIdRef.current == null) setReaderShellOpen(false);
  }, []);

  const generateDeepDive = useCallback(
    (opts?: { force?: boolean; language?: NewsDeepDiveLanguage }) => {
      if (!readerItem) return;
      const storyId = readerItem.id;
      const language = opts?.language ?? deepDiveLanguageRef.current;
      const cacheKey = deepDiveCacheEntryKey(storyId, language);
      const force = opts?.force === true;
      if (!force && deepDiveCacheRef.current[cacheKey]) return;

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
              language,
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
          const resolvedLang: NewsDeepDiveLanguage =
            body.language === "en" || body.language === "vi" ? body.language : language;
          const view: NewsDeepDiveView = {
            text: body.text.trim(),
            sources: Array.isArray(body.sources) ? body.sources : [],
            language: resolvedLang,
          };
          const entryKey = deepDiveCacheEntryKey(storyId, resolvedLang);
          setDeepDiveCache((prev) => ({ ...prev, [entryKey]: view }));
          setItems((prev) =>
            prev.map((row) =>
              row.id === storyId
                ? {
                    ...row,
                    deepDive: {
                      text: view.text,
                      sources: view.sources,
                      language: view.language,
                    },
                  }
                : row,
            ),
          );
        } catch (e) {
          if (ctrl.signal.aborted) return;
          setDeepDiveErrors((prev) => ({
            ...prev,
            [storyId]: e instanceof Error ? e.message : t("errorDeepDive"),
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
    const cacheKey = deepDiveCacheEntryKey(storyId, deepDiveLanguage);
    const view = deepDiveCache[cacheKey] ?? (() => {
      const fromItem = deepDiveFromItem(readerItem);
      if (!fromItem) return null;
      if ((fromItem.language ?? "vi") !== deepDiveLanguage) return null;
      return fromItem;
    })();
    if (!view || !deepDiveSourcesIncomplete(view.text, view.sources)) return;
    if (deepDiveLoadingId === storyId) return;
    const healKey = `${storyId}:${deepDiveLanguage}`;
    if (deepDiveHealAttemptedRef.current.has(healKey)) return;
    deepDiveHealAttemptedRef.current.add(healKey);
    generateDeepDive({ force: true, language: deepDiveLanguage });
  }, [readerItem, deepDiveCache, deepDiveLoadingId, deepDiveLanguage, generateDeepDive]);

  const reading = readerShellOpen && view === "feed";
  const showStats = view === "stats";
  const showKnowledge = view === "knowledge";
  const graphImmersive = reading && readerTab === "graph";

  const signInForNews = useCallback(() => {
    const returnTo = encodeURIComponent("/news?view=knowledge");
    window.location.href = `/api/youtube/oauth/start?returnTo=${returnTo}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/youtube/oauth/session");
        const body = (await res.json()) as {
          connected?: boolean;
          email?: string | null;
        };
        if (cancelled) return;
        setGoogleSignedIn(Boolean(body.connected));
        setGoogleEmail(body.email ?? null);
      } catch {
        if (!cancelled) {
          setGoogleSignedIn(false);
          setGoogleEmail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!readerItem || !googleSignedIn) return;
    if (graphCache[readerItem.id]) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/news/knowledge-graph?storyId=${encodeURIComponent(readerItem.id)}`,
        );
        const body = (await res.json()) as {
          success?: boolean;
          graph?: GraphPayload | null;
        };
        if (cancelled || !body.success || !body.graph?.nodes?.length) return;
        // Never overwrite a graph already built/renamed in this session.
        setGraphCache((prev) => {
          if (prev[readerItem.id]) return prev;
          return { ...prev, [readerItem.id]: body.graph! };
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readerItem, googleSignedIn, graphCache]);
  const readerBrief = readerBriefKey
    ? briefCache[readerBriefKey] ?? (readerItem ? briefCache[readerItem.id] ?? null : null)
    : null;
  const briefError = readerBriefKey
    ? briefErrors[readerBriefKey] ?? (readerItem ? briefErrors[readerItem.id] ?? null : null)
    : null;
  const readerDeepDive =
    readerItem != null
      ? (deepDiveCache[deepDiveCacheEntryKey(readerItem.id, deepDiveLanguage)] ??
        (() => {
          const fromItem = deepDiveFromItem(readerItem);
          if (!fromItem) return null;
          if ((fromItem.language ?? "vi") !== deepDiveLanguage) return null;
          return fromItem;
        })())
      : null;
  const deepDiveError = readerItem ? deepDiveErrors[readerItem.id] ?? null : null;
  const hasQuery = Boolean(filterQ);

  return (
    <div
      className={
        reading
          ? `relative flex h-[100dvh] w-full min-h-0 overflow-hidden ${SITE_CHROME_OFFSET_CLASS}`
          : `relative mx-auto flex w-full max-w-xl flex-col px-4 pb-16 pt-[calc(3rem+env(safe-area-inset-top,0px)+1.5rem)]`
      }
    >
      {!reading && (
        <BrandBackdrop
          src="/brand/main.jpg"
          scrub="light"
          position="center top"
          className="fixed inset-0 -z-10"
        />
      )}
      <div
        className={
          graphImmersive
            ? "hidden"
            : reading
              ? `relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-e bg-background/50 md:w-[min(100%,24rem)] md:max-w-md md:shrink-0 lg:w-[28rem] lg:max-w-lg`
              : "relative z-[1] contents"
        }
      >
        {reading && (
          <BrandBackdrop src="/brand/main.jpg" scrub="medium" position="left center" />
        )}
        <div
          className={
            reading
              ? "relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-16 pt-6"
              : "contents"
          }
        >
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                <Newspaper className="size-3.5" aria-hidden />
                {t("criticalBrief")}
              </p>
              <h1 className="text-[28px] leading-8 font-[550] tracking-tight text-balance">{t("headline")}</h1>
              {!reading && !showStats && !showKnowledge ? (
                <p className="max-w-md text-[15px] leading-[22px] text-ink-2">
                  {t("subhead")}
                </p>
              ) : null}
              {showStats ? (
                <p className="max-w-md text-[15px] leading-[22px] text-ink-2">
                  {t("statsSubhead")}
                </p>
              ) : null}
              {showKnowledge ? (
                <p className="max-w-md text-[15px] leading-[22px] text-ink-2">
                  {t("knowledgeSubhead", {
                    signedIn: googleEmail
                      ? t("signedInAs", { email: googleEmail })
                      : "",
                  })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void load({ pull: true })}
              disabled={loading}
              aria-busy={loading}
              title={t("refreshTitle")}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {t("refresh")}
            </button>
          </div>
          <div
            role="tablist"
            aria-label={t("viewsAria")}
            className="inline-flex h-9 w-fit flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "feed"}
              onClick={() => setNewsView("feed")}
              className={
                view === "feed"
                  ? "inline-flex h-8 cursor-pointer items-center rounded-md bg-background px-3 text-[13px] font-medium text-foreground shadow-xs transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  : "inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-[color,background-color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              }
            >
              {t("feed")}
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
              {t("stats")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showKnowledge}
              onClick={() => setNewsView("knowledge")}
              className={
                showKnowledge
                  ? "inline-flex h-8 cursor-pointer items-center rounded-md bg-background px-3 text-[13px] font-medium text-foreground shadow-xs transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  : "inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-[color,background-color] duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              }
            >
              {t("knowledge")}
            </button>
          </div>
        </header>

        {showKnowledge ? (
          <NewsCompareLinkPanel
            signedIn={googleSignedIn}
            onSignIn={signInForNews}
            refreshKey={knowledgeRefreshKey}
          />
        ) : showStats ? (
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
            <span className="sr-only">{t("filterAria")}</span>
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
              placeholder={t("filterPlaceholder")}
              autoComplete="off"
              className="h-11 w-full rounded-lg border bg-background pe-3 ps-10 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <span className="sr-only" aria-live="polite">
            {paletteOpen ? "Source command list open" : confirmOpen ? "News search confirmation open" : ""}
          </span>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Status
              </span>
              <ToggleGroup
                type="single"
                value={readFilter}
                onValueChange={(value) => {
                  if (value !== "all" && value !== "unread" && value !== "read") return;
                  setReadFilter(value);
                  resetPage();
                  syncUrl({
                    q: query.startsWith("/") ? "" : query,
                    critical: criticalOnly,
                    source: sourceHint,
                    read: value,
                  });
                }}
                size="sm"
                variant="outline"
                spacing={0}
                aria-label={t("readStatusAria")}
                className="h-8"
              >
                <ToggleGroupItem
                  value="all"
                  className="h-8 cursor-pointer px-2.5 text-[12px] font-medium transition-[color,background-color,border-color] duration-150"
                >
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="unread"
                  className="h-8 cursor-pointer px-2.5 text-[12px] font-medium transition-[color,background-color,border-color] duration-150"
                >
                  Unread
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="read"
                  className="h-8 cursor-pointer px-2.5 text-[12px] font-medium transition-[color,background-color,border-color] duration-150"
                >
                  Read
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Sort
              </span>
              <ToggleGroup
                type="single"
                value={sortOrder}
                onValueChange={(value) => {
                  if (value !== "newest" && value !== "oldest") return;
                  setSortOrder(value);
                  resetPage();
                  syncUrl({
                    q: query.startsWith("/") ? "" : query,
                    critical: criticalOnly,
                    source: sourceHint,
                    sort: value,
                  });
                }}
                size="sm"
                variant="outline"
                spacing={0}
                aria-label={t("sortAria")}
                className="h-8"
              >
                <ToggleGroupItem
                  value="newest"
                  className="h-8 cursor-pointer px-2.5 text-[12px] font-medium transition-[color,background-color,border-color] duration-150"
                >
                  Newest
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="oldest"
                  className="h-8 cursor-pointer px-2.5 text-[12px] font-medium transition-[color,background-color,border-color] duration-150"
                >
                  Oldest
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => {
                const next = e.currentTarget.checked;
                setCriticalOnly(next);
                resetPage();
                syncUrl({
                  q: query.startsWith("/") ? "" : query,
                  critical: next,
                  source: sourceHint,
                });
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
                  syncUrl({
                    q: query.startsWith("/") ? "" : query,
                    critical: criticalOnly,
                    source: "",
                  });
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
              {items.length === 0 ? t("emptyFeed") : t("emptyFilter")}
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
                <section aria-label={t("pinnedForLater")} className="flex flex-col gap-1">
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                    <Pin className="size-3" aria-hidden />
                    {t("pinnedForLater")}
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
      </div>

      <NewsReaderPane
        item={showStats || showKnowledge ? null : readerItem}
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
        deepDiveLanguage={deepDiveLanguage}
        onDeepDiveLanguageChange={setDeepDiveLanguage}
        onGenerateDeepDive={readerItem ? () => generateDeepDive({ language: deepDiveLanguage }) : undefined}
        onRegenerateDeepDive={
          readerItem ? () => generateDeepDive({ force: true, language: deepDiveLanguage }) : undefined
        }
        readerTab={readerTab}
        onReaderTabChange={setReaderTab}
        graphPanel={
          readerItem ? (
            <NewsKnowledgeGraphPanel
              storyId={readerItem.id}
              title={readerItem.title}
              canonicalUrl={readerItem.canonicalUrl}
              deepDiveText={readerDeepDive?.text ?? ""}
              briefLine={readerBrief?.line}
              sources={readerDeepDive?.sources ?? []}
              initialGraph={graphCache[readerItem.id] ?? null}
              signedIn={googleSignedIn}
              onSignIn={signInForNews}
              onGraphReady={(graph, meta) => {
                setGraphCache((prev) => ({ ...prev, [readerItem.id]: graph }));
                if (meta.historySaved) {
                  setGoogleSignedIn(true);
                  setKnowledgeRefreshKey((n) => n + 1);
                }
              }}
            />
          ) : null
        }
        relatedPanel={
          readerItem ? (
            <>
              <NewsExploreLinks
                title={readerItem.title}
                sourceDisplayName={readerItem.sourceDisplayName}
              />
              <RelatedVideosFromNews
                title={readerItem.title}
                sourceDisplayName={readerItem.sourceDisplayName}
              />
              <RelatedReposFromNews
                title={readerItem.title}
                sourceDisplayName={readerItem.sourceDisplayName}
              />
            </>
          ) : null
        }
        className={
          graphImmersive
            ? `fixed inset-x-0 bottom-0 z-50 flex min-h-0 flex-col bg-background/80 backdrop-blur-sm ${SITE_CHROME_OFFSET_CLASS} md:static md:z-auto md:min-w-0 md:flex-1 md:pt-0`
            : "fixed inset-0 z-50 flex min-h-0 flex-col bg-background/75 backdrop-blur-sm md:static md:z-auto md:min-w-0 md:flex-1 md:border-s"
        }
      />

      <NewsSourcePalette
        open={paletteOpen && !confirmOpen && !showStats && !showKnowledge}
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
