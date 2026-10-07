import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";

const LABEL_MAX = 120;
const DISPLAY_MAX = 64;

export type NewsNodeKind = "NewsConcept" | "NewsEntity" | "NewsSource";
export type YoutubeNodeKind = "YtConcept" | "YtGlossaryTerm";
export type GraphNodeKind = NewsNodeKind | YoutubeNodeKind;
export type GraphDomain = "news" | "youtube";

export const NEWS_NODE_KINDS: readonly NewsNodeKind[] = [
  "NewsConcept",
  "NewsEntity",
  "NewsSource",
];

export const YOUTUBE_NODE_KINDS: readonly YoutubeNodeKind[] = [
  "YtConcept",
  "YtGlossaryTerm",
];

export const NEWS_LINK_TYPES = ["RELATED_TO", "SUPPORTS", "CONTRASTS_WITH"] as const;
export const YOUTUBE_LINK_TYPES = ["RELATED_TO", "USES_TERM"] as const;

export type AddGraphNodeInput = {
  kind: GraphNodeKind;
  label: string;
  domain: GraphDomain;
  /** storyId or videoId — used for stable id prefixes. */
  scopeId?: string;
};

export type AddGraphNodeResult = {
  graph: GraphPayload;
  nodeId: string;
};

export type AddGraphLinkInput = {
  sourceId: string;
  targetId: string;
  type?: string;
  domain?: GraphDomain;
};

export type AddGraphLinkResult = {
  graph: GraphPayload;
  linkId: string;
};

function slugify(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "item"
  );
}

function allocateId(used: Set<string>, base: string): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}:${n}`)) n += 1;
  const id = `${base}:${n}`;
  used.add(id);
  return id;
}

function isNewsKind(kind: string): kind is NewsNodeKind {
  return (NEWS_NODE_KINDS as readonly string[]).includes(kind);
}

function isYoutubeKind(kind: string): kind is YoutubeNodeKind {
  return (YOUTUBE_NODE_KINDS as readonly string[]).includes(kind);
}

function allowedLinkTypes(domain: GraphDomain): readonly string[] {
  return domain === "youtube" ? YOUTUBE_LINK_TYPES : NEWS_LINK_TYPES;
}

function kindMatchesDomain(kind: GraphNodeKind, domain: GraphDomain): boolean {
  if (domain === "news") return isNewsKind(kind);
  return isYoutubeKind(kind);
}

function buildNodeIdBase(
  kind: GraphNodeKind,
  key: string,
  scopeId: string,
): string {
  if (kind === "NewsConcept") return `news:concept:${key}`;
  if (kind === "NewsEntity") return `news:entity:${key}`;
  if (kind === "NewsSource") return `news:source:${key}`;
  if (kind === "YtConcept") {
    return scopeId ? `concept:${scopeId}:${key}:user` : `concept:user:${key}`;
  }
  return scopeId ? `term:${scopeId}:${key}` : `term:user:${key}`;
}

function canonicalKeyFor(kind: GraphNodeKind, key: string): string {
  if (kind === "NewsSource") return `source:${key}`;
  return key;
}

/**
 * Append a user-created node. Ids / canonicalKey stay stable across renames.
 */
export function addGraphNode(
  graph: GraphPayload,
  input: AddGraphNodeInput,
): AddGraphNodeResult | null {
  const trimmed = input.label.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > LABEL_MAX) return null;
  if (!kindMatchesDomain(input.kind, input.domain)) return null;

  const key = slugify(trimmed);
  const scopeId = input.scopeId?.trim() || "";
  const used = new Set(graph.nodes.map((n) => n.id));
  const baseId = buildNodeIdBase(input.kind, key, scopeId);
  const nodeId = allocateId(used, baseId);
  const display = trimmed.slice(0, DISPLAY_MAX);
  const canonicalKey = canonicalKeyFor(input.kind, key);

  const properties: Record<string, unknown> = {
    id: nodeId,
    name: trimmed,
    canonicalKey,
    userCreated: true,
  };

  if (input.kind === "NewsConcept" || input.kind === "YtConcept") {
    properties.title = trimmed;
  }
  if (input.kind === "NewsEntity" || input.kind === "YtGlossaryTerm") {
    properties.term = trimmed;
  }
  if (input.kind === "NewsSource") {
    properties.title = trimmed;
  }
  if (scopeId && input.domain === "news") {
    properties.storyId = scopeId;
  }
  if (scopeId && input.domain === "youtube") {
    properties.videoId = scopeId;
  }

  const node: GraphNode = {
    id: nodeId,
    label: display,
    labels: [input.kind],
    properties,
  };

  return {
    graph: { nodes: [...graph.nodes, node], links: graph.links },
    nodeId,
  };
}

/**
 * Append a user-created edge between two existing nodes.
 */
export function addGraphLink(
  graph: GraphPayload,
  input: AddGraphLinkInput,
): AddGraphLinkResult | null {
  const sourceId = input.sourceId.trim();
  const targetId = input.targetId.trim();
  if (!sourceId || !targetId || sourceId === targetId) return null;

  const byId = new Set(graph.nodes.map((n) => n.id));
  if (!byId.has(sourceId) || !byId.has(targetId)) return null;

  const domain = input.domain ?? "news";
  const type = (input.type?.trim() || "RELATED_TO").toUpperCase();
  if (!allowedLinkTypes(domain).includes(type)) return null;

  const duplicate = graph.links.some(
    (l) =>
      l.source === sourceId && l.target === targetId && l.type === type,
  );
  if (duplicate) return null;

  const used = new Set(graph.links.map((l) => l.id));
  const linkId = allocateId(used, `user:${type}:${sourceId}:${targetId}`);
  const link: GraphLink = {
    id: linkId,
    source: sourceId,
    target: targetId,
    type,
    properties: { userCreated: true },
  };

  return {
    graph: { nodes: graph.nodes, links: [...graph.links, link] },
    linkId,
  };
}

/**
 * Remove a node and every link that touches it.
 */
export function deleteGraphNode(
  graph: GraphPayload,
  nodeId: string,
): GraphPayload | null {
  const id = nodeId.trim();
  if (!id) return null;
  if (!graph.nodes.some((n) => n.id === id)) return null;

  return {
    nodes: graph.nodes.filter((n) => n.id !== id),
    links: graph.links.filter((l) => l.source !== id && l.target !== id),
  };
}
