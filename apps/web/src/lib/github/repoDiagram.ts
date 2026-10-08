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
import { extractMermaidSource } from "./mermaidSecurity";
import {
  buildRepoDiagramPrompt,
  repoDiagramCacheKey,
  type RepoDiagramRequest,
} from "./repoDiagramParse";

export type { RepoDiagramLanguage, RepoDiagramRequest } from "./repoDiagramParse";
export {
  buildRepoDiagramPrompt,
  parseRepoDiagramRequest,
  repoDiagramCacheKey,
} from "./repoDiagramParse";

export type RepoDiagramResult = {
  mermaid: string;
  notes: string | null;
  responseId: string | null;
  model: string | null;
  cached: boolean;
};

const cache = new LRU<string, RepoDiagramResult>(20);

export {
  DeepDiveConfigError as RepoDiagramConfigError,
  DeepDiveUpstreamError as RepoDiagramUpstreamError,
};

function splitNotes(raw: string, mermaid: string): string | null {
  const withoutFence = raw
    .replace(/```(?:mermaid)?\s*[\s\S]*?```/i, "")
    .trim();
  if (withoutFence && withoutFence !== mermaid.trim()) {
    return withoutFence.slice(0, 2000);
  }
  return null;
}

export async function runGithubRepoDiagram(
  input: RepoDiagramRequest,
  signal?: AbortSignal,
): Promise<RepoDiagramResult> {
  const key = repoDiagramCacheKey(input);
  if (!input.force) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }

  if (!hasPerplexityApiKey()) {
    throw new DeepDiveConfigError(MISSING_KEY_MESSAGE);
  }

  if (input.treeOutline.trim().length < 8) {
    throw new DeepDiveUpstreamError("Repository tree too small to diagram", 422);
  }

  const client = new Perplexity();
  let response: ResponseCreateResponse;
  try {
    response = await client.responses.create(
      {
        preset: "low",
        input: buildRepoDiagramPrompt(input),
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
  const mermaid = extractMermaidSource(text);
  if (!mermaid) {
    throw new DeepDiveUpstreamError(
      "Perplexity returned no usable Mermaid diagram.",
      502,
    );
  }

  const result: RepoDiagramResult = {
    mermaid,
    notes: splitNotes(text, mermaid),
    responseId: typeof response.id === "string" ? response.id : null,
    model: typeof response.model === "string" ? response.model : null,
    cached: false,
  };
  cache.set(key, { ...result, cached: false });
  return result;
}
