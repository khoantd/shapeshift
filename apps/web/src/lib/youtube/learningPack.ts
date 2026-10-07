import "server-only";

import Perplexity, {
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
  type ResponseCreateResponse,
} from "@perplexity-ai/perplexity_ai";
import { LRU } from "@shapeshift/core";
import {
  DeepDiveConfigError,
  DeepDiveUpstreamError,
  hasPerplexityApiKey,
  MISSING_KEY_MESSAGE,
} from "@/lib/perplexity/deepDive";
import {
  buildLearningPackPrompt,
  learningPackCacheKey,
  type LearningPackRequest,
} from "./learningPackParse";

export type {
  LearningPackContentType,
  LearningPackLanguage,
  LearningPackDepth,
  LearningPackAudience,
  LearningPackRequest,
} from "./learningPackParse";
export {
  buildLearningPackPrompt,
  learningPackCacheKey,
  parseLearningPackContentType,
  parseLearningPackLanguage,
  parseLearningPackDepth,
  parseLearningPackAudience,
  parseLearningPackRequest,
  resolvePackContentType,
  LEARNING_PACK_CONTENT_TYPES,
  LEARNING_PACK_DEPTHS,
  LEARNING_PACK_AUDIENCES,
} from "./learningPackParse";

export type LearningPackResult = {
  text: string;
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, LearningPackResult>(30);

export { DeepDiveConfigError as LearningPackConfigError, DeepDiveUpstreamError as LearningPackUpstreamError };

export async function runYouTubeLearningPack(
  input: LearningPackRequest,
  signal?: AbortSignal,
): Promise<LearningPackResult> {
  const key = learningPackCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) {
      return { ...hit, cached: true };
    }
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  const client = new Perplexity();

  let response: ResponseCreateResponse;
  try {
    // No web tools — transcript is the sole source of truth (skill fidelity rule).
    response = await client.responses.create(
      {
        preset: "low",
        input: buildLearningPackPrompt(input),
        tools: [],
      },
      signal ? { signal } : undefined,
    );
  } catch (err) {
    if (err instanceof APIUserAbortError || signal?.aborted) {
      throw err;
    }
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
  if (!text) {
    throw new DeepDiveUpstreamError("Perplexity returned an empty learning pack.", 502);
  }

  const result: LearningPackResult = {
    text,
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
