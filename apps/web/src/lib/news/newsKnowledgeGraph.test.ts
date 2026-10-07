import { describe, expect, test } from "bun:test";
import { newsToKnowledgeGraph } from "./newsKnowledgeGraph";

const DEEP_DIVE = `## Overview

**Interest rates** rose again this week as the **Federal Reserve** signaled caution.

Markets watched **bond yields** closely. Analysts cited **inflation** as the key risk.

## Key points

- **Monetary policy** remains restrictive
- **Equity markets** showed mixed reactions
`;

describe("newsToKnowledgeGraph", () => {
  test("builds article hub with concepts, entities, and sources", () => {
    const graph = newsToKnowledgeGraph({
      storyId: "story-abc",
      title: "Fed signals caution",
      canonicalUrl: "https://example.com/fed",
      deepDiveText: DEEP_DIVE,
      sources: [
        { title: "Reuters", url: "https://reuters.com/a" },
        { title: "Bloomberg", url: "https://bloomberg.com/b" },
      ],
      briefLine: "Rates stay high amid inflation risk",
    });

    const article = graph.nodes.find((n) => n.labels.includes("NewsArticle"));
    expect(article?.id).toBe("news:article:story-abc");
    expect(article?.properties.title).toBe("Fed signals caution");

    expect(graph.nodes.some((n) => n.labels.includes("NewsConcept"))).toBe(true);
    expect(graph.nodes.some((n) => n.labels.includes("NewsEntity"))).toBe(true);
    expect(graph.nodes.filter((n) => n.labels.includes("NewsSource")).length).toBe(2);

    expect(graph.links.some((l) => l.type === "HAS_CONCEPT")).toBe(true);
    expect(graph.links.some((l) => l.type === "MENTIONS")).toBe(true);
    expect(graph.links.some((l) => l.type === "CITES")).toBe(true);
  });

  test("assigns stable canonicalKey on entities for cross-article merge", () => {
    const graph = newsToKnowledgeGraph({
      storyId: "s1",
      title: "T",
      canonicalUrl: "https://example.com/t",
      deepDiveText: "The **Federal Reserve** cut rates.",
      sources: [],
    });
    const entity = graph.nodes.find((n) => n.labels.includes("NewsEntity"));
    expect(entity?.properties.canonicalKey).toBeTruthy();
    expect(typeof entity?.properties.canonicalKey).toBe("string");
  });

  test("handles empty deep dive with brief only", () => {
    const graph = newsToKnowledgeGraph({
      storyId: "s2",
      title: "Brief only",
      canonicalUrl: "https://example.com/b",
      deepDiveText: "",
      sources: [],
      briefLine: "Something urgent about **trade tariffs**",
    });
    expect(graph.nodes.some((n) => n.labels.includes("NewsArticle"))).toBe(true);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
  });

  test("splits comma/và bank lists into distinct NewsEntity nodes", () => {
    const graph = newsToKnowledgeGraph({
      storyId: "banks",
      title: "Bank list",
      canonicalUrl: "https://example.com/banks",
      deepDiveText: `## Overview

Các ngân hàng như **MB Bank, ACB, Vietcombank, PVcombank và Publicbank**.
`,
      sources: [],
    });
    const entities = graph.nodes
      .filter((n) => n.labels.includes("NewsEntity"))
      .map((n) => String(n.label).toLowerCase().replace(/,/g, "").trim());
    expect(entities).toContain("mb bank");
    expect(entities).toContain("acb");
    expect(entities).toContain("vietcombank");
    expect(entities).toContain("pvcombank");
    expect(entities).toContain("publicbank");
    expect(entities.every((e) => !/mb bank\s*acb/.test(e))).toBe(true);
  });
});
