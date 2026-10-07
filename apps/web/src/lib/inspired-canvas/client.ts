import { createClient } from "@supabase/supabase-js";
import { getInspiredCanvasSupabaseEnv } from "./env";
import { jwtSub } from "./jwt";
import {
  pickEnabledRefreshTargets,
  refreshSourcesSequentially,
  type CxoFeedFetchMode,
  type FetchedFeedItem,
  type RefreshableSource,
  type SourceRefreshResult,
} from "./refreshFeed";

const DEFAULT_BASE_URL = "https://inspired-canvas.vercel.app";
const REQUEST_TIMEOUT_MS = 25_000;
/** RSS/scrape pull can be slow for multi-source refresh. */
const FEED_FETCH_TIMEOUT_MS = 60_000;
const ITEMS_TABLE = "ba_cxo_feed_items";
const SOURCES_TABLE = "ba_cxo_feed_sources";

export function getInspiredCanvasBaseUrl(): string {
  const fromEnv = (process.env.INSPIRED_CANVAS_BASE_URL ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

export type CxoFeedBrief = {
  urgency: number;
  relevance: number;
  tone: "neutral" | "caution" | "opportunity";
  line: string;
  source?: "jev" | "mock";
  model?: string | null;
  query?: string | null;
  generatedAt?: string | null;
  worthDeepDive?: boolean;
  worthGraph?: boolean;
  /** Output language used when composing the brief line (`vi` | `en`). */
  language?: "vi" | "en" | null;
};

export type CxoFeedDeepDive = {
  text: string;
  sources: Array<{ title: string; url: string; id?: number }>;
  model?: string | null;
  responseId?: string | null;
  generatedAt?: string | null;
  /** Output language used when generating (`vi` | `en`). */
  language?: "vi" | "en" | null;
};

export type CxoFeedItem = {
  id: string;
  sourceId?: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string;
  isRead: boolean;
  isPinned: boolean;
  sourceDisplayName?: string;
  thumbnailUrl?: string | null;
  deepDive?: CxoFeedDeepDive | null;
  brief?: CxoFeedBrief | null;
};

/** Registered CXO feed source (Inspired Canvas `ba_cxo_feed_sources`). */
export type CxoFeedSource = {
  id: string;
  displayName: string;
  enabled: boolean;
  /** Present when listing via Supabase — needed to pull new articles. */
  siteUrl?: string;
  feedUrl?: string | null;
  fetchMode?: CxoFeedFetchMode;
};

export type { CxoFeedFetchMode, FetchedFeedItem, SourceRefreshResult };

export class InspiredCanvasClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "InspiredCanvasClientError";
  }
}

function coerceText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function parseBriefPayload(raw: unknown): CxoFeedBrief | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const urgency = typeof row.urgency === "number" ? row.urgency : Number(row.urgency);
  const relevance = typeof row.relevance === "number" ? row.relevance : Number(row.relevance);
  if (!Number.isFinite(urgency) || !Number.isFinite(relevance)) return null;
  const toneRaw = typeof row.tone === "string" ? row.tone : "";
  const tone =
    toneRaw === "caution" || toneRaw === "opportunity" || toneRaw === "neutral" ? toneRaw : null;
  const line = typeof row.line === "string" ? row.line.trim() : "";
  if (!tone || !line) return null;
  const source = row.source === "jev" || row.source === "mock" ? row.source : undefined;
  return {
    urgency: Math.max(0, Math.min(1, urgency)),
    relevance: Math.max(0, Math.min(1, relevance)),
    tone,
    line,
    source,
    model: typeof row.model === "string" ? row.model : null,
    query: typeof row.query === "string" ? row.query : null,
    generatedAt:
      typeof row.generatedAt === "string"
        ? row.generatedAt
        : typeof row.generated_at === "string"
          ? row.generated_at
          : null,
    ...(typeof row.worthDeepDive === "boolean" ? { worthDeepDive: row.worthDeepDive } : {}),
    ...(typeof row.worthGraph === "boolean" ? { worthGraph: row.worthGraph } : {}),
    ...(row.language === "vi" || row.language === "en" ? { language: row.language } : {}),
  };
}

