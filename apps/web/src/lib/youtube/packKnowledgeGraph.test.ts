import { describe, expect, test } from "bun:test";
import {
  dedupeGraphPayload,
  extractBoldTerms,
  extractGlossary,
  extractInsights,
  extractNounKeyPhrases,
  isVerbPhrase,
  packToKnowledgeGraph,
  toNounPhrase,
} from "./packKnowledgeGraph";

const SAMPLE = `# Video Title

## Key concepts

1. **Architectural thinking is a perspective, not a title** — mindset over role.
   **Revisit:** [1:01]
2. **Force layout** — nodes settle via simulation.
   **Revisit:** [1:05]
3. **Node identity** — what makes a Node unique in the store.
   **Revisit:** [2:30–3:00]

## Glossary

- **Node**: An entity in the graph
- **Relationship**: A typed edge between nodes
- **Force layout**: Physics-based graph arrangement

## Insights & takeaways

- Graphs make **Relationship** edges visible at a glance
- Timestamps let learners jump back to the source of each **Node**

## Check your understanding

- **Explain:** Why layout matters
- **Recall:** What is a Node
`;

describe("toNounPhrase", () => {
  test("strips predicative sentences down to noun heads", () => {
    expect(toNounPhrase("Architectural thinking is a perspective, not a title")).toBe(
      "Architectural thinking",
    );
    expect(toNounPhrase("Force layout — nodes settle via simulation")).toBe("Force layout");
  });

  test("strips trailing label colons", () => {
    expect(toNounPhrase("Claim:")).toBe("Claim");
    expect(toNounPhrase("Content type:")).toBe("Content type");
    expect(toNounPhrase("Revisit：")).toBe("Revisit");
  });

  test("strips leading imperative verbs", () => {
    expect(toNounPhrase("Make tradeoffs early")).toBe("tradeoffs early");
    expect(toNounPhrase("Build systems that scale")).toBe("systems");
  });

  test("does not keep comma-joined entity lists as one phrase", () => {
    expect(toNounPhrase("MB Bank, ACB, Vietcombank, PVcombank và Publicbank.")).toBe(
      "MB Bank",
    );
  });

  test("keeps long Vietnamese organization titles intact", () => {
    expect(toNounPhrase("Ngân hàng Nhà nước Việt Nam")).toBe(
      "Ngân hàng Nhà nước Việt Nam",
    );
  });
});

describe("isVerbPhrase", () => {
  test("rejects verb-led and mid-verb fragments", () => {
    expect(isVerbPhrase("Make tradeoffs")).toBe(true);
    expect(isVerbPhrase("Build systems")).toBe(true);
    expect(isVerbPhrase("graphs make relationships")).toBe(true);
    expect(isVerbPhrase("let learners")).toBe(true);
  });

  test("allows noun phrases including gerund nouns", () => {
    expect(isVerbPhrase("Architectural thinking")).toBe(false);
    expect(isVerbPhrase("Force layout")).toBe(false);
    expect(isVerbPhrase("Node identity")).toBe(false);
    expect(isVerbPhrase("System design")).toBe(false);
  });
});

const BANK_LIST =
  "MB Bank, ACB, Vietcombank, PVcombank và Publicbank";

function expectBankEntities(phrases: string[]) {
  const norm = phrases.map((p) => p.toLowerCase().replace(/,/g, "").trim());
  expect(norm.some((p) => p === "mb bank")).toBe(true);
  expect(norm.some((p) => p === "acb")).toBe(true);
  expect(norm.some((p) => p === "vietcombank")).toBe(true);
  expect(norm.some((p) => p === "pvcombank")).toBe(true);
  expect(norm.some((p) => p === "publicbank")).toBe(true);
  expect(phrases.every((p) => !/mb bank,\s*acb/i.test(p))).toBe(true);
}

