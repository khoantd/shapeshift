import "server-only";

import Perplexity, {
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
  type ResponseCreateResponse,
} from "@perplexity-ai/perplexity_ai";
import { LRU } from "@shapeshift/core";
import {
  buildDeepDivePrompt,
  deepDiveCacheKey,
  extractDeepDiveSources,
  type DeepDiveRequest,
  type DeepDiveSource,
} from "./deepDiveParse";

export type { DeepDiveRequest, DeepDiveSource } from "./deepDiveParse";
export {
  buildDeepDivePrompt,
  deepDiveCacheKey,
  detectDeepDiveLanguage,
  extractDeepDiveSources,
  parseDeepDiveRequest,
} from "./deepDiveParse";

export type DeepDiveResult = {
  text: string;
  sources: DeepDiveSource[];
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, DeepDiveResult>(50);

export function hasPerplexityApiKey(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim());
}

export const MISSING_KEY_MESSAGE =
  "PERPLEXITY_API_KEY is not set. Create a key at https://console.perplexity.ai and export it in your environment (e.g. apps/web/.env).";

export async function runNewsDeepDive(
  input: DeepDiveRequest,
  signal?: AbortSignal,
): Promise<DeepDiveResult> {
  const key = deepDiveCacheKey(input);
  const hit = cache.get(key);
  if (hit) {
    return { ...hit, cached: true };
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  const client = new Perplexity();
  const tools: Array<{ type: "web_search" } | { type: "fetch_url" }> = [{ type: "web_search" }];
  if (input.canonicalUrl) {
    tools.push({ type: "fetch_url" });
  }

  let response: ResponseCreateResponse;
  try {
    response = await client.responses.create(
      {
        preset: "low",
        input: buildDeepDivePrompt(input),
        tools,
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
    throw new DeepDiveUpstreamError("Perplexity returned an empty deep dive.", 502);
  }

  const result: DeepDiveResult = {
    text,
    sources: extractDeepDiveSources(response),
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}

export class DeepDiveConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "DeepDiveConfigError";
  }
}

export class DeepDiveUpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DeepDiveUpstreamError";
    this.status = status;
  }
}
