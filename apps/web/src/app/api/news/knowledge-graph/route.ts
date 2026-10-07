import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  applyGoogleOAuthCookies,
  ensureGoogleOAuthIdentity,
} from "@/lib/auth/googleIdentity";
import { isNeo4jConfigured } from "@/lib/neo4j/config";
import { Neo4jGraphError } from "@/lib/neo4j/cypher-guard";
import type { GraphPayload } from "@/lib/neo4j/types";
import { upsertNewsKnowledgeGraph } from "@/lib/neo4j/news";
import { newsToKnowledgeGraph } from "@/lib/news/newsKnowledgeGraph";
import {
  getNewsKnowledgeArticle,
  upsertNewsKnowledgeArticle,
} from "@/lib/news/newsKnowledgeHistory";
import {
  addGraphLink,
  addGraphNode,
  deleteGraphNode,
} from "@/lib/neo4j/mutateGraph";
import { renameGraphNode } from "@/lib/neo4j/renameGraphNode";

export const runtime = "nodejs";

const sourceSchema = z.object({
  title: z.string().trim().max(500),
  url: z.string().trim().url().max(2000),
});

const graphPayloadSchema = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())).max(500),
  links: z.array(z.record(z.string(), z.unknown())).max(2000),
});

const postSchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  canonicalUrl: z.string().trim().max(2000).optional().default(""),
  deepDiveText: z.string().max(200_000).optional().default(""),
  briefLine: z.string().trim().max(2000).optional(),
  sources: z.array(sourceSchema).max(40).optional().default([]),
  /** Persist to Convex when signed in (default true). */
  save: z.boolean().optional().default(true),
});

const patchBase = {
  storyId: z.string().trim().min(1).max(200),
  /** Current in-memory graph (required if no saved article yet). */
  graph: graphPayloadSchema.optional(),
  title: z.string().trim().min(1).max(500).optional(),
  canonicalUrl: z.string().trim().max(2000).optional().default(""),
  deepDiveText: z.string().max(200_000).optional(),
  save: z.boolean().optional().default(true),
};

const patchSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const obj = raw as Record<string, unknown>;
    if (obj.op == null) return { ...obj, op: "rename" };
    return obj;
  },
  z.discriminatedUnion("op", [
    z.object({
      ...patchBase,
      op: z.literal("rename"),
      nodeId: z.string().trim().min(1).max(300),
      label: z.string().trim().min(1).max(120),
    }),
    z.object({
      ...patchBase,
      op: z.literal("addNode"),
      kind: z.enum(["NewsConcept", "NewsEntity", "NewsSource"]),
      label: z.string().trim().min(1).max(120),
    }),
    z.object({
      ...patchBase,
      op: z.literal("addLink"),
      sourceId: z.string().trim().min(1).max(300),
      targetId: z.string().trim().min(1).max(300),
      type: z
        .enum(["RELATED_TO", "SUPPORTS", "CONTRASTS_WITH"])
        .optional()
        .default("RELATED_TO"),
    }),
    z.object({
      ...patchBase,
      op: z.literal("deleteNode"),
      nodeId: z.string().trim().min(1).max(300),
    }),
  ]),
);

function asGraphPayload(raw: unknown): GraphPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) return null;
  return {
    nodes: obj.nodes as GraphPayload["nodes"],
    links: obj.links as GraphPayload["links"],
  };
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid body: need storyId, title, and deepDiveText or briefLine",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (!data.deepDiveText.trim() && !data.briefLine?.trim()) {
    return NextResponse.json(
      { success: false, error: "Need deepDiveText or briefLine to build a graph" },
      { status: 400 },
    );
  }

  const localGraph = newsToKnowledgeGraph({
    storyId: data.storyId,
    title: data.title,
    canonicalUrl: data.canonicalUrl,
    deepDiveText: data.deepDiveText,
    sources: data.sources,
    briefLine: data.briefLine,
  });

  let responseGraph: GraphPayload = localGraph;
  let persisted = false;
  let neo4jConfigured = false;
  let historySaved = false;
  let warning: string | undefined;

  const ensured = await ensureGoogleOAuthIdentity(request);
  const googleSub = ensured.identity?.sub;

  if (isNeo4jConfigured()) {
    neo4jConfigured = true;
    try {
      const graph = await upsertNewsKnowledgeGraph({
        storyId: data.storyId,
        title: data.title,
        canonicalUrl: data.canonicalUrl,
        googleSub,
        graph: localGraph,
      });
      responseGraph = graph.nodes.length > 0 ? graph : localGraph;
      persisted = true;
    } catch (err) {
      const message =
        err instanceof Neo4jGraphError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Neo4j upsert failed";
      console.warn(`[news-knowledge-graph] upsert failed: ${message}`);
      warning = message;
      persisted = false;
    }
  }

  if (data.save && googleSub) {
    const saved = await upsertNewsKnowledgeArticle({
      googleSub,
      email: ensured.identity?.email,
      storyId: data.storyId,
      title: data.title,
      canonicalUrl: data.canonicalUrl,
      deepDiveText: data.deepDiveText || null,
      graphPayload: responseGraph,
    });
    historySaved = saved.ok;
    if (!saved.ok && !warning) warning = saved.message;
  }

  const res = NextResponse.json({
    success: true,
    graph: responseGraph,
    persisted,
    neo4jConfigured,
    historySaved,
    signedIn: Boolean(googleSub),
    ...(warning ? { warning } : {}),
  });

  if (ensured.cookiesToSet) {
    applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}

