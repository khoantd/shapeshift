/** Device-local history when the user is not signed in to Meanbox (browser.storage.local). */

export const LOCAL_HISTORY_KEY = "meanbox:localHistory:v1";
export const LOCAL_SYNC_META_KEY = "meanbox:localSyncMeta:v1";

export const MAX_LOCAL_ITEMS = 200;

/** Kinds that can upload to Meanbox when signed in. */
export const SYNCABLE_KINDS = new Set(["learning_pack", "news_deep_dive"]);
const MARKDOWN_MAX = 120_000;
const TRANSCRIPT_MAX = 100_000;
const TEXT_MAX = 80_000;
const EXCERPT_MAX = 4000;
const TITLE_MAX = 500;
const QUERY_MAX = 2000;

/**
 * @typedef {"learning_pack"|"repo_summary"|"news_deep_dive"|"gadget"} LocalKind
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: LocalKind,
 *   dedupeKey: string,
 *   createdAt: number,
 *   syncedAt: number | null,
 *   apiBase: string,
 *   payload: Record<string, unknown>,
 * }} LocalItem
 */

/**
 * @param {string} raw
 * @param {number} max
 */
export function clipString(raw, max) {
  const s = String(raw ?? "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/**
 * @param {LocalKind} kind
 * @param {string} dedupeKey
 */
export function normalizeDedupeKey(kind, dedupeKey) {
  const key = String(dedupeKey ?? "")
    .trim()
    .toLowerCase();
  if (!key) return `${kind}:unknown`;
  return `${kind}:${key}`;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {LocalKind} kind
 */
export function sanitizePayload(payload, kind) {
  const p = { ...(payload || {}) };
  if (kind === "learning_pack") {
    p.videoId = clipString(p.videoId, 20);
    p.title = clipString(p.title, TITLE_MAX);
    p.channelTitle = clipString(p.channelTitle, 200);
    p.markdown = clipString(p.markdown, MARKDOWN_MAX);
    p.transcript = clipString(p.transcript, TRANSCRIPT_MAX);
    p.contentType = clipString(p.contentType, 32) || "lecture";
  } else if (kind === "repo_summary") {
    p.fullName = clipString(p.fullName, 200);
    p.text = clipString(p.text, TEXT_MAX);
    p.description = clipString(p.description, 500);
  } else if (kind === "news_deep_dive") {
    p.canonicalUrl = clipString(p.canonicalUrl, 2000);
    p.title = clipString(p.title, TITLE_MAX);
    p.excerpt = clipString(p.excerpt, EXCERPT_MAX);
    p.text = clipString(p.text, TEXT_MAX);
    p.storyId = clipString(p.storyId, 128);
    if (Array.isArray(p.sources)) {
      p.sources = p.sources.slice(0, 12).map((s) => ({
        title: clipString(s?.title, 300),
        url: clipString(s?.url, 2000),
      }));
    }
  } else if (kind === "gadget") {
    p.intent = clipString(p.intent, 32);
    p.query = clipString(p.query, QUERY_MAX);
    if (Array.isArray(p.lines)) {
      p.lines = p.lines.slice(0, 80).map((line) => clipString(line, 2000));
    }
    if (p.rtcfc && typeof p.rtcfc === "object") {
      const r = p.rtcfc;
      p.rtcfc = {
        role: clipString(r.role, 500),
        task: clipString(r.task, 2000),
        context: clipString(r.context, 4000),
        format: clipString(r.format, 500),
        constraints: clipString(r.constraints, 2000),
      };
    }
  }
  return p;
}

/**
 * @param {LocalItem[]} items
 * @param {LocalItem} next
 * @returns {LocalItem[]}
 */
export function upsertLocalItem(items, next) {
  const list = Array.isArray(items) ? [...items] : [];
  const idx = list.findIndex(
    (it) => it.kind === next.kind && it.dedupeKey === next.dedupeKey,
  );
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...next,
      id: prev.id,
      createdAt: prev.createdAt,
      syncedAt: null,
    };
  } else {
    list.unshift(next);
  }
  list.sort((a, b) => b.createdAt - a.createdAt);
  while (list.length > MAX_LOCAL_ITEMS) {
    list.pop();
  }
  return list;
}

async function readHistoryStore() {
  if (typeof browser === "undefined" || !browser.storage?.local?.get) {
    return { items: [] };
  }
  const stored = await browser.storage.local.get(LOCAL_HISTORY_KEY);
  const raw = stored[LOCAL_HISTORY_KEY];
  if (!raw || typeof raw !== "object") return { items: [] };
  const items = Array.isArray(raw.items) ? raw.items : [];
  return { items };
}

async function writeHistoryStore(items) {
  if (typeof browser === "undefined" || !browser.storage?.local?.set) {
    return;
  }
  await browser.storage.local.set({ [LOCAL_HISTORY_KEY]: { items } });
}

/**
 * @param {{
 *   kind: LocalKind,
 *   dedupeKey: string,
 *   payload: Record<string, unknown>,
 *   apiBase: string,
 * }} input
 * @returns {Promise<LocalItem>}
 */
export async function saveLocalItem(input) {
  const kind = input.kind;
  const dedupeKey = normalizeDedupeKey(kind, input.dedupeKey);
  const apiBase = clipString(input.apiBase, 500);
  const payload = sanitizePayload(input.payload, kind);
  const now = Date.now();
  const item = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `local-${now}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    dedupeKey,
    createdAt: now,
    syncedAt: null,
    apiBase,
    payload,
  };
  const { items } = await readHistoryStore();
  const merged = upsertLocalItem(items, item);
  const saved = merged.find((it) => it.dedupeKey === dedupeKey && it.kind === kind);
  await writeHistoryStore(merged);
  return saved || item;
}

/**
 * @param {LocalKind} kind
 * @param {string} dedupeKey
 * @param {string} [apiBase]
 * @returns {Promise<LocalItem | null>}
 */
export async function getLocalItem(kind, dedupeKey, apiBase) {
  const key = normalizeDedupeKey(kind, dedupeKey);
  const { items } = await readHistoryStore();
  const base = apiBase ? clipString(apiBase, 500) : "";
  const hit = items.find((it) => {
    if (it.kind !== kind || it.dedupeKey !== key) return false;
    if (base && it.apiBase && it.apiBase !== base) return false;
    return true;
  });
  return hit || null;
}

/**
 * @param {string} [apiBase]
 * @returns {Promise<LocalItem[]>}
 */
export async function listPendingSync(apiBase) {
  const { items } = await readHistoryStore();
  const base = apiBase ? clipString(apiBase, 500) : "";
  return items.filter((it) => {
    if (it.syncedAt != null) return false;
    if (base && it.apiBase && it.apiBase !== base) return false;
    return true;
  });
}

/**
 * @param {string} id
 * @param {number} [syncedAt]
 */
export async function markSynced(id, syncedAt = Date.now()) {
  const { items } = await readHistoryStore();
  let found = false;
  const next = items.map((it) => {
    if (it.id !== id) return it;
    found = true;
    return { ...it, syncedAt };
  });
  if (found) await writeHistoryStore(next);
}

/**
 * @param {string} id
 * @param {Partial<LocalItem["payload"]>} patch
 */
export async function patchLocalPayload(id, patch) {
  const { items } = await readHistoryStore();
  let found = false;
  const next = items.map((it) => {
    if (it.id !== id) return it;
    found = true;
    const merged = sanitizePayload({ ...it.payload, ...patch }, it.kind);
    return { ...it, payload: merged, syncedAt: null };
  });
  if (found) await writeHistoryStore(next);
}

export async function clearLocalHistory() {
  await writeHistoryStore([]);
  await writeSyncMeta({ lastSyncAt: null, lastSyncMessage: "Cleared local history." });
}

/**
 * @returns {Promise<{ pending: number }>}
 */
export async function countPendingSync(apiBase) {
  const pending = await listPendingSync(apiBase);
  const syncable = pending.filter((it) => SYNCABLE_KINDS.has(it.kind));
  return { pending: syncable.length };
}

/**
 * @param {Record<string, unknown>} patch
 */
export async function writeSyncMeta(patch) {
  if (typeof browser === "undefined" || !browser.storage?.local?.get) return;
  const stored = await browser.storage.local.get(LOCAL_SYNC_META_KEY);
  const prev = stored[LOCAL_SYNC_META_KEY] || {};
  await browser.storage.local.set({
    [LOCAL_SYNC_META_KEY]: { ...prev, ...patch },
  });
}

export async function readSyncMeta() {
  if (typeof browser === "undefined" || !browser.storage?.local?.get) {
    return {};
  }
  const stored = await browser.storage.local.get(LOCAL_SYNC_META_KEY);
  return stored[LOCAL_SYNC_META_KEY] || {};
}
