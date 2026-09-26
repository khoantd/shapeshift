import type { IntentKey, IntentResult } from "@shapeshift/core/jev/types";

export const INTENT_RING_MAX = 50;
export const INTENT_STORAGE_KEY = "shapeshift:intent-stats:v1";
/** Confidence below this counts as low-confidence for share stats. */
export const LOW_CONFIDENCE = 0.45;

export type IntentStatEvent = {
  at: number;
  topIntent: IntentKey;
  confidence: number;
  readiness: number;
  textLen: number;
};

export type IntentIntentCount = {
  intent: IntentKey;
  count: number;
};

export type IntentStats = {
  total: number;
  avgConfidence: number | null;
  noneShare: number | null;
  lowConfidenceShare: number | null;
  topIntents: IntentIntentCount[];
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseEvents(raw: string | null): IntentStatEvent[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: IntentStatEvent[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.topIntent !== "string") continue;
      if (typeof r.at !== "number" || typeof r.confidence !== "number") continue;
      out.push({
        at: r.at,
        topIntent: r.topIntent as IntentKey,
        confidence: r.confidence,
        readiness: typeof r.readiness === "number" ? r.readiness : 0,
        textLen: typeof r.textLen === "number" ? r.textLen : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function readIntentEvents(storage: StorageLike | null = defaultStorage()): IntentStatEvent[] {
  if (!storage) return [];
  try {
    return parseEvents(storage.getItem(INTENT_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Append a classify event; keeps newest INTENT_RING_MAX. Does not store input text. */
export function appendIntentEvent(
  event: IntentStatEvent,
  storage: StorageLike | null = defaultStorage(),
): IntentStatEvent[] {
  if (!storage) return [];
  const prev = readIntentEvents(storage);
  const next = [...prev, event].slice(-INTENT_RING_MAX);
  try {
    storage.setItem(INTENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — ignore
  }
  return next;
}

/** Record from a successful IntentResult (no raw text). */
export function recordIntentResult(result: IntentResult, textLen: number): void {
  if (result.error) return;
  appendIntentEvent({
    at: Date.now(),
    topIntent: result.intent.value,
    confidence: result.intent.confidence,
    readiness: result.readiness,
    textLen: Math.max(0, Math.min(2000, Math.floor(textLen))),
  });
}

export function aggregateIntentStats(events: IntentStatEvent[]): IntentStats {
  if (events.length === 0) {
    return {
      total: 0,
      avgConfidence: null,
      noneShare: null,
      lowConfidenceShare: null,
      topIntents: [],
    };
  }

  const counts = new Map<IntentKey, number>();
  let sumConf = 0;
  let none = 0;
  let low = 0;

  for (const e of events) {
    sumConf += e.confidence;
    counts.set(e.topIntent, (counts.get(e.topIntent) ?? 0) + 1);
    if (e.topIntent === "none") none += 1;
    if (e.confidence < LOW_CONFIDENCE) low += 1;
  }

  const topIntents = [...counts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent))
    .slice(0, 8);

  const n = events.length;
  return {
    total: n,
    avgConfidence: sumConf / n,
    noneShare: none / n,
    lowConfidenceShare: low / n,
    topIntents,
  };
}
