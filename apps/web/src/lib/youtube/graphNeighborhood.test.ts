import { describe, expect, test } from "bun:test";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  countLabels,
  countRelTypes,
  focusByProgress,
  focusByType,
  focusNeighborhood,
  nodeNounKey,
  nodeStartSec,
  normalizeNounKey,
} from "./graphNeighborhood";

function node(
  id: string,
  labels: string[] = ["YtGlossaryTerm"],
  display = id,
  props: Record<string, unknown> = {},
): GraphPayload["nodes"][number] {
  return {
    id,
    label: display,
    labels,
    properties: { id, name: display, ...props },
  };
}

function link(
  source: string,
  target: string,
  type = "RELATED_TO",
): GraphPayload["links"][number] {
  return {
    id: `${source}-${type}-${target}`,
    source,
    target,
    type,
    properties: {},
  };
}

/** A — B — C — D  (chain) plus A — E (star arm) */
const SAMPLE: GraphPayload = {
  nodes: [
    node("A"),
    node("B"),
    node("C"),
    node("D"),
    node("E"),
    node("orphan"),
  ],
  links: [
    link("A", "B"),
    link("B", "C"),
    link("C", "D"),
    link("A", "E"),
    link("A", "B", "USES_TERM"), // duplicate endpoints, different type — both kept
  ],
};

/** Video —HAS_CONCEPT→ Concept; Video —HAS_TERM→ Term; Concept —USES_TERM→ Term */
const TYPED: GraphPayload = {
  nodes: [
    node("v1", ["YtVideo"], "Video"),
    node("c1", ["YtConcept"], "Concept1"),
    node("c2", ["YtConcept"], "Concept2"),
    node("t1", ["YtGlossaryTerm"], "Term1"),
    node("t2", ["YtGlossaryTerm"], "Term2"),
    node("orphan", ["YtInsight"], "Insight"),
  ],
  links: [
    link("v1", "c1", "HAS_CONCEPT"),
    link("v1", "c2", "HAS_CONCEPT"),
    link("v1", "t1", "HAS_TERM"),
    link("v1", "t2", "HAS_TERM"),
    link("c1", "t1", "USES_TERM"),
  ],
};

describe("focusNeighborhood", () => {
  test("returns empty when seed missing", () => {
    expect(focusNeighborhood(SAMPLE, "missing", 1)).toEqual({ nodes: [], links: [] });
  });

  test("1-hop from A includes A, B, E only", () => {
    const g = focusNeighborhood(SAMPLE, "A", 1);
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids).toEqual(new Set(["A", "B", "E"]));
    expect(g.nodes.some((n) => n.id === "C" || n.id === "orphan")).toBe(false);
    expect(g.links.every((l) => ids.has(l.source) && ids.has(l.target))).toBe(true);
    expect(g.links.length).toBe(3); // A-B RELATED, A-B USES_TERM, A-E
  });

  test("2-hop from A reaches C but not D", () => {
    const g = focusNeighborhood(SAMPLE, "A", 2);
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has("C")).toBe(true);
    expect(ids.has("D")).toBe(false);
    expect(ids.has("E")).toBe(true);
  });

  test("1-hop from C includes B and D", () => {
    const g = focusNeighborhood(SAMPLE, "C", 1);
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(["B", "C", "D"]));
  });
});