function parseDeepDivePayload(raw: unknown): CxoFeedDeepDive | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  const sourcesRaw = Array.isArray(row.sources) ? row.sources : [];
  const sources = sourcesRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const src = s as Record<string, unknown>;
      const url = typeof src.url === "string" ? src.url.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const title =
        typeof src.title === "string" && src.title.trim() ? src.title.trim().slice(0, 300) : url;
      const id =
        typeof src.id === "number" && Number.isInteger(src.id) && src.id >= 0
          ? src.id
          : undefined;
      return id != null ? { title, url, id } : { title, url };
    })
    .filter((s): s is { title: string; url: string; id?: number } => s != null);
  const languageRaw = row.language;
  const language =
    languageRaw === "vi" || languageRaw === "en" ? languageRaw : null;
  return {
    text,
    sources,
    model: typeof row.model === "string" ? row.model : null,
    responseId:
      typeof row.responseId === "string"
        ? row.responseId
        : typeof row.response_id === "string"
          ? row.response_id
          : null,
    generatedAt:
      typeof row.generatedAt === "string"
        ? row.generatedAt
        : typeof row.generated_at === "string"
          ? row.generated_at
          : null,
    ...(language ? { language } : {}),
  };
}

function normalizeFeedItem(raw: unknown): CxoFeedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = String(item.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    sourceId: String(item.sourceId ?? item.source_id ?? "").trim() || undefined,
    title: coerceText(item.title) || coerceText(item.headline) || "Untitled",
    excerpt: coerceText(item.excerpt),
    canonicalUrl: String(
      item.canonicalUrl ?? item.canonical_url ?? item.url ?? item.link ?? "",
    ).trim(),
    publishedAt: String(item.publishedAt ?? item.published_at ?? "").trim(),
    isRead: item.isRead === true || item.is_read === true,
    isPinned: item.isPinned === true || item.is_pinned === true,
    sourceDisplayName:
      coerceText(item.sourceDisplayName) || coerceText(item.source) || undefined,
    thumbnailUrl:
      typeof item.thumbnailUrl === "string"
        ? item.thumbnailUrl
        : typeof item.thumbnail_url === "string"
          ? item.thumbnail_url
          : null,
    deepDive: parseDeepDivePayload(item.deepDive ?? item.deep_dive),
    brief: parseBriefPayload(item.brief),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return { error: text.trim().slice(0, 240) || `Inspired Canvas HTTP ${res.status}` };
}

function createIcSupabase(accessToken: string) {
  const env = getInspiredCanvasSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function normalizeFetchMode(raw: unknown): CxoFeedFetchMode {
  if (raw === "scrape" || raw === "failed" || raw === "rss") return raw;
  return "rss";
}

function normalizeFeedSource(raw: unknown): CxoFeedSource | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const displayName =
    coerceText(row.display_name) || coerceText(row.displayName) || coerceText(row.name);
  if (!displayName) return null;
  const siteUrl = coerceText(row.site_url) || coerceText(row.siteUrl) || undefined;
  const feedRaw = row.feed_url ?? row.feedUrl;
  const feedUrl =
    feedRaw == null
      ? undefined
      : typeof feedRaw === "string"
        ? feedRaw.trim() || null
        : null;
  const hasFetchMode = "fetch_mode" in row || "fetchMode" in row;
  return {
    id,
    displayName,
    enabled: row.enabled !== false,
    ...(siteUrl ? { siteUrl } : {}),
    ...(feedUrl !== undefined ? { feedUrl } : {}),
    ...(hasFetchMode ? { fetchMode: normalizeFetchMode(row.fetch_mode ?? row.fetchMode) } : {}),
  };
}

function toRefreshableSource(source: CxoFeedSource): RefreshableSource | null {
  const siteUrl = (source.siteUrl ?? "").trim();
  if (!siteUrl) return null;
  return {
    id: source.id,
    siteUrl,
    feedUrl: source.feedUrl ?? null,
    fetchMode: source.fetchMode ?? "rss",
    enabled: source.enabled,
  };
}

function normalizeFetchedItem(raw: unknown): FetchedFeedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = coerceText(row.title);
  const canonicalUrl = coerceText(row.canonicalUrl) || coerceText(row.canonical_url);
  const contentHash = coerceText(row.contentHash) || coerceText(row.content_hash);
  if (!title || !canonicalUrl || !contentHash) return null;
  const ingest =
    row.ingestMethod === "scrape" || row.ingest_method === "scrape" ? "scrape" : "rss";
  const publishedAtIso =
    coerceText(row.publishedAtIso) ||
    coerceText(row.published_at) ||
    coerceText(row.publishedAt) ||
    new Date().toISOString();
  const thumb =
    typeof row.thumbnailUrl === "string"
      ? row.thumbnailUrl
      : typeof row.thumbnail_url === "string"
        ? row.thumbnail_url
        : null;
  return {
    title,
    excerpt: coerceText(row.excerpt),
    canonicalUrl,
    publishedAtIso,
    contentHash,
    ingestMethod: ingest,
    thumbnailUrl: thumb,
  };
}

