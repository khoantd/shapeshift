import { describe, expect, test } from "bun:test";
import type { GraphPayload } from "@/lib/neo4j/types";
import { addGraphLink, addGraphNode, deleteGraphNode } from "./mutateGraph";

const NEWS_SAMPLE: GraphPayload = {
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
      id: "news:entity:fed",
      label: "Fed",
      labels: ["NewsEntity"],
      properties: {
        id: "news:entity:fed",
        name: "Fed",
        term: "Fed",
        canonicalKey: "fed",
      },
    },
  ],
  links: [
    {
      id: "mentions:s1:fed",
      source: "news:article:s1",
      target: "news:entity:fed",
      type: "MENTIONS",
      properties: {},
    },
  ],
};

const YT_SAMPLE: GraphPayload = {
  nodes: [
    {
      id: "vid12345678",
      label: "Video",
      labels: ["YtVideo"],
      properties: { id: "vid12345678", name: "Video", title: "Video" },
    },
    {
      id: "concept:vid12345678:auth:0",
      label: "Auth",
      labels: ["YtConcept"],
      properties: {
        id: "concept:vid12345678:auth:0",
        name: "Auth",
        title: "Auth",
      },
    },
  ],
  links: [],
};

describe("addGraphNode", () => {
  test("adds a NewsEntity with stable id and canonicalKey", () => {
    const result = addGraphNode(NEWS_SAMPLE, {
      domain: "news",
      kind: "NewsEntity",
      label: "MB Bank",
      scopeId: "s1",
    });
    expect(result).toBeTruthy();
    expect(result!.nodeId).toBe("news:entity:mb-bank");
    const node = result!.graph.nodes.find((n) => n.id === result!.nodeId);
    expect(node?.labels).toEqual(["NewsEntity"]);
    expect(node?.properties.name).toBe("MB Bank");
    expect(node?.properties.canonicalKey).toBe("mb-bank");
    expect(node?.properties.userCreated).toBe(true);
    expect(result!.graph.links).toEqual(NEWS_SAMPLE.links);
  });

  test("allocates unique id when base collides", () => {
    const result = addGraphNode(NEWS_SAMPLE, {
      domain: "news",
      kind: "NewsEntity",
      label: "Fed",
      scopeId: "s1",
    });
    expect(result?.nodeId).toBe("news:entity:fed:2");
  });

  test("rejects empty label and wrong domain kind", () => {
    expect(
      addGraphNode(NEWS_SAMPLE, {
        domain: "news",
        kind: "NewsEntity",
        label: "   ",
      }),
    ).toBeNull();
    expect(
      addGraphNode(NEWS_SAMPLE, {
        domain: "news",
        kind: "YtConcept",
        label: "Ok",
      }),
    ).toBeNull();
  });

  test("adds YouTube concept with video-scoped id", () => {
    const result = addGraphNode(YT_SAMPLE, {
      domain: "youtube",
      kind: "YtConcept",
      label: "JWT",
      scopeId: "vid12345678",
    });
    expect(result?.nodeId).toBe("concept:vid12345678:jwt:user");
    expect(result!.graph.nodes.at(-1)?.labels).toEqual(["YtConcept"]);
  });
});

describe("addGraphLink", () => {
  test("adds RELATED_TO between existing nodes", () => {
    const withExtra = addGraphNode(NEWS_SAMPLE, {
      domain: "news",
      kind: "NewsConcept",
      label: "Rates",
      scopeId: "s1",
    })!;
    const result = addGraphLink(withExtra.graph, {
      domain: "news",
      sourceId: "news:entity:fed",
      targetId: withExtra.nodeId,
      type: "RELATED_TO",
    });
    expect(result).toBeTruthy();
    expect(result!.graph.links).toHaveLength(NEWS_SAMPLE.links.length + 1);
    const link = result!.graph.links.at(-1);
    expect(link?.type).toBe("RELATED_TO");
    expect(link?.source).toBe("news:entity:fed");
    expect(link?.target).toBe(withExtra.nodeId);
    expect(link?.properties.userCreated).toBe(true);
  });

  test("rejects self-loop, missing ends, duplicate, and invalid type", () => {
    expect(
      addGraphLink(NEWS_SAMPLE, {
        domain: "news",
        sourceId: "news:entity:fed",
        targetId: "news:entity:fed",
      }),
    ).toBeNull();
    expect(
      addGraphLink(NEWS_SAMPLE, {
        domain: "news",
        sourceId: "news:entity:fed",
        targetId: "missing",
      }),
    ).toBeNull();
    expect(
      addGraphLink(NEWS_SAMPLE, {
        domain: "youtube",
        sourceId: "news:article:s1",
        targetId: "news:entity:fed",
        type: "SUPPORTS",
      }),
    ).toBeNull();

    const once = addGraphLink(NEWS_SAMPLE, {
      domain: "news",
      sourceId: "news:article:s1",
      targetId: "news:entity:fed",
      type: "RELATED_TO",
    })!;
    expect(
      addGraphLink(once.graph, {
        domain: "news",
        sourceId: "news:article:s1",
        targetId: "news:entity:fed",
        type: "RELATED_TO",
      }),
    ).toBeNull();
  });
});

describe("deleteGraphNode", () => {
  test("removes the node and incident links", () => {
    const next = deleteGraphNode(NEWS_SAMPLE, "news:entity:fed");
    expect(next).toBeTruthy();
    expect(next!.nodes.map((n) => n.id)).toEqual(["news:article:s1"]);
    expect(next!.links).toEqual([]);
  });

  test("leaves unrelated links intact", () => {
    const withExtra = addGraphNode(NEWS_SAMPLE, {
      domain: "news",
      kind: "NewsConcept",
      label: "Rates",
      scopeId: "s1",
    })!;
    const linked = addGraphLink(withExtra.graph, {
      domain: "news",
      sourceId: "news:article:s1",
      targetId: withExtra.nodeId,
      type: "RELATED_TO",
    })!;
    const next = deleteGraphNode(linked.graph, "news:entity:fed");
    expect(next!.nodes.map((n) => n.id).sort()).toEqual(
      ["news:article:s1", withExtra.nodeId].sort(),
    );
    expect(next!.links).toHaveLength(1);
    expect(next!.links[0]?.target).toBe(withExtra.nodeId);
  });

  test("returns null for missing or blank id", () => {
    expect(deleteGraphNode(NEWS_SAMPLE, "missing")).toBeNull();
    expect(deleteGraphNode(NEWS_SAMPLE, "   ")).toBeNull();
  });
});