describe("extractNounKeyPhrases", () => {
  test("prefers bold terms over full sentences", () => {
    const phrases = extractNounKeyPhrases(
      "Graphs make **Relationship** edges visible at a glance",
    );
    expect(phrases.some((p) => /relationship/i.test(p))).toBe(true);
    expect(phrases.every((p) => p.split(/\s+/).length <= 6)).toBe(true);
  });

  test("does not turn bare insight sentences into terms", () => {
    expect(extractNounKeyPhrases("Timestamps let learners jump back to the source")).toEqual([]);
    expect(extractNounKeyPhrases("Build systems that scale")).toEqual([]);
  });

  test("splits plain comma/và bank lists into separate nouns", () => {
    expectBankEntities(
      extractNounKeyPhrases(`Các ngân hàng như ${BANK_LIST}.`),
    );
  });

  test("keeps full Vietnamese titles and names (not ASCII-boundary stubs)", () => {
    const phrases = extractNounKeyPhrases(
      "Phó Thủ tướng Trần Hồng Hà gặp Bộ Tài chính và Ngân hàng Nhà nước Việt Nam.",
    );
    expect(phrases).toContain("Phó Thủ tướng");
    expect(phrases).toContain("Trần Hồng Hà");
    expect(phrases).toContain("Bộ Tài chính");
    expect(phrases).toContain("Ngân hàng Nhà nước Việt Nam");
    expect(phrases.every((p) => p !== "Phó Th" && !/^Phó Th$/i.test(p))).toBe(
      true,
    );
    expect(phrases.every((p) => p !== "Bộ Tài")).toBe(true);
  });

  test("does not harvest English sentence fragments with one capital", () => {
    expect(extractNounKeyPhrases("Interest rates rose again this week")).toEqual(
      [],
    );
  });
});

const PACK_CHROME = `# Good Architects Think in Trade-offs

**Creator:** Developer Summit · **Duration:** 58:32 · **Content type:** talk · **Study depth:** standard

### Who this is for
Builders who want better judgment.

## Key concepts

1. **event-driven architecture trade-offs** — pick the right coupling.
   **Revisit:** [1:01]
   **Claim:** Extremes hide real costs.
   **Reasoning:** Context drives the choice.
   **Conclusion:** Prefer trade-offs over dogma.
   **Illustrations:** queue vs sync RPC.

## Check your understanding

- **Explain:** Why layout matters
- **Recall:** What is a Node
`;

describe("extractBoldTerms", () => {
  test("rejects quiz/instructional chrome", () => {
    const terms = extractBoldTerms(SAMPLE);
    expect(terms.every((t) => !/^(explain|recall|apply)$/i.test(t))).toBe(true);
  });

  test("rejects pack meta labels even when bold ends with a colon", () => {
    const terms = extractBoldTerms(PACK_CHROME);
    const banned =
      /^(claim|conclusion|content type|creator|duration|illustrations|reasoning|revisit|study depth|who this|explain|recall)(:)?$/i;
    expect(terms.every((t) => !banned.test(t))).toBe(true);
    expect(terms.every((t) => !/:$/.test(t))).toBe(true);
    expect(terms.some((t) => /event-driven architecture trade-offs/i.test(t))).toBe(
      true,
    );
  });

  test("splits bold comma/và bank lists into separate nouns", () => {
    expectBankEntities(extractBoldTerms(`Các ngân hàng như **${BANK_LIST}**.`));
  });
});

describe("extractGlossary", () => {
  test("parses bold glossary terms", () => {
    const g = extractGlossary(SAMPLE);
    expect(g.length).toBeGreaterThanOrEqual(2);
    expect(g.some((x) => x.term === "Node")).toBe(true);
  });
});

describe("extractInsights", () => {
  test("parses takeaway bullets", () => {
    const i = extractInsights(SAMPLE);
    expect(i.length).toBeGreaterThanOrEqual(2);
  });
});

