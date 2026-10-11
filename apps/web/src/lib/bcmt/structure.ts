import "server-only";

import Perplexity, {
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
  type ResponseCreateResponse,
} from "@perplexity-ai/perplexity_ai";
import { LRU } from "@shapeshift/core";
import type { BcmtData } from "@shapeshift/core/parse/bcmt";
import {
  DeepDiveConfigError,
  DeepDiveUpstreamError,
  hasPerplexityApiKey,
  MISSING_KEY_MESSAGE,
} from "@/lib/perplexity/deepDive";
import {
  bcmtStructureCacheKey,
  buildBcmtStructurePrompt,
  mockStructureBcmt,
  parseBcmtStructureResponse,
  type BcmtStructureRequest,
} from "./structureParse";

export type {
  BcmtStructureRequest,
} from "./structureParse";
export {
  bcmtStructureCacheKey,
  buildBcmtStructurePrompt,
  mockStructureBcmt,
  parseBcmtStructureRequest,
  parseBcmtStructureResponse,
} from "./structureParse";

export type BcmtStructureResult = {
  data: BcmtData;
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, BcmtStructureResult>(50);

export {
  DeepDiveConfigError as BcmtStructureConfigError,
  DeepDiveUpstreamError as BcmtStructureUpstreamError,
};

export async function runBcmtStructure(
  input: BcmtStructureRequest,
  signal?: AbortSignal,
  opts: { forceOffline?: boolean } = {},
): Promise<BcmtStructureResult> {
  const key = bcmtStructureCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }

  if (opts.forceOffline) {
    const data = mockStructureBcmt(input.text);
    const result: BcmtStructureResult = {
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
        input: buildBcmtStructurePrompt(input),
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
  const data = parseBcmtStructureResponse(text);
  if (!data) {
    throw new DeepDiveUpstreamError(
      "Perplexity returned no usable BCMT structure.",
      502,
    );
  }

  const result: BcmtStructureResult = {
    data,
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
