import "server-only";

import Perplexity, {
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
  type ResponseCreateResponse,
} from "@perplexity-ai/perplexity_ai";
import { LRU } from "@shapeshift/core";
import type { RtcfcData } from "@shapeshift/core/parse/rtcfc";
import {
  DeepDiveConfigError,
  DeepDiveUpstreamError,
  hasPerplexityApiKey,
  MISSING_KEY_MESSAGE,
} from "@/lib/perplexity/deepDive";
import {
  buildRtcfcStructurePrompt,
  mockStructureRtcfc,
  parseRtcfcStructureResponse,
  rtcfcStructureCacheKey,
  type RtcfcStructureRequest,
} from "./structureParse";

export type {
  RtcfcStructureRequest,
} from "./structureParse";
export {
  buildRtcfcStructurePrompt,
  mockStructureRtcfc,
  parseRtcfcStructureRequest,
  parseRtcfcStructureResponse,
  rtcfcStructureCacheKey,
} from "./structureParse";

export type RtcfcStructureResult = {
  data: RtcfcData;
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, RtcfcStructureResult>(50);

export {
  DeepDiveConfigError as RtcfcStructureConfigError,
  DeepDiveUpstreamError as RtcfcStructureUpstreamError,
};

export async function runRtcfcStructure(
  input: RtcfcStructureRequest,
  signal?: AbortSignal,
  opts: { forceOffline?: boolean } = {},
): Promise<RtcfcStructureResult> {
  const key = rtcfcStructureCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }

  if (opts.forceOffline) {
    const data = mockStructureRtcfc(input.text);
    const result: RtcfcStructureResult = {
      data,
      responseId: null,
      model: "mock",
      cached: false,
    };
    cache.set(key, { ...result, cached: false });
    return result;
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  const client = new Perplexity();
  let response: ResponseCreateResponse;
  try {
    response = await client.responses.create(
      {
        preset: "low",
        input: buildRtcfcStructurePrompt(input),
        tools: [],
      },
      signal ? { signal } : undefined,
    );
  } catch (err) {
    if (err instanceof APIUserAbortError || signal?.aborted) throw err;
    if (err instanceof AuthenticationError) {
      throw new DeepDiveUpstreamError(
        "Perplexity authentication failed. Check PERPLEXITY_API_KEY in the API Console.",
        401,
      );
    }
    if (err instanceof RateLimitError) {
      const retryAfter = err.headers?.get?.("retry-after") ?? null;
      throw new DeepDiveUpstreamError(
        retryAfter
          ? `Perplexity rate limited. Retry after ${retryAfter}s.`
          : "Perplexity rate limited. Try again shortly.",
        429,
      );
    }
    throw err;
  }

  const text = (response.output_text ?? "").trim();
  const data = parseRtcfcStructureResponse(text);
  if (!data) {
    throw new DeepDiveUpstreamError(
      "Perplexity returned no usable RTCFC structure.",
      502,
    );
  }

  const result: RtcfcStructureResult = {
    data,
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
