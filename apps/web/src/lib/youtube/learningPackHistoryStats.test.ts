import { describe, expect, test } from "bun:test";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  contentTypeLabel,
  summarizeLearningPackStats,
} from "./learningPackHistoryStats";

const SAMPLE_MD = `# Pack

## Key concepts

### Alpha idea
**Revisit:** [1:00]
Explanation.

### Beta idea
**Revisit:** [2:00]
More.

## Glossary

- **Force layout**: A graph layout algorithm
- **Node**: A vertex in the graph
`;

const GRAPH: GraphPayload = {
  nodes: [
    {
      id: "video:abc",
      label: "Video",
      labels: ["YtVideo"],
      properties: { contentType: "tutorial" },
    },
    {
      id: "c1",
      label: "Alpha",
      labels: ["YtConcept"],
      properties: {},
    },
    {
      id: "c2",
      label: "Beta",
      labels: ["YtConcept"],
      properties: {},
    },
    {
      id: "t1",
      label: "Force layout",
      labels: ["YtGlossaryTerm"],
      properties: {},
    },
  ],
  links: [],
};

describe("summarizeLearningPackStats", () => {
  test("counts from markdown when graph missing", () => {
    const s = summarizeLearningPackStats({ markdown: SAMPLE_MD });
    expect(s.conceptCount).toBe(2);
    expect(s.termCount).toBe(2);
    expect(s.contentType).toBeNull();
  });

  test("prefers graph counts and video contentType", () => {
    const s = summarizeLearningPackStats({
      markdown: SAMPLE_MD,
      graphPayload: GRAPH,
    });
    expect(s.conceptCount).toBe(2);
    expect(s.termCount).toBe(1);
    expect(s.contentType).toBe("tutorial");
  });

  test("stored contentType wins over graph", () => {
    const s = summarizeLearningPackStats({
      markdown: SAMPLE_MD,
      graphPayload: GRAPH,
      contentType: "lecture",
    });
    expect(s.contentType).toBe("lecture");
  });
});

describe("contentTypeLabel", () => {
  test("capitalizes", () => {
    expect(contentTypeLabel("tutorial")).toBe("Tutorial");
    expect(contentTypeLabel(null)).toBe("");
  });
});