describe("packToKnowledgeGraph", () => {
  test("centers on noun terms without twin concept/term clones", () => {
    const graph = packToKnowledgeGraph({
      videoId: "abcdefghijk",
      title: "Demo video",
      channelTitle: "Channel",
      contentType: "lecture",
      markdown: SAMPLE,
    });
    expect(graph.nodes.some((n) => n.labels.includes("YtVideo"))).toBe(true);

    const concepts = graph.nodes.filter((n) => n.labels.includes("YtConcept"));
    expect(concepts.length).toBeGreaterThanOrEqual(2);
    expect(
      concepts.some((n) => String(n.label).toLowerCase() === "architectural thinking"),
    ).toBe(true);

    // Concept nouns must not also exist as glossary clones unless in Glossary
    const glossaryTerms = new Set(
      extractGlossary(SAMPLE).map((g) => g.term.toLowerCase()),
    );
    for (const c of concepts) {
      const twins = graph.nodes.filter(
        (n) =>
          n.labels.includes("YtGlossaryTerm") &&
          String(n.label).toLowerCase() === String(c.label).toLowerCase(),
      );
      if (!glossaryTerms.has(String(c.label).toLowerCase())) {
        expect(twins.length).toBe(0);
      }
    }

    expect(graph.nodes.filter((n) => n.labels.includes("YtInsight")).length).toBe(0);
    expect(graph.links.every((l) => l.type !== "MENTIONS")).toBe(true);

    // At most one edge per (source, target, type)
    const triples = graph.links.map((l) => `${l.source}|${l.target}|${l.type}`);
    expect(new Set(triples).size).toBe(triples.length);

    expect(graph.links.some((l) => l.type === "HAS_CONCEPT")).toBe(true);
    expect(graph.links.some((l) => l.type === "HAS_TERM")).toBe(true);

    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("Force layout concept uses glossary Force layout via USES_TERM once", () => {
    const graph = packToKnowledgeGraph({
      videoId: "abcdefghijk",
      title: "Demo video",
      markdown: SAMPLE,
    });
    const concept = graph.nodes.find(
      (n) => n.labels.includes("YtConcept") && String(n.label).toLowerCase() === "force layout",
    );
    const term = graph.nodes.find(
      (n) =>
        n.labels.includes("YtGlossaryTerm") && String(n.label).toLowerCase() === "force layout",
    );
    // Both exist (glossary has Force layout) but no self USES_TERM between equal nouns
    expect(concept).toBeTruthy();
    expect(term).toBeTruthy();
    const selfUses = graph.links.filter(
      (l) =>
        l.type === "USES_TERM" &&
        ((l.source === concept!.id && l.target === term!.id) ||
          (l.source === term!.id && l.target === concept!.id)),
    );
    expect(selfUses.length).toBe(0);

    // Node identity concept should USES_TERM Node glossary once
    const nodeConcept = graph.nodes.find(
      (n) => n.labels.includes("YtConcept") && String(n.label).toLowerCase() === "node identity",
    );
    const nodeTerm = graph.nodes.find(
      (n) => n.labels.includes("YtGlossaryTerm") && String(n.label).toLowerCase() === "node",
    );
    expect(nodeConcept && nodeTerm).toBeTruthy();
    const uses = graph.links.filter(
      (l) =>
        l.type === "USES_TERM" && l.source === nodeConcept!.id && l.target === nodeTerm!.id,
    );
    expect(uses.length).toBe(1);
  });

  test("verb-led concept titles become noun remnants or are dropped", () => {
    const graph = packToKnowledgeGraph({
      videoId: "abcdefghijk",
      title: "Demo",
      markdown: `## Key concepts
1. **Make tradeoffs early** — decide under uncertainty
   **Revisit:** [0:30]
2. **Force layout** — physics
   **Revisit:** [1:00]
`,
    });
    const labels = graph.nodes
      .filter((n) => !n.labels.includes("YtVideo"))
      .map((n) => String(n.label).toLowerCase());
    expect(labels.some((l) => l.startsWith("make "))).toBe(false);
    expect(labels.some((l) => l === "force layout" || l.includes("tradeoff"))).toBe(true);
  });

  test("does not emit trailing-colon or pack-chrome term labels", () => {
    const graph = packToKnowledgeGraph({
      videoId: "abcdefghijk",
      title: "Demo video",
      markdown: PACK_CHROME,
    });
    const termLabels = graph.nodes
      .filter((n) => n.labels.includes("YtGlossaryTerm"))
      .map((n) => String(n.label));
    expect(termLabels.every((l) => !/:$/.test(l))).toBe(true);
    expect(
      termLabels.every(
        (l) =>
          !/^(claim|conclusion|content type|creator|duration|illustrations|reasoning|revisit|study depth|who this)$/i.test(
            l,
          ),
      ),
    ).toBe(true);
  });
});

describe("dedupeGraphPayload", () => {
  test("collapses duplicate node ids and same-type links", () => {
    const graph = dedupeGraphPayload({
      nodes: [
        {
          id: "a",
          label: "A",
          labels: ["YtConcept"],
          properties: { id: "a" },
        },
        {
          id: "a",
          label: "A copy",
          labels: ["YtConcept"],
          properties: { id: "a" },
        },
        {
          id: "b",
          label: "B",
          labels: ["YtGlossaryTerm"],
          properties: { id: "b" },
        },
      ],
      links: [
        { id: "1", source: "a", target: "b", type: "USES_TERM", properties: {} },
        { id: "2", source: "a", target: "b", type: "USES_TERM", properties: {} },
        { id: "3", source: "a", target: "b", type: "MENTIONS", properties: {} },
      ],
    });
    expect(graph.nodes.length).toBe(2);
    expect(graph.links.filter((l) => l.type === "USES_TERM").length).toBe(1);
    expect(graph.links.length).toBe(2);
  });
});
