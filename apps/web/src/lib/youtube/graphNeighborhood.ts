import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";

export type NeighborhoodHops = 1 | 2;

/** Parse `startSec` from a node (number or numeric string). */
export function nodeStartSec(node: GraphNode): number | null {
  const v = node.properties.startSec;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Normalize a concept/term display string for same-noun matching. */
export function normalizeNounKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Best noun string on a concept or glossary node (`term` / `name` / `title` / label).
 */
export function nodeNounKey(node: GraphNode): string {
  const props = node.properties;
  for (const key of ["term", "name", "title"] as const) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return normalizeNounKey(v);
  }
  return normalizeNounKey(String(node.label ?? ""));
}

/**
 * Hide nodes that have not yet been "unlocked" at `playbackSec`.
 *
 * - `YtVideo`: always kept
 * - `YtConcept`: kept when `startSec <= playbackSec`
 * - `YtGlossaryTerm`: unlocked when
 *   - a `USES_TERM` parent concept is unlocked, or
 *   - it shares the same normalized noun as an unlocked concept, or
 *   - once any concept is unlocked: all `HAS_TERM` targets of the video, or
 *   - undirected `RELATED_TO` to an already-unlocked concept/term (glossary only)
 * - Other labels (e.g. insights): hidden
 *
 * Future concepts are never unlocked early via `RELATED_TO` (time gate stays).
 * Only links with both ends in the keep set are returned.
 */
export function focusByProgress(
  graph: GraphPayload,
  playbackSec: number,
): GraphPayload {
  const byId = new Map<string, GraphNode>();
  for (const n of graph.nodes) {
    if (!byId.has(n.id)) byId.set(n.id, n);
  }

  const unlockedConcepts = new Set<string>();
  const unlockedNounKeys = new Set<string>();
  for (const n of graph.nodes) {
    if (!n.labels.includes("YtConcept")) continue;
    const sec = nodeStartSec(n);
    if (sec !== null && sec <= playbackSec) {
      unlockedConcepts.add(n.id);
      const key = nodeNounKey(n);
      if (key) unlockedNounKeys.add(key);
    }
  }

  const unlockedTerms = new Set<string>();
  for (const l of graph.links) {
    if (l.type !== "USES_TERM") continue;
    if (!unlockedConcepts.has(l.source)) continue;
    const target = byId.get(l.target);
    if (target?.labels.includes("YtGlossaryTerm")) unlockedTerms.add(l.target);
  }

  if (unlockedNounKeys.size > 0) {
    for (const n of graph.nodes) {
      if (!n.labels.includes("YtGlossaryTerm")) continue;
      if (unlockedTerms.has(n.id)) continue;
      const key = nodeNounKey(n);
      if (key && unlockedNounKeys.has(key)) unlockedTerms.add(n.id);
    }
  }

  // Once any concept is unlocked, reveal the full glossary via video HAS_TERM.
  if (unlockedConcepts.size > 0) {
    for (const l of graph.links) {
      if (l.type !== "HAS_TERM") continue;
      const source = byId.get(l.source);
      if (!source?.labels.includes("YtVideo")) continue;
      const target = byId.get(l.target);
      if (target?.labels.includes("YtGlossaryTerm")) unlockedTerms.add(l.target);
    }
  }

  // RELATED_TO: pull in adjacent glossary terms (not future concepts).
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of graph.links) {
      if (l.type !== "RELATED_TO") continue;
      const aUnlocked =
        unlockedConcepts.has(l.source) || unlockedTerms.has(l.source);
      const bUnlocked =
        unlockedConcepts.has(l.target) || unlockedTerms.has(l.target);
      if (aUnlocked === bUnlocked) continue;
      const lockedId = aUnlocked ? l.target : l.source;
      const locked = byId.get(lockedId);
      if (!locked?.labels.includes("YtGlossaryTerm")) continue;
      if (unlockedTerms.has(lockedId)) continue;
      unlockedTerms.add(lockedId);
      grew = true;
    }
  }

  const keep = new Set<string>();
  for (const n of graph.nodes) {
    if (n.labels.includes("YtVideo")) {
      keep.add(n.id);
      continue;
    }
    if (n.labels.includes("YtConcept") && unlockedConcepts.has(n.id)) {
      keep.add(n.id);
      continue;
    }
    if (n.labels.includes("YtGlossaryTerm") && unlockedTerms.has(n.id)) {
      keep.add(n.id);
    }
  }

  const nodes = [...keep]
    .map((id) => byId.get(id))
    .filter((n): n is GraphNode => Boolean(n));

  const linkKeys = new Set<string>();
  const links: GraphLink[] = [];
  for (const l of graph.links) {
    if (!keep.has(l.source) || !keep.has(l.target)) continue;
    const triple = `${l.source}\0${l.target}\0${l.type}`;
    if (linkKeys.has(triple)) continue;
    linkKeys.add(triple);
    links.push(l);
  }

  return { nodes, links };
}

