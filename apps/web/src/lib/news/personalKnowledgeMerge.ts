import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";
import { dedupeGraphPayload } from "@/lib/youtube/packKnowledgeGraph";

export type UserKnowledgeLinkType = "RELATED_TO" | "SUPPORTS" | "CONTRASTS_WITH";

export type UserKnowledgeLink = {
  sourceNodeKey: string;
  targetNodeKey: string;
  type: UserKnowledgeLinkType;
  note?: string;
};

export type OverlapEntity = {
  canonicalKey: string;
  name: string;
  nodeId: string;
};

function nodeCanonicalKey(node: GraphNode): string | null {
  const k = node.properties.canonicalKey;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

function nodeDisplayName(node: GraphNode): string {
  for (const key of ["name", "title", "term", "text"] as const) {
    const v = node.properties[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return node.label;
}

function entityNodeId(canonicalKey: string): string {
  if (canonicalKey.startsWith("article:")) {
    return `news:article:${canonicalKey.slice("article:".length)}`;
  }
  if (canonicalKey.startsWith("source:")) {
    return `news:source:${canonicalKey.slice("source:".length)}`;
  }
  // Prefer entity id; concepts also use news:concept: — resolve from existing nodes first
  return `news:entity:${canonicalKey}`;
}

function resolveNodeId(
  byKey: Map<string, GraphNode>,
  canonicalKey: string,
): string | null {
  const existing = byKey.get(canonicalKey);
  if (existing) return existing.id;
  return entityNodeId(canonicalKey);
}

/**
 * Merge per-article graphs into one personal graph.
 * Entities/concepts union by canonicalKey; article hubs stay distinct.
 */
export function mergePersonalKnowledgeGraph(
  articles: readonly GraphPayload[],
  userLinks: readonly UserKnowledgeLink[],
): GraphPayload {
  const nodesById = new Map<string, GraphNode>();
  const byCanonical = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const linkSeen = new Set<string>();

  const pushLink = (link: GraphLink) => {
    const triple = `${link.source}\0${link.target}\0${link.type}`;
    if (linkSeen.has(triple)) return;
    linkSeen.add(triple);
    links.push(link);
  };

  for (const graph of articles) {
    for (const node of graph.nodes) {
      const key = nodeCanonicalKey(node);
      if (key && !node.labels.includes("NewsArticle") && !node.labels.includes("NewsSource")) {
        const existing = byCanonical.get(key);
        if (existing) {
          // Prefer first; remap later links via byCanonical
          continue;
        }
        byCanonical.set(key, node);
        nodesById.set(node.id, node);
      } else {
        if (!nodesById.has(node.id)) nodesById.set(node.id, node);
        if (key) byCanonical.set(key, node);
      }
    }

    for (const link of graph.links) {
      const remap = (id: string): string => {
        const n = graph.nodes.find((x) => x.id === id);
        if (!n) return id;
        const key = nodeCanonicalKey(n);
        if (
          key &&
          !n.labels.includes("NewsArticle") &&
          !n.labels.includes("NewsSource")
        ) {
          return byCanonical.get(key)?.id ?? id;
        }
        return id;
      };
      pushLink({
        ...link,
        source: remap(link.source),
        target: remap(link.target),
      });
    }
  }

  for (const ul of userLinks) {
    const srcKey = ul.sourceNodeKey.trim();
    const tgtKey = ul.targetNodeKey.trim();
    if (!srcKey || !tgtKey || srcKey === tgtKey) continue;
    const source = resolveNodeId(byCanonical, srcKey);
    const target = resolveNodeId(byCanonical, tgtKey);
    if (!source || !target || source === target) continue;
    // Ensure endpoint nodes exist if we only have keys
    if (!nodesById.has(source)) {
      const n: GraphNode = {
        id: source,
        label: srcKey,
        labels: ["NewsEntity"],
        properties: { id: source, name: srcKey, canonicalKey: srcKey },
      };
      nodesById.set(source, n);
      byCanonical.set(srcKey, n);
    }
    if (!nodesById.has(target)) {
      const n: GraphNode = {
        id: target,
        label: tgtKey,
        labels: ["NewsEntity"],
        properties: { id: target, name: tgtKey, canonicalKey: tgtKey },
      };
      nodesById.set(target, n);
      byCanonical.set(tgtKey, n);
    }
    pushLink({
      id: `user:${ul.type}:${srcKey}:${tgtKey}`,
      source,
      target,
      type: ul.type,
      properties: ul.note ? { note: ul.note.slice(0, 500) } : {},
    });
  }

  return dedupeGraphPayload({
    nodes: [...nodesById.values()],
    links,
  });
}

/** Shared entity/concept keys between two article graphs. */
export function compareArticleOverlap(
  a: GraphPayload,
  b: GraphPayload,
): OverlapEntity[] {
  const mapA = new Map<string, OverlapEntity>();
  for (const node of a.nodes) {
    if (node.labels.includes("NewsArticle") || node.labels.includes("NewsSource")) {
      continue;
    }
    const key = nodeCanonicalKey(node);
    if (!key) continue;
    mapA.set(key, {
      canonicalKey: key,
      name: nodeDisplayName(node),
      nodeId: node.id,
    });
  }
  const out: OverlapEntity[] = [];
  const seen = new Set<string>();
  for (const node of b.nodes) {
    if (node.labels.includes("NewsArticle") || node.labels.includes("NewsSource")) {
      continue;
    }
    const key = nodeCanonicalKey(node);
    if (!key || seen.has(key) || !mapA.has(key)) continue;
    seen.add(key);
    out.push(mapA.get(key)!);
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}
