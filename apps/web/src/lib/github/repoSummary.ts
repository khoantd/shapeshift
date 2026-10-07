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
  buildRepoSummaryPrompt,
  repoSummaryCacheKey,
  type RepoSummaryRequest,
} from "./repoSummaryParse";

export type { RepoSummaryLanguage, RepoSummaryRequest } from "./repoSummaryParse";
export {
  buildRepoSummaryPrompt,
  parseRepoSummaryRequest,
  repoSummaryCacheKey,
} from "./repoSummaryParse";

export type RepoSummaryResult = {
  text: string;
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, RepoSummaryResult>(30);

export {
  DeepDiveConfigError as RepoSummaryConfigError,
  DeepDiveUpstreamError as RepoSummaryUpstreamError,
};

export async function runGithubRepoSummary(
  input: RepoSummaryRequest,
  signal?: AbortSignal,
): Promise<RepoSummaryResult> {
  const key = repoSummaryCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) {
      return { ...hit, cached: true };
    }
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  if (input.readme.trim().length < 40) {
    throw new DeepDiveUpstreamError(
      "README too short to summarize",
      422,
    );
  }

  const client = new Perplexity();

  let response: ResponseCreateResponse;
  try {
    response = await client.responses.create(
      {
        preset: "low",
        input: buildRepoSummaryPrompt(input),
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
    throw new DeepDiveUpstreamError("Perplexity returned an empty summary.", 502);
  }

  const result: RepoSummaryResult = {
    text,
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