describe("focusByType", () => {
  test("empty selection returns the same graph", () => {
    const g = focusByType(TYPED, { labels: new Set(), relTypes: new Set() });
    expect(g).toBe(TYPED);
  });

  test("label-only keeps matching nodes and links between them", () => {
    const g = focusByType(TYPED, {
      labels: new Set(["YtConcept"]),
      relTypes: new Set(),
    });
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(["c1", "c2"]));
    expect(g.links).toEqual([]);
  });

  test("label-only with video keeps concept edges from video", () => {
    const g = focusByType(TYPED, {
      labels: new Set(["YtVideo", "YtConcept"]),
      relTypes: new Set(),
    });
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(["v1", "c1", "c2"]));
    expect(g.links.map((l) => l.type).sort()).toEqual([
      "HAS_CONCEPT",
      "HAS_CONCEPT",
    ]);
  });

  test("rel-only keeps matching links and their endpoints", () => {
    const g = focusByType(TYPED, {
      labels: new Set(),
      relTypes: new Set(["USES_TERM"]),
    });
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(["c1", "t1"]));
    expect(g.links).toHaveLength(1);
    expect(g.links[0]?.type).toBe("USES_TERM");
  });

  test("combined filters nodes by label then links by type", () => {
    const g = focusByType(TYPED, {
      labels: new Set(["YtVideo", "YtGlossaryTerm"]),
      relTypes: new Set(["HAS_TERM"]),
    });
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(
      new Set(["v1", "t1", "t2"]),
    );
    expect(g.links.every((l) => l.type === "HAS_TERM")).toBe(true);
    expect(g.links).toHaveLength(2);
  });

  test("unknown label yields empty graph", () => {
    const g = focusByType(TYPED, {
      labels: new Set(["Missing"]),
      relTypes: new Set(),
    });
    expect(g.nodes).toEqual([]);
    expect(g.links).toEqual([]);
  });
});

describe("countLabels / countRelTypes", () => {
  test("counts labels including star total", () => {
    expect(countLabels(TYPED)).toEqual({
      "*": 6,
      YtVideo: 1,
      YtConcept: 2,
      YtGlossaryTerm: 2,
      YtInsight: 1,
    });
  });

  test("counts relationship types including star total", () => {
    expect(countRelTypes(TYPED)).toEqual({
      "*": 5,
      HAS_CONCEPT: 2,
      HAS_TERM: 2,
      USES_TERM: 1,
    });
  });
});

/** Timed concepts + terms; twin shares noun with c30; orphan is HAS_TERM-only */
const PROGRESS: GraphPayload = {
  nodes: [
    node("v1", ["YtVideo"], "Video"),
    node("c30", ["YtConcept"], "Early", { startSec: 30 }),
    node("c60", ["YtConcept"], "Later", { startSec: 60 }),
    node("tLinked", ["YtGlossaryTerm"], "LinkedTerm"),
    node("tTwin", ["YtGlossaryTerm"], "Early", { term: "Early" }),
    node("tOrphan", ["YtGlossaryTerm"], "OrphanTerm"),
    node("tRelatedOnly", ["YtGlossaryTerm"], "RelatedOnly"),
    node("insight", ["YtInsight"], "Insight"),
  ],
  links: [
    link("v1", "c30", "HAS_CONCEPT"),
    link("v1", "c60", "HAS_CONCEPT"),
    link("v1", "tLinked", "HAS_TERM"),
    link("v1", "tTwin", "HAS_TERM"),
    link("v1", "tOrphan", "HAS_TERM"),
    link("c60", "tLinked", "USES_TERM"),
    link("tLinked", "tRelatedOnly", "RELATED_TO"),
  ],
};

describe("nodeStartSec", () => {
  test("reads number and numeric string", () => {
    expect(nodeStartSec(node("a", ["YtConcept"], "A", { startSec: 42 }))).toBe(42);
    expect(
      nodeStartSec(node("b", ["YtConcept"], "B", { startSec: "90" })),
    ).toBe(90);
    expect(nodeStartSec(node("c", ["YtConcept"], "C"))).toBeNull();
  });
});

