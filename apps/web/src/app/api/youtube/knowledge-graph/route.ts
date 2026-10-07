import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNeo4jConfigured } from "@/lib/neo4j/config";
import { Neo4jGraphError } from "@/lib/neo4j/cypher-guard";
import { addGraphLink, addGraphNode, deleteGraphNode } from "@/lib/neo4j/mutateGraph";
import { renameGraphNode } from "@/lib/neo4j/renameGraphNode";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  loadYoutubeNeighborhood,
  upsertYoutubeKnowledgeGraph,
} from "@/lib/neo4j/youtube";
import { updateLearningPackGraphPayload } from "@/lib/youtube/learningPackHistory";
import { packToKnowledgeGraph } from "@/lib/youtube/packKnowledgeGraph";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
  type EnsuredYouTubeIdentity,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

const VIDEO_ID_RE = /^[\w-]{11}$/;

const graphPayloadSchema = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())).max(500),
  links: z.array(z.record(z.string(), z.unknown())).max(2000),
});

const postSchema = z.object({
  videoId: z.string().regex(VIDEO_ID_RE),
  title: z.string().trim().min(1).max(500),
  channelTitle: z.string().trim().max(200).optional(),
  contentType: z.string().trim().max(64).optional(),
  markdown: z.string().min(40).max(200_000),
  /** When set and user is signed in, overwrite the history row's graph snapshot. */
  historyPackId: z.string().trim().min(1).max(128).optional(),
});

const patchBase = {
  videoId: z.string().regex(VIDEO_ID_RE),
  /** Current in-memory graph (required). */
  graph: graphPayloadSchema,
  title: z.string().trim().min(1).max(500).optional(),
  channelTitle: z.string().trim().max(200).optional(),
  contentType: z.string().trim().max(64).optional(),
  historyPackId: z.string().trim().min(1).max(128).optional(),
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
      kind: z.enum(["YtConcept", "YtGlossaryTerm"]),
      label: z.string().trim().min(1).max(120),
    }),
    z.object({
      ...patchBase,
      op: z.literal("addLink"),
      sourceId: z.string().trim().min(1).max(300),
      targetId: z.string().trim().min(1).max(300),
      type: z
        .enum(["RELATED_TO", "USES_TERM"])
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

async function maybeSaveHistoryGraph(
  request: NextRequest,
  historyPackId: string | undefined,
  graph: GraphPayload,
): Promise<{ historySaved: boolean; ensured: EnsuredYouTubeIdentity | null }> {
  if (!historyPackId) {
    return { historySaved: false, ensured: null };
  }
  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return { historySaved: false, ensured };
  }
  const ok = await updateLearningPackGraphPayload({
    id: historyPackId,
    googleSub: ensured.identity.sub,
    graphPayload: graph,
  });
  return { historySaved: ok, ensured };
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid body: need videoId, title, markdown" },
      { status: 400 },
    );
  }

  const localGraph = packToKnowledgeGraph({
    videoId: parsed.data.videoId,
    title: parsed.data.title,
    channelTitle: parsed.data.channelTitle,
    contentType: parsed.data.contentType,
    markdown: parsed.data.markdown,
  });

  let responseGraph = localGraph;
  let persisted = false;
  let neo4jConfigured = false;
  let warning: string | undefined;

  if (!isNeo4jConfigured()) {
    neo4jConfigured = false;
    persisted = false;
  } else {
    neo4jConfigured = true;
    try {
      const graph = await upsertYoutubeKnowledgeGraph({
        videoId: parsed.data.videoId,
        title: parsed.data.title,
        channelTitle: parsed.data.channelTitle,
        contentType: parsed.data.contentType,
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
      console.warn(`[youtube-knowledge-graph] upsert failed: ${message}`);
      warning = message;
      persisted = false;
    }
  }

  const { historySaved, ensured } = await maybeSaveHistoryGraph(
    request,
    parsed.data.historyPackId,
    responseGraph,
  );

  const res = NextResponse.json({
    success: true,
    graph: responseGraph,
    persisted,
    neo4jConfigured,
    historySaved,
    ...(warning ? { warning } : {}),
  });

  if (ensured?.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
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
          "Invalid body: need videoId, graph, and a valid op (rename | addNode | addLink | deleteNode)",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const base = asGraphPayload(data.graph);
  if (!base) {
    return NextResponse.json(
      { success: false, error: "Invalid graph payload" },
      { status: 400 },
    );
  }

  let edited: GraphPayload | null = null;
  let editError = "Could not apply edit";

  if (data.op === "rename") {
    edited = renameGraphNode(base, data.nodeId, data.label);
    if (!edited) editError = "Node not found or invalid label";
  } else if (data.op === "addNode") {
    const result = addGraphNode(base, {
      domain: "youtube",
      kind: data.kind,
      label: data.label,
      scopeId: data.videoId,
    });
    edited = result?.graph ?? null;
    if (!edited) editError = "Could not add node — check kind and label";
  } else if (data.op === "addLink") {
    const result = addGraphLink(base, {
      domain: "youtube",
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

  let persisted = false;
  let neo4jConfigured = false;
  let warning: string | undefined;

  if (isNeo4jConfigured()) {
    neo4jConfigured = true;
    // Fire-and-forget Neo4j upsert so edit UI stays snappy; history is SoT.
    void upsertYoutubeKnowledgeGraph({
      videoId: data.videoId,
      title: data.title?.trim() || "Untitled",
      channelTitle: data.channelTitle,
      contentType: data.contentType,
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
        console.warn(`[youtube-knowledge-graph] edit upsert failed: ${message}`);
      });
    persisted = false;
  }

  const { historySaved, ensured } = await maybeSaveHistoryGraph(
    request,
    data.historyPackId,
    edited,
  );

  if (data.historyPackId && !ensured?.identity && !warning) {
    warning = "Graph updated locally. Sign in to save across sessions.";
  }

  const res = NextResponse.json({
    success: true,
    graph: edited,
    persisted,
    neo4jConfigured,
    historySaved,
    signedIn: Boolean(ensured?.identity),
    ...(warning ? { warning } : {}),
  });

  if (ensured?.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() ?? "";
  if (!VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json(
      { success: false, error: "videoId query required (11-char YouTube id)" },
      { status: 400 },
    );
  }

  if (!isNeo4jConfigured()) {
    return NextResponse.json({
      success: true,
      graph: { nodes: [], links: [] },
      neo4jConfigured: false,
      persisted: false,
    });
  }

  try {
    const graph = await loadYoutubeNeighborhood(videoId);
    return NextResponse.json({
      success: true,
      graph,
      neo4jConfigured: true,
      persisted: graph.nodes.length > 0,
    });
  } catch (err) {
    const message =
      err instanceof Neo4jGraphError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Neo4j query failed";
    return NextResponse.json(
      { success: false, error: message, neo4jConfigured: true },
      { status: err instanceof Neo4jGraphError ? err.status : 502 },
    );
  }
}
