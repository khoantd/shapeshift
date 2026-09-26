import "server-only";
import {
  APIUserAbortError,
  classifierMode,
  classifyWithJev,
  briefNewsStoryWithJev,
  warnMockOnce,
  looksLikeKey,
} from "./jev/client";
import { mockClassify } from "./jev/mock";
import { mockBriefNewsStory, newsBriefRequestSchema, type NewsBriefResult } from "./jev/newsBrief";
import { type IntentResult, intentRequestSchema, noneResult } from "./jev/types";
import { LRU, normalizeKey } from "./lru";

export {
  APIUserAbortError,
  classifyWithJev,
  briefNewsStoryWithJev,
  classifierMode,
  warnMockOnce,
  looksLikeKey,
};
export {
  mockBriefNewsStory,
  newsBriefRequestSchema,
  composeNewsBriefLine,
  type NewsBriefResult,
  type NewsBriefRequest,
  type NewsBriefTone,
} from "./jev/newsBrief";

export type IntentHandlerOptions = {
  /** Force the offline keyword classifier (host reads NEXT_PUBLIC_USE_MOCK). */
  forceOffline?: boolean;
};

/**
 * Next.js App Router–compatible POST handler for intent classification.
 * Hosts typically: `export const POST = createIntentHandler()`.
 */
export function createIntentHandler(opts: IntentHandlerOptions = {}) {
  const cache = new LRU<string, IntentResult>(500);

  return async function POST(request: Request) {
    const body = intentRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "Expected { text: string }" }, { status: 400 });

    const text = body.data.text;
    const key = normalizeKey(text);
    if (key.length < 2) return Response.json(noneResult({ model: "none" }));

    const hit = cache.get(key);
    if (hit) return Response.json({ ...hit, latencyMs: 0, cached: true } satisfies IntentResult);

    const { mode, reason } = opts.forceOffline
      ? { mode: "offline" as const, reason: "forceOffline" }
      : classifierMode();

    if (mode === "offline") {
      warnMockOnce(reason);
      return Response.json(mockClassify(text));
    }

    try {
      const result = await classifyWithJev(text, request.signal);
      console.info(
        `[jev] ${result.model} ${result.latencyMs}ms ${result.questionCount}q "${key.slice(0, 40)}" → ${result.intent.value}`,
      );
      cache.set(key, result);
      return Response.json(result);
    } catch (err) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      const status = typeof err === "object" && err && "status" in err ? (err as { status: number }).status : undefined;
      console.warn(`[jev] call failed${status ? ` (${status})` : ""}: ${err instanceof Error ? err.message : String(err)}`);
      return Response.json(noneResult({ error: true, model: "error" }));
    }
  };
}

export type NewsBriefHandlerOptions = {
  forceOffline?: boolean;
};

/** Next.js POST handler: structured Jev brief for a news story. */
export function createNewsBriefHandler(opts: NewsBriefHandlerOptions = {}) {
  const cache = new LRU<string, NewsBriefResult>(200);

  return async function POST(request: Request) {
    const body = newsBriefRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json({ success: false, error: "Expected { title, excerpt, query? }" }, { status: 400 });
    }

    const input = body.data;
    if (!input.title && !input.excerpt) {
      return Response.json({ success: false, error: "title or excerpt required" }, { status: 400 });
    }

    const cacheKey = normalizeKey(
      `${input.title}\n${input.excerpt}\n${(input.query ?? "").trim()}`,
    );
    const hit = cache.get(cacheKey);
    if (hit) {
      return Response.json({ success: true, ...hit, latencyMs: 0, cached: true });
    }

    const { mode, reason } = opts.forceOffline
      ? { mode: "offline" as const, reason: "forceOffline" }
      : classifierMode();

    if (mode === "offline") {
      warnMockOnce(reason);
      const result = mockBriefNewsStory(input);
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    }

    try {
      const result = await briefNewsStoryWithJev(input, request.signal);
      console.info(
        `[jev-brief] ${result.model} ${result.latencyMs}ms u=${result.urgency.toFixed(2)} r=${result.relevance.toFixed(2)} ${result.tone}`,
      );
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      console.warn(`[jev-brief] failed: ${err instanceof Error ? err.message : String(err)}`);
      const fallback = mockBriefNewsStory(input);
      return Response.json({ success: true, ...fallback, model: "error-fallback" });
    }
  };
}