export async function GET(request: NextRequest) {
  const storyId = request.nextUrl.searchParams.get("storyId")?.trim() ?? "";
  if (!storyId) {
    return NextResponse.json(
      { success: false, error: "storyId query required" },
      { status: 400 },
    );
  }

  const ensured = await ensureGoogleOAuthIdentity(request);
  if (!ensured.identity) {
    const res = NextResponse.json({
      success: true,
      graph: null,
      signedIn: false,
      saved: false,
    });
    if (ensured.cookiesToSet) {
      applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    }
    return res;
  }

  const result = await getNewsKnowledgeArticle(ensured.identity.sub, storyId);
  const res = NextResponse.json({
    success: result.ok,
    signedIn: true,
    saved: result.ok && result.data != null,
    graph: result.ok ? result.data?.graphPayload ?? null : null,
    article: result.ok
      ? result.data
        ? {
            id: result.data.id,
            storyId: result.data.storyId,
            title: result.data.title,
            canonicalUrl: result.data.canonicalUrl,
            updatedAt: result.data.updatedAt,
          }
        : null
      : null,
    ...(result.ok ? {} : { error: result.message }),
  });
  if (ensured.cookiesToSet) {
    applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}

/** Edit an existing graph (rename / add / delete — does not re-extract). */
export async function PATCH(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid body: need storyId and a valid op (rename | addNode | addLink | deleteNode)",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ensured = await ensureGoogleOAuthIdentity(request);
  const googleSub = ensured.identity?.sub;

  let base: GraphPayload | null = asGraphPayload(data.graph);
  let articleTitle = data.title?.trim() || "";
  let articleUrl = data.canonicalUrl?.trim() || "";
  let deepDiveText = data.deepDiveText ?? null;

  if (googleSub) {
    const existing = await getNewsKnowledgeArticle(googleSub, data.storyId);
    if (existing.ok && existing.data) {
      if (!base) base = existing.data.graphPayload;
      if (!articleTitle) articleTitle = existing.data.title;
      if (!articleUrl) articleUrl = existing.data.canonicalUrl;
      if (deepDiveText == null) deepDiveText = existing.data.deepDiveText;
    }
  }

  if (!base) {
    return NextResponse.json(
      {
        success: false,
        error: "No graph to edit — build the graph first, or pass graph in the body",
      },
      { status: 404 },
    );
  }

  let edited: GraphPayload | null = null;
  let editError = "Could not apply edit";

  if (data.op === "rename") {
    edited = renameGraphNode(base, data.nodeId, data.label);
    if (!edited) editError = "Node not found or invalid label";
  } else if (data.op === "addNode") {
    const result = addGraphNode(base, {
      domain: "news",
      kind: data.kind,
      label: data.label,
      scopeId: data.storyId,
    });
    edited = result?.graph ?? null;
    if (!edited) editError = "Could not add node — check kind and label";
  } else if (data.op === "addLink") {
    const result = addGraphLink(base, {
      domain: "news",
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type,
    });
    edited = result?.graph ?? null;
    if (!edited) editError = "Could not add link — check endpoints and type";
  } else {
    edited = deleteGraphNode(base, data.nodeId);
    if (!edited) editError = "Node not found";
  }

  if (!edited) {
    return NextResponse.json(
      { success: false, error: editError },
      { status: 400 },
    );
  }

  let responseGraph: GraphPayload = edited;
  let persisted = false;
  let neo4jConfigured = false;
  let historySaved = false;
  let warning: string | undefined;

  // Always return the edited payload. Neo4j neighborhood rematerialization can
  // reshuffle ids/labels; Convex history is the source of truth for reloads.
  responseGraph = edited;

  if (isNeo4jConfigured()) {
    neo4jConfigured = true;
    // Fire-and-forget Neo4j upsert so edit UI stays snappy; Convex is SoT.
    void upsertNewsKnowledgeGraph({
      storyId: data.storyId,
      title: articleTitle || "Untitled",
      canonicalUrl: articleUrl,
      googleSub,
      graph: edited,
    })
      .then(() => {
        /* persisted best-effort */
      })
      .catch((err) => {
        const message =
          err instanceof Neo4jGraphError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Neo4j upsert failed";
        console.warn(`[news-knowledge-graph] edit upsert failed: ${message}`);
      });
    persisted = false;
  }

  if (data.save && googleSub) {
    const saved = await upsertNewsKnowledgeArticle({
      googleSub,
      email: ensured.identity?.email,
      storyId: data.storyId,
      title: articleTitle || "Untitled",
      canonicalUrl: articleUrl,
      deepDiveText,
      graphPayload: responseGraph,
    });
    historySaved = saved.ok;
    if (!saved.ok && !warning) warning = saved.message;
  }

  const res = NextResponse.json({
    success: true,
    graph: responseGraph,
    persisted,
    neo4jConfigured,
    historySaved,
    signedIn: Boolean(googleSub),
    ...(warning ? { warning } : {}),
  });

  if (ensured.cookiesToSet) {
    applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}