/**
 * Full registered source catalog from Inspired Canvas (`ba_cxo_feed_sources`).
 * Prefer this over deriving names from the recent-items window.
 */
export async function listCxoFeedSources(params: {
  accessToken: string;
}): Promise<CxoFeedSource[]> {
  const token = params.accessToken.trim();
  if (!token) return [];

  const supabase = createIcSupabase(token);
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(SOURCES_TABLE)
    .select("id, display_name, enabled, site_url, feed_url, fetch_mode")
    .order("display_name", { ascending: true });

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }

  return (data ?? [])
    .map((row) => normalizeFeedSource(row))
    .filter((s): s is CxoFeedSource => s !== null);
}

/** Prefer IC Supabase (includes thumbnail_url). Falls back to HTTP list API. */
async function listCxoFeedItemsViaSupabase(params: {
  accessToken: string;
  limit: number;
  sourceMap: Map<string, string>;
  sourceId?: string | null;
}): Promise<CxoFeedItem[] | null> {
  const supabase = createIcSupabase(params.accessToken);
  if (!supabase) return null;

  let query = supabase
    .from(ITEMS_TABLE)
    .select("*")
    .order("published_at", { ascending: false })
    .limit(params.limit);

  const sourceId = params.sourceId?.trim();
  if (sourceId) {
    query = query.eq("source_id", sourceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }

  return (data ?? [])
    .map((row) => {
      const item = normalizeFeedItem(row);
      if (!item) return null;
      const sid = item.sourceId ?? "";
      if (!item.sourceDisplayName && sid) {
        item.sourceDisplayName = params.sourceMap.get(sid) || undefined;
      }
      return item;
    })
    .filter((i): i is CxoFeedItem => i !== null);
}

async function listCxoFeedItemsViaHttp(params: {
  baseUrl?: string;
  accessToken: string;
  limit: number;
  sourceId?: string | null;
  sourceDisplayName?: string | null;
}): Promise<CxoFeedItem[]> {
  const base = (params.baseUrl ?? getInspiredCanvasBaseUrl()).replace(/\/+$/, "");
  const url = `${base}/api/context/cxo-feed-items?limit=${params.limit}`;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/json",
    },
  });

  const body = await parseJson(res);

  if (!res.ok || body.success !== true) {
    const message =
      (typeof body.error === "string" && body.error.trim()) ||
      `Inspired Canvas feed list HTTP ${res.status}`;
    throw new InspiredCanvasClientError(message, res.status);
  }

  const items = body.items;
  let normalized = (Array.isArray(items) ? items : [])
    .map((i) => normalizeFeedItem(i))
    .filter((i): i is CxoFeedItem => i !== null);

  const sourceId = params.sourceId?.trim();
  const sourceName = params.sourceDisplayName?.trim().toLowerCase();
  if (sourceId || sourceName) {
    normalized = normalized.filter((item) => {
      if (sourceId && item.sourceId === sourceId) return true;
      if (sourceName && (item.sourceDisplayName ?? "").toLowerCase() === sourceName) return true;
      return false;
    });
  }

  return normalized;
}

/** List CXO feed items for the JWT user (Supabase first, then IC HTTP). */
export async function listCxoFeedItems(params: {
  baseUrl?: string;
  accessToken: string;
  limit?: number;
  /** Display name or source uuid — filters items to that registered source. */
  source?: string;
}): Promise<CxoFeedItem[]> {
  const { items } = await listCxoFeed(params);
  return items;
}

/**
 * Feed items plus the full registered source catalog (Inspired Canvas parity).
 * Sources come from `ba_cxo_feed_sources` when Supabase is configured.
 * Pass `source` (display name or id) to load that source’s timeline instead of
 * the global recent window.
 */
