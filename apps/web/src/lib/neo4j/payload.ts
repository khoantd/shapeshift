import {
  isInt,
  isNode,
  isPath,
  isRelationship,
  type Integer,
  type Node,
  type Path,
  type Relationship,
} from "neo4j-driver";
import type { GraphLink, GraphNode, GraphPayload } from "./types";

export type { GraphLink, GraphNode, GraphPayload } from "./types";

const MAX_NODES = 500;
const MAX_LINKS = 1000;

export function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isInt(value)) return (value as Integer).toNumber();
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlainValue(v);
    }
    return out;
  }
  return value;
}

function nodeElementId(node: Node): string {
  return node.elementId || String(node.identity);
}

function relElementId(rel: Relationship): string {
  return rel.elementId || String(rel.identity);
}

function displayLabel(
  labels: string[],
  properties: Record<string, unknown>,
): string {
  for (const key of ["name", "title", "term", "id", "slug"] as const) {
    const v = properties[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return labels[0] ?? "Node";
}

export function collectGraphFromRecords(
  records: Array<{ keys: readonly PropertyKey[]; get: (key: string) => unknown }>,
): GraphPayload {
  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();

  const addNode = (node: Node) => {
    if (nodes.size >= MAX_NODES && !nodes.has(nodeElementId(node))) return;
    const id = nodeElementId(node);
    if (nodes.has(id)) return;
    const properties = toPlainValue(node.properties) as Record<string, unknown>;
    nodes.set(id, {
      id,
      labels: [...node.labels],
      label: displayLabel(node.labels, properties),
      properties,
    });
  };

  const addRel = (rel: Relationship) => {
    if (links.size >= MAX_LINKS && !links.has(relElementId(rel))) return;
    const id = relElementId(rel);
    if (links.has(id)) return;
    const source = rel.startNodeElementId || String(rel.start);
    const target = rel.endNodeElementId || String(rel.end);
    links.set(id, {
      id,
      source,
      target,
      type: rel.type,
      properties: toPlainValue(rel.properties) as Record<string, unknown>,
    });
  };

  const walk = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (isNode(value)) {
      addNode(value);
      return;
    }
    if (isRelationship(value)) {
      addRel(value);
      return;
    }
    if (isPath(value)) {
      const path = value as Path;
      for (const seg of path.segments) {
        addNode(seg.start);
        addNode(seg.end);
        addRel(seg.relationship);
      }
      if (path.segments.length === 0 && path.start) addNode(path.start);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    }
  };

  for (const record of records) {
    for (const key of record.keys) {
      walk(record.get(String(key)));
    }
  }

  const nodeIds = new Set(nodes.keys());
  const prunedLinks = [...links.values()].filter(
    (l) => nodeIds.has(l.source) && nodeIds.has(l.target),
  );

  return { nodes: [...nodes.values()], links: prunedLinks };
}
