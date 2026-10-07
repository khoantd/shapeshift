import "server-only";
import {
  APIUserAbortError,
  classifierMode,
  classifyWithJev,
  briefNewsStoryWithJev,
  classifyVideoWithJev,
  suggestNewsLinkWithJev,
  gateVideoStudyWithJev,
  warnMockOnce,
  looksLikeKey,
} from "./jev/client";
import { mockClassify } from "./jev/mock";
import { mockBriefNewsStory, newsBriefRequestSchema, type NewsBriefResult } from "./jev/newsBrief";
import {
  mockClassifyVideo,
  videoClassifyRequestSchema,
  type VideoClassifyResult,
} from "./jev/videoClassify";
import {
  mockSuggestNewsLink,
  newsLinkSuggestRequestSchema,
  type NewsLinkSuggestResult,
} from "./jev/newsLinkSuggest";
import {
  mockVideoStudyGate,
  videoStudyGateRequestSchema,
  type VideoStudyGateRequest,
  type VideoStudyGateResult,
} from "./jev/videoStudyGate";
import { type IntentResult, intentRequestSchema, noneResult } from "./jev/types";
import { LRU, normalizeKey } from "./lru";

export {
  APIUserAbortError,
  classifyWithJev,
  briefNewsStoryWithJev,
  classifyVideoWithJev,
  suggestNewsLinkWithJev,
  gateVideoStudyWithJev,
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
export {
  mockClassifyVideo,
  videoClassifyRequestSchema,
  composeVideoClassifyLine,
  type VideoClassifyResult,
  type VideoClassifyRequest,
  type VideoTopic,
  type VideoBriefTone,
} from "./jev/videoClassify";
export {
  mockSuggestNewsLink,
  newsLinkSuggestRequestSchema,
  composeNewsLinkSuggestLine,
  type NewsLinkSuggestResult,
  type NewsLinkSuggestRequest,
  type NewsLinkType,
  NEWS_LINK_TYPES,
} from "./jev/newsLinkSuggest";
export {
  mockVideoStudyGate,
  videoStudyGateRequestSchema,
  composeVideoStudyGateLine,
  type VideoStudyGateResult,
  type VideoStudyGateRequest,
  type VideoStudyDepth,
  type VideoStudyAudience,
  VIDEO_STUDY_DEPTHS,
  VIDEO_STUDY_AUDIENCES,
} from "./jev/videoStudyGate";

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

export type VideoClassifyHandlerOptions = {
  forceOffline?: boolean;
};

/** Next.js POST handler: structured Jev classification for a YouTube video. */
export function createVideoClassifyHandler(opts: VideoClassifyHandlerOptions = {}) {
  const cache = new LRU<string, VideoClassifyResult>(200);

  return async function POST(request: Request) {
    const body = videoClassifyRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json(
        { success: false, error: "Expected { title, description, query?, channelTitle? }" },
        { status: 400 },
      );
    }

    const input = body.data;
    if (!input.title && !input.description) {
      return Response.json({ success: false, error: "title or description required" }, { status: 400 });
    }

    const cacheKey = normalizeKey(
      `${input.title}\n${input.description}\n${(input.query ?? "").trim()}\n${(input.channelTitle ?? "").trim()}`,
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
      const result = mockClassifyVideo(input);
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    }

    try {
      const result = await classifyVideoWithJev(input, request.signal);
      console.info(
        `[jev-video] ${result.model} ${result.latencyMs}ms ${result.topic} flag=${result.flagged} u=${result.urgency.toFixed(2)}`,
      );
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      console.warn(`[jev-video] failed: ${err instanceof Error ? err.message : String(err)}`);
      const fallback = mockClassifyVideo(input);
      return Response.json({ success: true, ...fallback, model: "error-fallback" });
    }
  };
}

export type NewsLinkSuggestHandlerOptions = {
  forceOffline?: boolean;
};

/** Next.js POST handler: suggest a knowledge-graph edge type between two news entities. */
export function createNewsLinkSuggestHandler(opts: NewsLinkSuggestHandlerOptions = {}) {
  const cache = new LRU<string, NewsLinkSuggestResult>(200);

  return async function POST(request: Request) {
    const body = newsLinkSuggestRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json(
        {
          success: false,
          error: "Expected { sourceName, targetName, sourceContext?, targetContext? }",
        },
        { status: 400 },
      );
    }

    const input = body.data;
    if (!input.sourceName.trim() || !input.targetName.trim()) {
      return Response.json(
        { success: false, error: "sourceName and targetName required" },
        { status: 400 },
      );
    }

    const cacheKey = normalizeKey(
      `${input.sourceName}\n${input.targetName}\n${(input.sourceContext ?? "").trim()}\n${(input.targetContext ?? "").trim()}`,
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
      const result = mockSuggestNewsLink(input);
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    }

    try {
      const result = await suggestNewsLinkWithJev(input, request.signal);
      console.info(
        `[jev-news-link] ${result.model} ${result.latencyMs}ms ${result.linkType} c=${result.confidence.toFixed(2)}`,
      );
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      console.warn(`[jev-news-link] failed: ${err instanceof Error ? err.message : String(err)}`);
      const fallback = mockSuggestNewsLink(input);
      return Response.json({ success: true, ...fallback, model: "error-fallback" });
    }
  };
}

export type VideoStudyGateHandlerOptions = {
  forceOffline?: boolean;
};

/** Resolve study-gate (online Jev or offline mock) for use from other server routes. */
export async function resolveVideoStudyGate(
  input: VideoStudyGateRequest,
  opts: { forceOffline?: boolean; signal?: AbortSignal } = {},
): Promise<VideoStudyGateResult> {
  const { mode, reason } = opts.forceOffline
    ? { mode: "offline" as const, reason: "forceOffline" }
    : classifierMode();

  if (mode === "offline") {
    warnMockOnce(reason);
    return mockVideoStudyGate(input);
  }

  try {
    return await gateVideoStudyWithJev(input, opts.signal);
  } catch (err) {
    if (err instanceof APIUserAbortError || opts.signal?.aborted) {
      throw err;
    }
    console.warn(`[jev-study-gate] failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ...mockVideoStudyGate(input), model: "error-fallback" };
  }
}

/** Next.js POST handler: study depth / audience gate for a YouTube video. */
export function createVideoStudyGateHandler(opts: VideoStudyGateHandlerOptions = {}) {
  const cache = new LRU<string, VideoStudyGateResult>(200);

  return async function POST(request: Request) {
    const body = videoStudyGateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json(
        {
          success: false,
          error: "Expected { title, description?, channelTitle?, topic?, transcriptHead? }",
        },
        { status: 400 },
      );
    }

    const input = body.data;
    if (!input.title.trim()) {
      return Response.json({ success: false, error: "title required" }, { status: 400 });
    }

    const cacheKey = normalizeKey(
      `${input.title}\n${(input.description ?? "").trim()}\n${(input.channelTitle ?? "").trim()}\n${(input.topic ?? "").trim()}\n${(input.transcriptHead ?? "").trim()}`,
    );
    const hit = cache.get(cacheKey);
    if (hit) {
      return Response.json({ success: true, ...hit, latencyMs: 0, cached: true });
    }

    try {
      const result = await resolveVideoStudyGate(input, {
        forceOffline: opts.forceOffline,
        signal: request.signal,
      });
      if (result.source === "jev") {
        console.info(
          `[jev-study-gate] ${result.model} ${result.latencyMs}ms ${result.depth}/${result.audience} pack=${result.packSuitable}`,
        );
      }
      cache.set(cacheKey, result);
      return Response.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof APIUserAbortError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      throw err;
    }
  };
}
