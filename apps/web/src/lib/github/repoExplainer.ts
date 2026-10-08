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
  buildRepoExplainerPrompt,
  parseExplainerChapters,
  repoExplainerCacheKey,
  type RepoExplainerChapter,
  type RepoExplainerRequest,
} from "./repoExplainerParse";

export type {
  RepoExplainerChapter,
  RepoExplainerLanguage,
  RepoExplainerRequest,
} from "./repoExplainerParse";
export {
  buildRepoExplainerPrompt,
  parseExplainerChapters,
  parseRepoExplainerRequest,
  repoExplainerCacheKey,
} from "./repoExplainerParse";

export type RepoExplainerResult = {
  chapters: RepoExplainerChapter[];
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, RepoExplainerResult>(20);

export {
  DeepDiveConfigError as RepoExplainerConfigError,
  DeepDiveUpstreamError as RepoExplainerUpstreamError,
};

export async function runGithubRepoExplainer(
  input: RepoExplainerRequest,
  signal?: AbortSignal,
): Promise<RepoExplainerResult> {
  const key = repoExplainerCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  if (
    input.readme.trim().length < 40 &&
    input.treeOutline.trim().length < 8
  ) {
    throw new DeepDiveUpstreamError(
      "Not enough README or tree content to explain",
      422,
    );
  }

  const client = new Perplexity();
  let response: ResponseCreateResponse;
  try {
    response = await client.responses.create(
      {
        preset: "low",
        input: buildRepoExplainerPrompt(input),
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
  const chapters = parseExplainerChapters(text);
  if (!chapters) {
    throw new DeepDiveUpstreamError(
      "Perplexity returned no usable explainer chapters.",
      502,
    );
  }

  const result: RepoExplainerResult = {
    chapters,
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