export async function listCxoFeed(params: {
  baseUrl?: string;
  accessToken: string;
  limit?: number;
  /** Display name or source uuid — filters items to that registered source. */
  source?: string;
}): Promise<{ items: CxoFeedItem[]; sources: CxoFeedSource[] }> {
  const token = params.accessToken.trim();
  if (!token) return { items: [], sources: [] };

  const limit = Math.min(100, Math.max(1, params.limit ?? 50));

  let sources: CxoFeedSource[] = [];
  try {
    sources = await listCxoFeedSources({ accessToken: token });
  } catch (e) {
    if (!(e instanceof InspiredCanvasClientError)) throw e;
    // Continue without catalog when sources table/RLS fails.
  }

  const sourceMap = new Map(sources.map((s) => [s.id, s.displayName]));
  const sourceHint = (params.source ?? "").trim();
  let sourceId: string | null = null;
  let sourceDisplayName: string | null = null;
  if (sourceHint) {
    const needle = sourceHint.toLowerCase();
    const match =
      sources.find((s) => s.displayName.trim().toLowerCase() === needle) ??
      sources.find((s) => s.id.trim().toLowerCase() === needle);
    sourceId = match?.id ?? null;
    sourceDisplayName = match?.displayName ?? sourceHint;
    // Unknown name with no id — still pass display name for HTTP fallback filter.
    if (!sourceId && !match) {
      sourceDisplayName = sourceHint;
    }
  }

  try {
    const viaSb = await listCxoFeedItemsViaSupabase({
      accessToken: token,
      limit,
      sourceMap,
      sourceId,
    });
    if (viaSb) {
      // If we couldn't resolve a source id (catalog miss), still narrow by display name.
      if (sourceHint && !sourceId) {
        const needle = sourceHint.toLowerCase();
        return {
          items: viaSb.filter(
            (item) => (item.sourceDisplayName ?? "").toLowerCase() === needle,
          ),
          sources,
        };
      }
      return { items: viaSb, sources };
    }
  } catch (e) {
    if (!(e instanceof InspiredCanvasClientError)) throw e;
    // Fall through to HTTP when Supabase query fails (schema / RLS).
  }

  const items = await listCxoFeedItemsViaHttp({
    baseUrl: params.baseUrl,
    accessToken: token,
    limit,
    sourceId,
    sourceDisplayName,
  });
  return { items, sources };
}

/** Update pin flag on a CXO feed item (Inspired Canvas Supabase). */
export async function setCxoFeedItemPinned(params: {
  accessToken: string;
  id: string;
  pinned: boolean;
}): Promise<void> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .update({ is_pinned: params.pinned })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) {
    throw new InspiredCanvasClientError("Feed item not found or not writable", 404);
  }
}

/** Update read flag on a CXO feed item (Inspired Canvas Supabase). */
export async function setCxoFeedItemRead(params: {
  accessToken: string;
  id: string;
  isRead: boolean;
}): Promise<void> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .update({ is_read: params.isRead })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) {
    throw new InspiredCanvasClientError("Feed item not found or not writable", 404);
  }
}

/** Read a stored Deep Dive from an Inspired Canvas feed item (null if missing). */
export async function getCxoFeedItemDeepDive(params: {
  accessToken: string;
  id: string;
}): Promise<CxoFeedDeepDive | null> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .select("id, deep_dive")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (/deep_dive|PGRST204/i.test(error.message)) {
      throw new InspiredCanvasClientError(
        "Column ba_cxo_feed_items.deep_dive is missing. Run inspired-canvas migration 20260926120000_cxo_feed_deep_dive.sql in Supabase SQL Editor.",
        503,
      );
    }
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) return null;
  return parseDeepDivePayload((data as { deep_dive?: unknown }).deep_dive);
}

/** Persist a Deep Dive payload onto a CXO feed item. */
export async function setCxoFeedItemDeepDive(params: {
  accessToken: string;
  id: string;
  deepDive: CxoFeedDeepDive;
}): Promise<CxoFeedDeepDive> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const language =
    params.deepDive.language === "vi" || params.deepDive.language === "en"
      ? params.deepDive.language
      : null;
  const payload: CxoFeedDeepDive = {
    text: params.deepDive.text.trim(),
    sources: params.deepDive.sources ?? [],
    model: params.deepDive.model ?? null,
    responseId: params.deepDive.responseId ?? null,
    generatedAt: params.deepDive.generatedAt ?? new Date().toISOString(),
    ...(language ? { language } : {}),
  };

  if (!payload.text) {
    throw new InspiredCanvasClientError("Deep dive text is required", 400);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .update({ deep_dive: payload })
    .eq("id", id)
    .select("id, deep_dive")
    .maybeSingle();

  if (error) {
    if (/deep_dive|PGRST204/i.test(error.message)) {
      throw new InspiredCanvasClientError(
        "Column ba_cxo_feed_items.deep_dive is missing. Run inspired-canvas migration 20260926120000_cxo_feed_deep_dive.sql in Supabase SQL Editor.",
        503,
      );
    }
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) {
    throw new InspiredCanvasClientError("Feed item not found or not writable", 404);
  }

  return parseDeepDivePayload((data as { deep_dive?: unknown }).deep_dive) ?? payload;
}

