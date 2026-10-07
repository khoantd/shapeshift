import { describe, expect, test } from "bun:test";
import type { GraphPayload } from "@/lib/neo4j/types";
import { renameGraphNode } from "./renameGraphNode";

const SAMPLE: GraphPayload = {
  nodes: [
    {
      id: "news:article:s1",
      label: "Article",
      labels: ["NewsArticle"],
      properties: {
        id: "news:article:s1",
        title: "Article",
        name: "Article",
        canonicalKey: "article:s1",
      },
    },
    {
      id: "news:entity:mb-bank-acb",
      label: "MB Bank, ACB",
      labels: ["NewsEntity"],
      properties: {
        id: "news:entity:mb-bank-acb",
        name: "MB Bank, ACB",
        term: "MB Bank, ACB",
        canonicalKey: "mb-bank-acb",
        storyId: "s1",
      },
    },
  ],
  links: [
    {
      id: "mentions:s1:mb-bank-acb",
      source: "news:article:s1",
      target: "news:entity:mb-bank-acb",
      type: "MENTIONS",
      properties: {},
    },
  ],
};

describe("renameGraphNode", () => {
  test("updates label and display properties; keeps canonicalKey and id", () => {
    const next = renameGraphNode(SAMPLE, "news:entity:mb-bank-acb", "MB Bank");
    expect(next).toBeTruthy();
    const node = next!.nodes.find((n) => n.id === "news:entity:mb-bank-acb");
    expect(node?.label).toBe("MB Bank");
    expect(node?.properties.name).toBe("MB Bank");
    expect(node?.properties.term).toBe("MB Bank");
    expect(node?.properties.canonicalKey).toBe("mb-bank-acb");
    expect(next!.links).toEqual(SAMPLE.links);
  });

  test("rejects empty or oversized labels", () => {
    expect(renameGraphNode(SAMPLE, "news:entity:mb-bank-acb", "   ")).toBeNull();
    expect(renameGraphNode(SAMPLE, "news:entity:mb-bank-acb", "x".repeat(121))).toBeNull();
  });

  test("returns null for unknown node id", () => {
    expect(renameGraphNode(SAMPLE, "missing", "Ok")).toBeNull();
  });
});
