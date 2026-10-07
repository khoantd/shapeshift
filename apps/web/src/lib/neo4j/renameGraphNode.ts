import type { GraphNode, GraphPayload } from "@/lib/neo4j/types";

const LABEL_MAX = 120;
const DISPLAY_MAX = 64;

/**
 * Rename a node's display label without changing id or canonicalKey
 * (merge / Compare & Link keys stay stable).
 */
export function renameGraphNode(
  graph: GraphPayload,
  nodeId: string,
  newLabel: string,
): GraphPayload | null {
  const trimmed = newLabel.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > LABEL_MAX) return null;

  const display = trimmed.slice(0, DISPLAY_MAX);
  let found = false;

  const nodes = graph.nodes.map((node): GraphNode => {
    if (node.id !== nodeId) return node;
    found = true;
    const properties: Record<string, unknown> = {
      ...node.properties,
      name: trimmed,
    };
    if (typeof node.properties.title === "string") {
      properties.title = trimmed;
    }
    if (typeof node.properties.term === "string") {
      properties.term = trimmed;
    }
    return {
      ...node,
      label: display,
      properties,
    };
  });

  if (!found) return null;
  return { nodes, links: graph.links };
}
