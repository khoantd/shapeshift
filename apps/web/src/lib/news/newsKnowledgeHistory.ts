import "server-only";

import { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import type { GraphPayload } from "@/lib/neo4j/types";
import type {
  UserKnowledgeLink,
  UserKnowledgeLinkType,
} from "@/lib/news/personalKnowledgeMerge";

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function asGraphPayload(raw: unknown): GraphPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) return null;
  return {
    nodes: obj.nodes as GraphPayload["nodes"],
    links: obj.links as GraphPayload["links"],
  };
}

export type NewsKnowledgeArticleRow = {
  id: string;
  storyId: string;
  title: string;
  canonicalUrl: string;
  deepDiveText: string | null;
  graphPayload: GraphPayload;
  createdAt: number;
  updatedAt: number;
};

export type NewsKnowledgeLinkRow = {
  id: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  type: UserKnowledgeLinkType;
  note: string | null;
  createdAt: number;
};

export type HistoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export async function upsertNewsKnowledgeArticle(input: {
  googleSub: string;
  email?: string | null;
  storyId: string;
  title: string;
  canonicalUrl: string;
  deepDiveText?: string | null;
  graphPayload: GraphPayload;
}): Promise<HistoryResult<{ id: string }>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const row = await c.mutation(api.newsKnowledgeArticles.upsert, {
      googleSub: input.googleSub,
      ...(input.email ? { email: input.email } : {}),
      storyId: input.storyId,
      title: input.title,
      canonicalUrl: input.canonicalUrl,
      ...(input.deepDiveText?.trim()
        ? { deepDiveText: input.deepDiveText.trim() }
        : {}),
      graphPayload: {
        nodes: input.graphPayload.nodes,
        links: input.graphPayload.links,
      },
    });
    return { ok: true, data: { id: String(row.id) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] upsert failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not save knowledge graph. If you just updated this feature, run `npx convex dev` in apps/web.",
    };
  }
}

export async function getNewsKnowledgeArticle(
  googleSub: string,
  storyId: string,
): Promise<HistoryResult<NewsKnowledgeArticleRow | null>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const row = await c.query(api.newsKnowledgeArticles.getByStory, {
      googleSub,
      storyId,
    });
    if (!row) return { ok: true, data: null };
    const graph = asGraphPayload(row.graphPayload);
    if (!graph) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: String(row.id),
        storyId: row.storyId,
        title: row.title,
        canonicalUrl: row.canonicalUrl,
        deepDiveText: row.deepDiveText ?? null,
        graphPayload: graph,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] getByStory failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message: "Could not load saved knowledge graph.",
    };
  }
}

export async function listNewsKnowledgeArticles(
  googleSub: string,
  limit = 50,
): Promise<HistoryResult<NewsKnowledgeArticleRow[]>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const rows = await c.query(api.newsKnowledgeArticles.listByUser, {
      googleSub,
      limit,
    });
    return {
      ok: true,
      data: rows
        .map((row) => {
          const graph = asGraphPayload(row.graphPayload);
          if (!graph) return null;
          return {
            id: String(row.id),
            storyId: row.storyId,
            title: row.title,
            canonicalUrl: row.canonicalUrl,
            deepDiveText: row.deepDiveText ?? null,
            graphPayload: graph,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          } satisfies NewsKnowledgeArticleRow;
        })
        .filter((r): r is NewsKnowledgeArticleRow => r != null),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] list failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not load personal knowledge articles. If you just updated this feature, run `npx convex dev` in apps/web.",
    };
  }
}

export async function listNewsKnowledgeLinks(
  googleSub: string,
  limit = 200,
): Promise<HistoryResult<NewsKnowledgeLinkRow[]>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const rows = await c.query(api.newsKnowledgeLinks.listByUser, {
      googleSub,
      limit,
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: String(row.id),
        sourceNodeKey: row.sourceNodeKey,
        targetNodeKey: row.targetNodeKey,
        type: row.type as UserKnowledgeLinkType,
        note: row.note ?? null,
        createdAt: row.createdAt,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] list links failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not load knowledge links. If you just updated this feature, run `npx convex dev` in apps/web.",
    };
  }
}

export async function createNewsKnowledgeLink(input: {
  googleSub: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  type: UserKnowledgeLinkType;
  note?: string | null;
}): Promise<HistoryResult<{ id: string }>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const row = await c.mutation(api.newsKnowledgeLinks.create, {
      googleSub: input.googleSub,
      sourceNodeKey: input.sourceNodeKey,
      targetNodeKey: input.targetNodeKey,
      type: input.type,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    });
    return { ok: true, data: { id: String(row.id) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] create link failed: ${message}`);
    return { ok: false, reason: "upstream", message: "Could not create link." };
  }
}

export async function removeNewsKnowledgeLink(input: {
  id: string;
  googleSub: string;
}): Promise<HistoryResult<{ ok: true }>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    await c.mutation(api.newsKnowledgeLinks.remove, {
      id: input.id as Id<"newsKnowledgeLinks">,
      googleSub: input.googleSub,
    });
    return { ok: true, data: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[news-knowledge] remove link failed: ${message}`);
    return { ok: false, reason: "upstream", message: "Could not remove link." };
  }
}

export function toUserKnowledgeLinks(
  rows: readonly NewsKnowledgeLinkRow[],
): UserKnowledgeLink[] {
  return rows.map((r) => ({
    sourceNodeKey: r.sourceNodeKey,
    targetNodeKey: r.targetNodeKey,
    type: r.type,
    ...(r.note ? { note: r.note } : {}),
  }));
}
