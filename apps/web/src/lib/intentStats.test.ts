import { describe, expect, test } from "bun:test";
import type { IntentKey } from "@shapeshift/core/jev/types";
import {
  INTENT_RING_MAX,
  aggregateIntentStats,
  appendIntentEvent,
  readIntentEvents,
  type IntentStatEvent,
} from "./intentStats";

function event(partial: Partial<IntentStatEvent> & Pick<IntentStatEvent, "topIntent">): IntentStatEvent {
  return {
    at: Date.now(),
    confidence: 0.8,
    readiness: 0.5,
    textLen: 12,
    ...partial,
  };
}

describe("appendIntentEvent / readIntentEvents", () => {
  test("keeps a ring of INTENT_RING_MAX events (newest last)", () => {
    const store: { value: string | null } = { value: null };
    const storage = {
      getItem: () => store.value,
      setItem: (_k: string, v: string) => {
        store.value = v;
      },
    };

    for (let i = 0; i < INTENT_RING_MAX + 5; i++) {
      appendIntentEvent(
        event({ topIntent: "note", at: i, confidence: 0.5 + (i % 10) / 100 }),
        storage,
      );
    }
    const events = readIntentEvents(storage);
    expect(events).toHaveLength(INTENT_RING_MAX);
    expect(events[0]?.at).toBe(5);
    expect(events[events.length - 1]?.at).toBe(INTENT_RING_MAX + 4);
  });
});

describe("aggregateIntentStats", () => {
  test("empty", () => {
    const stats = aggregateIntentStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgConfidence).toBeNull();
    expect(stats.noneShare).toBeNull();
    expect(stats.lowConfidenceShare).toBeNull();
    expect(stats.topIntents).toEqual([]);
  });

  test("ranks intents and computes shares", () => {
    const events: IntentStatEvent[] = [
      event({ topIntent: "event", confidence: 0.9 }),
      event({ topIntent: "event", confidence: 0.8 }),
      event({ topIntent: "reminder", confidence: 0.7 }),
      event({ topIntent: "none", confidence: 0.2 }),
      event({ topIntent: "note" as IntentKey, confidence: 0.3 }),
    ];
    const stats = aggregateIntentStats(events);
    expect(stats.total).toBe(5);
    expect(stats.avgConfidence).toBeCloseTo((0.9 + 0.8 + 0.7 + 0.2 + 0.3) / 5);
    expect(stats.noneShare).toBeCloseTo(0.2);
    expect(stats.lowConfidenceShare).toBeCloseTo(0.4); // 0.2 and 0.3
    expect(stats.topIntents[0]).toEqual({ intent: "event", count: 2 });
    expect(stats.topIntents.map((t) => t.intent)).toContain("reminder");
  });
});
