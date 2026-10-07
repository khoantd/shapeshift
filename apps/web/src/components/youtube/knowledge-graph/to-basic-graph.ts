import type { BasicNode, BasicRelationship } from "neo4j-arc/common";
import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";

function stringifyProperty(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function propertyTypes(
  properties: Record<string, unknown>,
): Record<string, string> {
  const types: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) types[key] = "null";
    else if (Array.isArray(value)) types[key] = "List";
    else if (typeof value === "object") types[key] = "Map";
    else types[key] = typeof value;
  }
  return types;
}

const PROPERTY_ORDER = [
  "name",
  "title",
  "term",
  "timestampLabel",
  "startSec",
  "definition",
  "text",
  "id",
] as const;

function mapProperties(
  properties: Record<string, unknown>,
  options?: { ensureDisplayName?: string },
): { properties: Record<string, string>; propertyTypes: Record<string, string> } {
  const source: Record<string, unknown> = { ...properties };
  const ensureName = options?.ensureDisplayName?.trim();
  const hasName =
    typeof source.name === "string" && String(source.name).trim().length > 0;
  if (!hasName && ensureName) {
    source.name = ensureName;
  }

  const orderedKeys = [
    ...PROPERTY_ORDER.filter((key) => key in source),
    ...Object.keys(source)
      .filter((key) => !(PROPERTY_ORDER as readonly string[]).includes(key as never))
      .sort((a, b) => a.localeCompare(b)),
  ];

  const mapped: Record<string, string> = {};
  for (const key of orderedKeys) {
    mapped[key] = stringifyProperty(source[key]);
  }
  return { properties: mapped, propertyTypes: propertyTypes(source) };
}

export function toBasicNode(node: GraphNode): BasicNode {
  const { properties, propertyTypes: types } = mapProperties(node.properties, {
    ensureDisplayName: node.label,
  });
  return {
    id: node.id,
    elementId: node.id,
    labels: node.labels,
    properties,
    propertyTypes: types,
  };
}

export function toBasicRelationship(link: GraphLink): BasicRelationship {
  const { properties, propertyTypes: types } = mapProperties(link.properties);
  return {
    id: link.id,
    elementId: link.id,
    startNodeId: link.source,
    endNodeId: link.target,
    type: link.type,
    properties,
    propertyTypes: types,
  };
}

export function toBasicGraph(payload: GraphPayload): {
  nodes: BasicNode[];
  relationships: BasicRelationship[];
} {
  const seenNodes = new Set<string>();
  const nodes: BasicNode[] = [];
  for (const n of payload.nodes) {
    if (seenNodes.has(n.id)) continue;
    seenNodes.add(n.id);
    nodes.push(toBasicNode(n));
  }
  const seenRels = new Set<string>();
  const relationships: BasicRelationship[] = [];
  for (const l of payload.links) {
    if (seenRels.has(l.id)) continue;
    if (!seenNodes.has(l.source) || !seenNodes.has(l.target)) continue;
    seenRels.add(l.id);
    relationships.push(toBasicRelationship(l));
  }
  return { nodes, relationships };
}
