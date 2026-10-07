import type { GraphPayload } from "@/lib/neo4j/types";
import { requireNeo4jConfig, runNeo4jReadRecords, runNeo4jWrite } from "@/lib/neo4j/driver";
import { collectGraphFromRecords } from "@/lib/neo4j/payload";
import { dedupeGraphPayload } from "@/lib/youtube/packKnowledgeGraph";

export type YoutubeKnowledgeUpsertInput = {
  videoId: string;
  title: string;
  channelTitle?: string;
  contentType?: string;
  graph: GraphPayload;
};

const CHILD_LABELS = ["YtConcept", "YtGlossaryTerm", "YtInsight"] as const;
type ChildLabel = (typeof CHILD_LABELS)[number];

/** Each relationship/node collected once — avoids cartesian multi-row copies. */
const VIDEO_NEIGHBORHOOD_CYPHER = `
MATCH (v:YtVideo {id: $videoId})
OPTIONAL MATCH (v)-[r]->(child)
OPTIONAL MATCH (child)-[r2]->(other)
WHERE other IS NULL OR (v)-->(other) OR other = v
RETURN
  collect(DISTINCT v) AS videos,
  collect(DISTINCT r) AS hubRels,
  collect(DISTINCT child) AS children,
  collect(DISTINCT r2) AS crossRels,
  collect(DISTINCT other) AS others
`;

function isChildLabel(label: string): label is ChildLabel {
  return (CHILD_LABELS as readonly string[]).includes(label);
}

function relTypeForLabel(label: ChildLabel): "HAS_CONCEPT" | "HAS_TERM" | "HAS_INSIGHT" {
  if (label === "YtConcept") return "HAS_CONCEPT";
  if (label === "YtGlossaryTerm") return "HAS_TERM";
  return "HAS_INSIGHT";
}

function propertyIdFromGraph(graph: GraphPayload, nodeId: string): string | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const id = node.properties.id;
  return typeof id === "string" ? id : nodeId;
}

function remapToPropertyIds(graph: GraphPayload): GraphPayload {
  const idMap = new Map<string, string>();
  for (const n of graph.nodes) {
    const propId = n.properties.id;
    if (typeof propId === "string" && propId.trim()) {
      idMap.set(n.id, propId);
    }
  }
  const nodes = graph.nodes.map((n) => {
    const id = idMap.get(n.id) ?? n.id;
    return { ...n, id };
  });
  const links = graph.links.map((l) => ({
    ...l,
    source: idMap.get(l.source) ?? l.source,
    target: idMap.get(l.target) ?? l.target,
  }));
  return dedupeGraphPayload({ nodes, links });
}

export async function loadYoutubeNeighborhood(videoId: string): Promise<GraphPayload> {
  const config = requireNeo4jConfig();
  const records = await runNeo4jReadRecords(config, VIDEO_NEIGHBORHOOD_CYPHER, {
    videoId,
  });
  return remapToPropertyIds(collectGraphFromRecords(records));
}

export async function upsertYoutubeKnowledgeGraph(
  input: YoutubeKnowledgeUpsertInput,
): Promise<GraphPayload> {
  const config = requireNeo4jConfig();
  const now = new Date().toISOString();

  await runNeo4jWrite(
    config,
    `
    MATCH (v:YtVideo {id: $videoId})
    OPTIONAL MATCH (v)-[:HAS_CONCEPT|HAS_TERM|HAS_INSIGHT]->(child)
    DETACH DELETE child
    `,
    { videoId: input.videoId },
  );

  await runNeo4jWrite(
    config,
    `
    MERGE (v:YtVideo {id: $videoId})
    SET v.name = $title,
        v.title = $title,
        v.channelTitle = $channelTitle,
        v.contentType = $contentType,
        v.updatedAt = $updatedAt
    `,
    {
      videoId: input.videoId,
      title: input.title,
      channelTitle: input.channelTitle ?? "",
      contentType: input.contentType ?? "",
      updatedAt: now,
    },
  );

  for (const node of input.graph.nodes) {
    if (node.labels.includes("YtVideo")) continue;
    const label = node.labels.find(isChildLabel);
    if (!label) continue;
    const id = String(node.properties.id ?? node.id);
    const props: Record<string, unknown> = {
      ...node.properties,
      id,
      videoId: input.videoId,
      name:
        typeof node.properties.name === "string"
          ? node.properties.name
          : typeof node.properties.title === "string"
            ? node.properties.title
            : typeof node.properties.term === "string"
              ? node.properties.term
              : node.label,
    };
    for (const [k, v] of Object.entries(props)) {
      if (v !== null && typeof v === "object") {
        props[k] = JSON.stringify(v);
      }
    }

    const rel = relTypeForLabel(label);
    await runNeo4jWrite(
      config,
      `
      MATCH (v:YtVideo {id: $videoId})
      MERGE (n:${label} {id: $id})
      SET n += $props
      MERGE (v)-[:${rel}]->(n)
      `,
      { videoId: input.videoId, id, props },
    );
  }

  for (const link of input.graph.links) {
    // MENTIONS removed from the model — only RELATED_TO / USES_TERM cross-links
    if (link.type !== "RELATED_TO" && link.type !== "USES_TERM") continue;
    const sourceId = propertyIdFromGraph(input.graph, link.source);
    const targetId = propertyIdFromGraph(input.graph, link.target);
    if (!sourceId || !targetId || sourceId === targetId) continue;

    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(link.properties ?? {})) {
      props[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    }

    await runNeo4jWrite(
      config,
      `
      MATCH (a {id: $sourceId})
      MATCH (b {id: $targetId})
      MERGE (a)-[r:${link.type}]->(b)
      SET r += $props
      `,
      { sourceId, targetId, props },
    );
  }

  return loadYoutubeNeighborhood(input.videoId);
}
