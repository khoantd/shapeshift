"use client";

import { useEffect, useRef, useState } from "react";
import { mockClassify, mockClassifyAsync } from "@shapeshift/core/jev/mock";
import { type IntentResult, intentResultSchema, noneResult } from "@shapeshift/core/jev/types";
import { LRU, normalizeKey } from "@shapeshift/core/lru";
import { notify } from "../lib/notify";

export type IntentStatus = "idle" | "thinking" | "ready";

export type IntentState = {
  result: IntentResult;
  /** The text `result` was computed for. */
  resultText: string;
  status: IntentStatus;
  /** Last real classification, for the latency HUD. */
  hud: { latency: number | null; questions: number; model: string; cached: boolean };
};

/** Host-provided classifier. Omit to use the offline mock. */
export type ClassifyFn = (text: string, signal: AbortSignal) => Promise<IntentResult>;

const clientCache = new LRU<string, IntentResult>(300);
let toasted = false;

function offlineFallback(text: string): IntentResult {
  if (!toasted) {
    toasted = true;
    notify("Jev is busy. Using offline mode for now.", { id: "offline" });
  }
  return mockClassify(text);
}

/**
 * POST `{ text }` to an intent API and parse the IntentResult.
 * On network/HTTP/schema failure, falls back to the offline mock (with a one-shot toast).
 */
export function createFetchClassify(url = "/api/intent"): ClassifyFn {
  return async (text, signal) => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      return offlineFallback(text);
    }
    if (!res.ok) return offlineFallback(text);
    const parsed = intentResultSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.error) return offlineFallback(text);
    return parsed.data;
  };
}

export type UseIntentOptions = {
  debounceMs?: number;
  /** Defaults to offline `mockClassifyAsync` when omitted. */
  classify?: ClassifyFn;
};

/**
 * Debounced, abortable, stale-safe intent classification.
 * Only the latest request id may update state.
 */
export function useIntent(text: string, { debounceMs = 120, classify }: UseIntentOptions = {}): IntentState {
  const classifyFn = classify ?? mockClassifyAsync;
  const classifyRef = useRef(classifyFn);
  classifyRef.current = classifyFn;

  const [state, setState] = useState<IntentState>({
    result: noneResult(),
    resultText: "",
    status: "idle",
    hud: { latency: null, questions: 0, model: "", cached: false },
  });
  const reqId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = ++reqId.current;
    controller.current?.abort();
    const key = normalizeKey(text);

    if (key.length < 2) {
      const raf = requestAnimationFrame(() => {
        if (id === reqId.current) setState((s) => ({ ...s, result: noneResult(), resultText: text, status: "idle" }));
      });
      return () => cancelAnimationFrame(raf);
    }

    const cached = clientCache.get(key);
    if (cached) {
      const raf = requestAnimationFrame(() => {
        if (id === reqId.current)
          setState((s) => ({
            ...s,
            result: { ...cached, cached: true },
            resultText: text,
            status: "ready",
            hud: { latency: 0, questions: cached.questionCount, model: cached.model, cached: true },
          }));
      });
      return () => cancelAnimationFrame(raf);
    }

    const timer = setTimeout(async () => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      setState((s) => ({ ...s, status: "thinking" }));
      try {
        const result = await classifyRef.current(text, ctrl.signal);
        if (id !== reqId.current) return;
        if (!result.error) clientCache.set(key, result);
        setState({
          result,
          resultText: text,
          status: "ready",
          hud: {
            latency: result.cached ? 0 : result.latencyMs,
            questions: result.questionCount,
            model: result.model,
            cached: Boolean(result.cached),
          },
        });
      } catch {
        // aborted — a newer request owns the state
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  useEffect(() => () => controller.current?.abort(), []);

  return state;
}