/** Read a stored Jev Brief from an Inspired Canvas feed item (null if missing). */
export async function getCxoFeedItemBrief(params: {
  accessToken: string;
  id: string;
}): Promise<CxoFeedBrief | null> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .select("id, brief")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (/\bbrief\b|PGRST204/i.test(error.message)) {
      throw new InspiredCanvasClientError(
        "Column ba_cxo_feed_items.brief is missing. Run inspired-canvas migration 20260926130000_cxo_feed_brief.sql in Supabase SQL Editor.",
        503,
      );
    }
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) return null;
  return parseBriefPayload((data as { brief?: unknown }).brief);
}

/** Persist a Jev Brief payload onto a CXO feed item. */
export async function setCxoFeedItemBrief(params: {
  accessToken: string;
  id: string;
  brief: CxoFeedBrief;
}): Promise<CxoFeedBrief> {
  const token = params.accessToken.trim();
  const id = params.id.trim();
  if (!token || !id) {
    throw new InspiredCanvasClientError("Missing access token or item id", 400);
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const payload: CxoFeedBrief = {
    urgency: params.brief.urgency,
    relevance: params.brief.relevance,
    tone: params.brief.tone,
    line: params.brief.line.trim(),
    source: params.brief.source,
    model: params.brief.model ?? null,
    query: params.brief.query ?? "",
    generatedAt: params.brief.generatedAt ?? new Date().toISOString(),
    ...(typeof params.brief.worthDeepDive === "boolean"
      ? { worthDeepDive: params.brief.worthDeepDive }
      : {}),
    ...(typeof params.brief.worthGraph === "boolean"
      ? { worthGraph: params.brief.worthGraph }
      : {}),
    ...(params.brief.language === "vi" || params.brief.language === "en"
      ? { language: params.brief.language }
      : {}),
  };

  if (!payload.line) {
    throw new InspiredCanvasClientError("Brief line is required", 400);
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error, data } = await supabase
    .from(ITEMS_TABLE)
    .update({ brief: payload })
    .eq("id", id)
    .select("id, brief")
    .maybeSingle();

  if (error) {
    if (/\bbrief\b|PGRST204/i.test(error.message)) {
      throw new InspiredCanvasClientError(
        "Column ba_cxo_feed_items.brief is missing. Run inspired-canvas migration 20260926130000_cxo_feed_brief.sql in Supabase SQL Editor.",
        503,
      );
    }
    throw new InspiredCanvasClientError(error.message, 502);
  }
  if (!data) {
    throw new InspiredCanvasClientError("Feed item not found or not writable", 404);
  }

  return parseBriefPayload((data as { brief?: unknown }).brief) ?? payload;
}

/** Call Inspired Canvas `/api/cxo-feed-fetch` to pull articles for one source. */
export async function fetchCxoFeedSourceArticles(params: {
  baseUrl?: string;
  siteUrl: string;
  feedUrl?: string | null;
  fetchMode: CxoFeedFetchMode;
}): Promise<
  | { ok: true; items: FetchedFeedItem[]; fetchMode: CxoFeedFetchMode }
  | { ok: false; error: string; fetchMode: CxoFeedFetchMode }
> {
  const base = (params.baseUrl ?? getInspiredCanvasBaseUrl()).replace(/\/+$/, "");
  const url = `${base}/api/cxo-feed-fetch`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          siteUrl: params.siteUrl,
          feedUrl: params.feedUrl ?? null,
          fetchMode: params.fetchMode === "failed" ? "rss" : params.fetchMode,
        }),
      },
      FEED_FETCH_TIMEOUT_MS,
    );
    const body = await parseJson(res);
    if (!res.ok || body.success !== true) {
      const message =
        (typeof body.error === "string" && body.error.trim()) ||
        `Inspired Canvas feed fetch HTTP ${res.status}`;
      return {
        ok: false,
        error: message,
        fetchMode:
          body.fetchMode != null ? normalizeFetchMode(body.fetchMode) : "failed",
      };
    }
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((i) => normalizeFetchedItem(i))
      .filter((i): i is FetchedFeedItem => i !== null);
    return {
      ok: true,
      items,
      fetchMode: normalizeFetchMode(body.fetchMode),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Inspired Canvas feed fetch failed";
    return { ok: false, error: message, fetchMode: "failed" };
  }
}

