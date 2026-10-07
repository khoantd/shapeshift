import type { GraphPayload } from "@/lib/neo4j/types";
import { requireNeo4jConfig, runNeo4jReadRecords, runNeo4jWrite } from "@/lib/neo4j/driver";
import { collectGraphFromRecords } from "@/lib/neo4j/payload";
import { dedupeGraphPayload } from "@/lib/youtube/packKnowledgeGraph";

export type NewsKnowledgeUpsertInput = {
  storyId: string;
  title: string;
  canonicalUrl: string;
  googleSub?: string;
  graph: GraphPayload;
};

const CHILD_LABELS = ["NewsConcept", "NewsEntity", "NewsSource"] as const;
type ChildLabel = (typeof CHILD_LABELS)[number];

const ARTICLE_NEIGHBORHOOD_CYPHER = `
MATCH (a:NewsArticle {id: $articleId})
OPTIONAL MATCH (a)-[r]->(child)
OPTIONAL MATCH (child)-[r2]->(other)
WHERE other IS NULL OR (a)-->(other) OR other = a
RETURN
  collect(DISTINCT a) AS articles,
  collect(DISTINCT r) AS hubRels,
  collect(DISTINCT child) AS children,
  collect(DISTINCT r2) AS crossRels,
  collect(DISTINCT other) AS others
`;

function isChildLabel(label: string): label is ChildLabel {
  return (CHILD_LABELS as readonly string[]).includes(label);
}

function relTypeForLabel(label: ChildLabel): "HAS_CONCEPT" | "MENTIONS" | "CITES" {
  if (label === "NewsConcept") return "HAS_CONCEPT";
  if (label === "NewsSource") return "CITES";
  return "MENTIONS";
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

export async function loadNewsNeighborhood(storyId: string): Promise<GraphPayload> {
  const config = requireNeo4jConfig();
  const articleId = `news:article:${storyId}`;
  const records = await runNeo4jReadRecords(config, ARTICLE_NEIGHBORHOOD_CYPHER, {
    articleId,
  });
  return remapToPropertyIds(collectGraphFromRecords(records));
}

export async function upsertNewsKnowledgeGraph(
  input: NewsKnowledgeUpsertInput,
): Promise<GraphPayload> {
  const config = requireNeo4jConfig();
  const now = new Date().toISOString();
  const articleId = `news:article:${input.storyId}`;

  await runNeo4jWrite(
    config,
    `
    MATCH (a:NewsArticle {id: $articleId})
    OPTIONAL MATCH (a)-[:HAS_CONCEPT|MENTIONS|CITES]->(child)
    DETACH DELETE child
    `,
    { articleId },
  );

  await runNeo4jWrite(
    config,
    `
    MERGE (a:NewsArticle {id: $articleId})
    SET a.name = $title,
        a.title = $title,
        a.storyId = $storyId,
        a.url = $url,
        a.googleSub = $googleSub,
        a.updatedAt = $updatedAt
    `,
    {
      articleId,
      title: input.title,
      storyId: input.storyId,
      url: input.canonicalUrl,
      googleSub: input.googleSub ?? "",
      updatedAt: now,
    },
  );

  for (const node of input.graph.nodes) {
    if (node.labels.includes("NewsArticle")) continue;
    const label = node.labels.find(isChildLabel);
    if (!label) continue;
    const id = String(node.properties.id ?? node.id);
    const props: Record<string, unknown> = {
      ...node.properties,
      id,
      storyId: input.storyId,
      name:
        typeof node.properties.name === "string"
          ? node.properties.name
          : typeof node.properties.title === "string"
            ? node.properties.title
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
      MATCH (a:NewsArticle {id: $articleId})
      MERGE (n:${label} {id: $id})
      SET n += $props
      MERGE (a)-[:${rel}]->(n)
      `,
      { articleId, id, props },
    );
  }

  for (const link of input.graph.links) {
    if (
      link.type !== "RELATED_TO" &&
      link.type !== "SUPPORTS" &&
      link.type !== "CONTRASTS_WITH"
    ) {
      continue;
    }
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
      MATCH (x {id: $sourceId})
      MATCH (y {id: $targetId})
      MERGE (x)-[r:${link.type}]->(y)
      SET r += $props
      `,
      { sourceId, targetId, props },
    );
  }

  return loadNewsNeighborhood(input.storyId);
}
