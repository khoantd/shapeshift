import { describe, expect, test } from "bun:test";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  compareArticleOverlap,
  mergePersonalKnowledgeGraph,
} from "./personalKnowledgeMerge";

function articleGraph(
  storyId: string,
  entities: Array<{ key: string; name: string }>,
): GraphPayload {
  const articleId = `news:article:${storyId}`;
  const nodes = [
    {
      id: articleId,
      label: "Article",
      labels: ["NewsArticle"],
      properties: { id: articleId, storyId, title: storyId, canonicalKey: `article:${storyId}` },
    },
    ...entities.map((e) => ({
      id: `news:entity:${e.key}`,
      label: e.name,
      labels: ["NewsEntity"],
      properties: { id: `news:entity:${e.key}`, name: e.name, canonicalKey: e.key },
    })),
  ];
  const links = entities.map((e) => ({
    id: `mentions:${storyId}:${e.key}`,
    source: articleId,
    target: `news:entity:${e.key}`,
    type: "MENTIONS",
    properties: {},
  }));
  return { nodes, links };
}

describe("mergePersonalKnowledgeGraph", () => {
  test("unions entities by canonicalKey and keeps both article hubs", () => {
    const a = articleGraph("a", [
      { key: "fed", name: "Federal Reserve" },
      { key: "rates", name: "Interest rates" },
    ]);
    const b = articleGraph("b", [
      { key: "fed", name: "Federal Reserve" },
      { key: "bonds", name: "Bond yields" },
    ]);
    const merged = mergePersonalKnowledgeGraph([a, b], []);
    expect(merged.nodes.filter((n) => n.labels.includes("NewsArticle")).length).toBe(2);
    expect(merged.nodes.filter((n) => n.labels.includes("NewsEntity")).length).toBe(3);
    expect(merged.links.filter((l) => l.type === "SAME_ENTITY").length).toBeGreaterThanOrEqual(0);
    // Both articles MENTIONS the shared fed entity
    const fedMentions = merged.links.filter(
      (l) => l.type === "MENTIONS" && l.target === "news:entity:fed",
    );
    expect(fedMentions.length).toBe(2);
  });

  test("appends user links with typed edges", () => {
    const a = articleGraph("a", [{ key: "fed", name: "Federal Reserve" }]);
    const b = articleGraph("b", [{ key: "rates", name: "Interest rates" }]);
    const merged = mergePersonalKnowledgeGraph([a, b], [
      {
        sourceNodeKey: "fed",
        targetNodeKey: "rates",
        type: "SUPPORTS",
        note: "Policy drives rates",
      },
    ]);
    expect(
      merged.links.some(
        (l) =>
          l.type === "SUPPORTS" &&
          l.source === "news:entity:fed" &&
          l.target === "news:entity:rates",
      ),
    ).toBe(true);
  });
});

describe("compareArticleOverlap", () => {
  test("returns shared canonical keys between two graphs", () => {
    const a = articleGraph("a", [
      { key: "fed", name: "Federal Reserve" },
      { key: "rates", name: "Interest rates" },
    ]);
    const b = articleGraph("b", [
      { key: "fed", name: "Federal Reserve" },
      { key: "bonds", name: "Bond yields" },
    ]);
    const overlap = compareArticleOverlap(a, b);
    expect(overlap.map((o) => o.canonicalKey).sort()).toEqual(["fed"]);
    expect(overlap[0]?.name).toMatch(/Federal/i);
  });
});