/** Upsert pulled articles into `ba_cxo_feed_items` (IC parity). */
export async function upsertCxoFeedItems(params: {
  accessToken: string;
  sourceId: string;
  items: FetchedFeedItem[];
}): Promise<number> {
  const token = params.accessToken.trim();
  const sourceId = params.sourceId.trim();
  if (!token || !sourceId) {
    throw new InspiredCanvasClientError("Missing access token or source id", 400);
  }
  if (params.items.length === 0) return 0;

  const userId = jwtSub(token);
  if (!userId) {
    throw new InspiredCanvasClientError("Inspired Canvas token missing user id", 401);
  }

  const supabase = createIcSupabase(token);
  if (!supabase) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const rows = params.items.map((item) => ({
    user_id: userId,
    source_id: sourceId,
    title: item.title,
    excerpt: item.excerpt,
    canonical_url: item.canonicalUrl,
    published_at: item.publishedAtIso,
    content_hash: item.contentHash,
    ingest_method: item.ingestMethod,
    thumbnail_url: item.thumbnailUrl?.trim() || null,
  }));

  const { error } = await supabase.from(ITEMS_TABLE).upsert(rows, {
    onConflict: "source_id,content_hash",
    ignoreDuplicates: true,
  });

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }
  return rows.length;
}

/** Update source fetch metadata after a pull. */
export async function markCxoFeedSourceFetched(params: {
  accessToken: string;
  sourceId: string;
  lastFetchedAt: string;
  lastError: string | null;
  fetchMode: CxoFeedFetchMode;
}): Promise<void> {
  const token = params.accessToken.trim();
  const sourceId = params.sourceId.trim();
  if (!token || !sourceId) {
    throw new InspiredCanvasClientError("Missing access token or source id", 400);
  }

  const supabase = createIcSupabase(token);
  if (!supabase) {
    throw new InspiredCanvasClientError("Inspired Canvas Supabase is not configured", 503);
  }

  const { error } = await supabase
    .from(SOURCES_TABLE)
    .update({
      last_fetched_at: params.lastFetchedAt,
      last_error: params.lastError,
      fetch_mode: params.fetchMode,
    })
    .eq("id", sourceId);

  if (error) {
    throw new InspiredCanvasClientError(error.message, 502);
  }
}

/**
 * Pull new articles from every enabled Inspired Canvas source, then return a summary.
 * Mirrors IC workspace "Refresh" (fetch → upsert → mark fetched).
 */
export async function pullNewCxoFeedArticles(params: {
  accessToken: string;
  baseUrl?: string;
  /** When set, only refresh sources matching this display name or id. */
  sourceHint?: string;
}): Promise<{
  results: SourceRefreshResult[];
  okCount: number;
  failCount: number;
  targetCount: number;
}> {
  const token = params.accessToken.trim();
  if (!token) {
    throw new InspiredCanvasClientError("Missing access token", 401);
  }

  const sources = await listCxoFeedSources({ accessToken: token });
  let refreshable = pickEnabledRefreshTargets(
    sources.map(toRefreshableSource).filter((s): s is RefreshableSource => s !== null),
  );

  const hint = (params.sourceHint ?? "").trim().toLowerCase();
  if (hint) {
    const matchIds = new Set(
      sources
        .filter(
          (s) =>
            s.id.toLowerCase() === hint || s.displayName.trim().toLowerCase() === hint,
        )
        .map((s) => s.id),
    );
    refreshable = refreshable.filter((s) => matchIds.has(s.id));
  }

  const summary = await refreshSourcesSequentially(refreshable, {
    fetchSource: async (source) =>
      fetchCxoFeedSourceArticles({
        baseUrl: params.baseUrl,
        siteUrl: source.siteUrl,
        feedUrl: source.feedUrl,
        fetchMode: source.fetchMode,
      }),
    upsertItems: async (sourceId, items) => {
      await upsertCxoFeedItems({ accessToken: token, sourceId, items });
    },
    markFetched: async (sourceId, patch) => {
      await markCxoFeedSourceFetched({
        accessToken: token,
        sourceId,
        lastFetchedAt: patch.lastFetchedAt,
        lastError: patch.lastError,
        fetchMode: patch.fetchMode,
      });
    },
  });

  return { ...summary, targetCount: refreshable.length };
}