describe("focusByProgress", () => {
  test("always keeps the video node", () => {
    const g = focusByProgress(PROGRESS, 0);
    expect(g.nodes.map((n) => n.id)).toEqual(["v1"]);
    expect(g.links).toEqual([]);
  });

  test("concept at 60s is hidden at 30s and visible at 60s", () => {
    const early = focusByProgress(PROGRESS, 30);
    // First concept unlocks full glossary via HAS_TERM (+ RELATED_TO neighbor).
    expect(new Set(early.nodes.map((n) => n.id))).toEqual(
      new Set(["v1", "c30", "tTwin", "tLinked", "tOrphan", "tRelatedOnly"]),
    );
    expect(early.nodes.some((n) => n.id === "c60")).toBe(false);

    const at60 = focusByProgress(PROGRESS, 60);
    expect(new Set(at60.nodes.map((n) => n.id))).toEqual(
      new Set([
        "v1",
        "c30",
        "c60",
        "tLinked",
        "tTwin",
        "tOrphan",
        "tRelatedOnly",
      ]),
    );
  });

  test("USES_TERM edge appears when its concept unlocks", () => {
    const before = focusByProgress(PROGRESS, 45);
    expect(before.links.some((l) => l.type === "USES_TERM")).toBe(false);

    const after = focusByProgress(PROGRESS, 60);
    expect(after.nodes.some((n) => n.id === "tLinked")).toBe(true);
    expect(after.links.some((l) => l.type === "USES_TERM")).toBe(true);
  });

  test("same-noun glossary twin unlocks with its concept (no USES_TERM)", () => {
    const before = focusByProgress(PROGRESS, 0);
    expect(before.nodes.some((n) => n.id === "tTwin")).toBe(false);

    const after = focusByProgress(PROGRESS, 30);
    expect(after.nodes.some((n) => n.id === "tTwin")).toBe(true);
    expect(after.nodes.some((n) => n.id === "c30")).toBe(true);
    expect(
      after.links.some(
        (l) =>
          l.type === "USES_TERM" &&
          (l.source === "c30" || l.target === "tTwin"),
      ),
    ).toBe(false);
  });

  test("HAS_TERM glossary unlocks once any concept is unlocked", () => {
    const before = focusByProgress(PROGRESS, 0);
    expect(before.nodes.some((n) => n.id === "tOrphan")).toBe(false);

    const after = focusByProgress(PROGRESS, 30);
    expect(after.nodes.some((n) => n.id === "tOrphan")).toBe(true);
    expect(
      after.links.some(
        (l) =>
          l.type === "HAS_TERM" &&
          l.source === "v1" &&
          l.target === "tOrphan",
      ),
    ).toBe(true);
    expect(after.nodes.some((n) => n.id === "insight")).toBe(false);
  });

  test("RELATED_TO pulls in glossary neighbors without HAS_TERM", () => {
    const before = focusByProgress(PROGRESS, 0);
    expect(before.nodes.some((n) => n.id === "tRelatedOnly")).toBe(false);

    const after = focusByProgress(PROGRESS, 30);
    expect(after.nodes.some((n) => n.id === "tRelatedOnly")).toBe(true);
    expect(
      after.links.some(
        (l) =>
          l.type === "RELATED_TO" &&
          ((l.source === "tLinked" && l.target === "tRelatedOnly") ||
            (l.source === "tRelatedOnly" && l.target === "tLinked")),
      ),
    ).toBe(true);
  });

  test("RELATED_TO does not unlock future concepts early", () => {
    const g: GraphPayload = {
      nodes: [
        node("v1", ["YtVideo"], "Video"),
        node("c30", ["YtConcept"], "Early", { startSec: 30 }),
        node("c90", ["YtConcept"], "Future", { startSec: 90 }),
      ],
      links: [
        link("v1", "c30", "HAS_CONCEPT"),
        link("v1", "c90", "HAS_CONCEPT"),
        link("c30", "c90", "RELATED_TO"),
      ],
    };
    const at30 = focusByProgress(g, 30);
    expect(new Set(at30.nodes.map((n) => n.id))).toEqual(
      new Set(["v1", "c30"]),
    );
    expect(at30.links.some((l) => l.type === "RELATED_TO")).toBe(false);
  });

  test("accepts string startSec on concepts", () => {
    const g: GraphPayload = {
      nodes: [
        node("v1", ["YtVideo"], "Video"),
        node("c1", ["YtConcept"], "C", { startSec: "15" }),
      ],
      links: [link("v1", "c1", "HAS_CONCEPT")],
    };
    expect(focusByProgress(g, 14).nodes.map((n) => n.id)).toEqual(["v1"]);
    expect(new Set(focusByProgress(g, 15).nodes.map((n) => n.id))).toEqual(
      new Set(["v1", "c1"]),
    );
  });
});

describe("normalizeNounKey / nodeNounKey", () => {
  test("collapses case and punctuation", () => {
    expect(normalizeNounKey("Force Layout!")).toBe("force layout");
    expect(nodeNounKey(node("t1", ["YtGlossaryTerm"], "Force Layout"))).toBe(
      "force layout",
    );
  });
});