/**
 * Undirected BFS from seedId up to `hops`.
 * Returns seed + neighbors and only links whose both ends are in that set.
 */
export function focusNeighborhood(
  graph: GraphPayload,
  seedId: string,
  hops: NeighborhoodHops,
): GraphPayload {
  if (!seedId || hops < 1) {
    return { nodes: [], links: [] };
  }

  const byId = new Map<string, GraphNode>();
  for (const n of graph.nodes) {
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
  if (!byId.has(seedId)) {
    return { nodes: [], links: [] };
  }

  const adj = new Map<string, Set<string>>();
  for (const l of graph.links) {
    if (!byId.has(l.source) || !byId.has(l.target)) continue;
    if (l.source === l.target) continue;
    if (!adj.has(l.source)) adj.set(l.source, new Set());
    if (!adj.has(l.target)) adj.set(l.target, new Set());
    adj.get(l.source)!.add(l.target);
    adj.get(l.target)!.add(l.source);
  }

  const keep = new Set<string>([seedId]);
  let frontier = new Set<string>([seedId]);

  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (keep.has(nb)) continue;
        keep.add(nb);
        next.add(nb);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  const nodes = [...keep]
    .map((id) => byId.get(id))
    .filter((n): n is GraphNode => Boolean(n));

  const linkKeys = new Set<string>();
  const links: GraphLink[] = [];
  for (const l of graph.links) {
    if (!keep.has(l.source) || !keep.has(l.target)) continue;
    const triple = `${l.source}\0${l.target}\0${l.type}`;
    if (linkKeys.has(triple)) continue;
    linkKeys.add(triple);
    links.push(l);
  }

  return { nodes, links };
}

export type TypeFocusSelection = {
  /** Empty = no label filter (all labels). */
  labels: ReadonlySet<string>;
  /** Empty = no relationship-type filter (all types). */
  relTypes: ReadonlySet<string>;
};

function nodeHasAnyLabel(node: GraphNode, labels: ReadonlySet<string>): boolean {
  for (const label of node.labels) {
    if (labels.has(label)) return true;
  }
  return false;
}

/**
 * Isolate the graph to selected node labels and/or relationship types.
 * Empty sets mean "no filter" for that category.
 */
export function focusByType(
  graph: GraphPayload,
  selection: TypeFocusSelection,
): GraphPayload {
  const hasLabelFilter = selection.labels.size > 0;
  const hasRelFilter = selection.relTypes.size > 0;
  if (!hasLabelFilter && !hasRelFilter) {
    return graph;
  }

  const byId = new Map<string, GraphNode>();
  for (const n of graph.nodes) {
    if (!byId.has(n.id)) byId.set(n.id, n);
  }

  if (hasLabelFilter && !hasRelFilter) {
    const keep = new Set<string>();
    for (const n of graph.nodes) {
      if (nodeHasAnyLabel(n, selection.labels)) keep.add(n.id);
    }
    const nodes = [...keep]
      .map((id) => byId.get(id))
      .filter((n): n is GraphNode => Boolean(n));
    const links = graph.links.filter(
      (l) => keep.has(l.source) && keep.has(l.target),
    );
    return { nodes, links };
  }

  if (!hasLabelFilter && hasRelFilter) {
    const links = graph.links.filter((l) => selection.relTypes.has(l.type));
    const keep = new Set<string>();
    for (const l of links) {
      keep.add(l.source);
      keep.add(l.target);
    }
    const nodes = [...keep]
      .map((id) => byId.get(id))
      .filter((n): n is GraphNode => Boolean(n));
    return { nodes, links };
  }

  // Both filters: nodes matching labels, then selected-type links among them.
  const keep = new Set<string>();
  for (const n of graph.nodes) {
    if (nodeHasAnyLabel(n, selection.labels)) keep.add(n.id);
  }
  const nodes = [...keep]
    .map((id) => byId.get(id))
    .filter((n): n is GraphNode => Boolean(n));
  const links = graph.links.filter(
    (l) =>
      selection.relTypes.has(l.type) &&
      keep.has(l.source) &&
      keep.has(l.target),
  );
  return { nodes, links };
}

/** Count nodes per Neo4j label (and `*` total) for Overview legends. */
export function countLabels(
  graph: GraphPayload,
): Record<string, number> {
  const counts: Record<string, number> = { "*": graph.nodes.length };
  for (const n of graph.nodes) {
    for (const label of n.labels) {
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }
  return counts;
}

/** Count links per relationship type (and `*` total) for Overview legends. */
export function countRelTypes(
  graph: GraphPayload,
): Record<string, number> {
  const counts: Record<string, number> = { "*": graph.links.length };
  for (const l of graph.links) {
    counts[l.type] = (counts[l.type] ?? 0) + 1;
  }
  return counts;
}
