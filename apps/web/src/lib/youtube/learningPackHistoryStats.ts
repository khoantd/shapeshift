import type { GraphPayload } from "@/lib/neo4j/types";
import { extractKeyConcepts } from "@/lib/youtube/learningPackConcepts";
import {
  parseLearningPackContentType,
  type LearningPackContentType,
} from "@/lib/youtube/learningPackParse";
import { extractGlossary } from "@/lib/youtube/packKnowledgeGraph";

export type LearningPackHistoryStats = {
  conceptCount: number;
  termCount: number;
  contentType: LearningPackContentType | null;
};

function countNodesWithLabel(graph: GraphPayload | null | undefined, label: string): number {
  if (!graph) return 0;
  let n = 0;
  for (const node of graph.nodes) {
    if (node.labels.includes(label)) n += 1;
  }
  return n;
}

function contentTypeFromGraph(
  graph: GraphPayload | null | undefined,
): LearningPackContentType | null {
  if (!graph) return null;
  for (const node of graph.nodes) {
    if (!node.labels.includes("YtVideo")) continue;
    const raw = node.properties.contentType;
    if (typeof raw === "string") {
      return parseLearningPackContentType(raw);
    }
  }
  return null;
}

/** Prefer an explicit stored value, then the video node on the graph snapshot. */
export function resolveHistoryContentType(
  stored: string | null | undefined,
  graph: GraphPayload | null | undefined,
): LearningPackContentType | null {
  return parseLearningPackContentType(stored) ?? contentTypeFromGraph(graph);
}

/**
 * Counts key concepts / glossary terms and resolves pack content type
 * for history list rows. Prefers graphPayload counts when present.
 */
export function summarizeLearningPackStats(input: {
  markdown: string;
  graphPayload?: GraphPayload | null;
  contentType?: string | null;
}): LearningPackHistoryStats {
  const graph = input.graphPayload ?? null;
  const fromGraphConcepts = countNodesWithLabel(graph, "YtConcept");
  const fromGraphTerms = countNodesWithLabel(graph, "YtGlossaryTerm");

  const conceptCount =
    fromGraphConcepts > 0
      ? fromGraphConcepts
      : extractKeyConcepts(input.markdown).length;
  const termCount =
    fromGraphTerms > 0
      ? fromGraphTerms
      : extractGlossary(input.markdown).length;

  return {
    conceptCount,
    termCount,
    contentType: resolveHistoryContentType(input.contentType, graph),
  };
}

export function contentTypeLabel(
  contentType: LearningPackContentType | string | null | undefined,
): string {
  if (!contentType) return "";
  const t = String(contentType).trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
