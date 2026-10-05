import { describe, expect, test } from "bun:test";
import {
  activeConceptAt,
  extractKeyConcepts,
  parsePackTimestamp,
} from "./learningPackConcepts";

describe("parsePackTimestamp", () => {
  test("parses mm:ss", () => {
    expect(parsePackTimestamp("[0:05]")).toBe(5);
    expect(parsePackTimestamp("[1:23]")).toBe(83);
    expect(parsePackTimestamp("[12:00]")).toBe(720);
    expect(parsePackTimestamp("1:23")).toBe(83);
  });

  test("parses h:mm:ss", () => {
    expect(parsePackTimestamp("[1:02:03]")).toBe(3723);
  });

  test("rejects junk", () => {
    expect(parsePackTimestamp("[1:99]")).toBeNull();
    expect(parsePackTimestamp("[99]")).toBeNull();
  });

  test("parses range start from [mm:ss–mm:ss]", () => {
    expect(parsePackTimestamp("[1:01–2:05]")).toBe(61);
    expect(parsePackTimestamp("[2:20-7:40]")).toBe(140);
    expect(parsePackTimestamp("[1:01 — 2:05]")).toBe(61);
  });
});

const RANGE_PACK = `## 2. Key concepts

1. **Architectural thinking is a perspective, not a title.** Like different people seeing different things in the same clouds. **[1:01–2:05]**
2. **Architecture decisions are trade-offs.** A full event payload may avoid database lookups. **[2:20–7:40]**
3. **Business drivers should shape architectural characteristics.** Concerns such as user satisfaction. **[9:41–11:31]**
`;

const SAMPLE = `# Some Video

## Key concepts

### Memory hierarchy
- **In plain words:** Faster memory is smaller and closer to the CPU.
- **Why it matters:** Explains cache misses.
- **Revisit:** [0:45]

### Cache locality
- **In plain words:** Nearby data tends to be used together.
- **Revisit:** [2:10]

### Duplicate start
- **Revisit:** [2:10]

## Insights & takeaways

### Not a concept
- **Revisit:** [9:00]
`;

const BOLD_LIST = `## Key Concepts

1. **Architectural Thinking** — how to reason about structure. **Revisit:** [0:30]
2. **Trade-offs** ([1:15]): every choice costs something.
- **Soft skills** (2:00) matter for architects.
`;

const NUMBERED_SECTION = `## 2. Key concepts

### Architectural thinking
- **In plain words:** Seeing systems as interacting parts.
- **Why it matters:** Guides trade-off decisions.
- **Revisit:** [1:02]

### Soft skills for architects
- **Revisit:** [12:40]
`;

const TALK_PACK = `# How to Think Like an Architect — Mark Richards

**Creator:** Developer Summit · **Duration:** 58:32 · **Language:** English

### TL;DR
You don't have to hold the title to think like an architect.

## Key Concepts

### You don't need the title
- **In plain words:** Architectural thinking is a skill, not a job title.
- **Why it matters:** Empowers every developer.
- **Revisit:** [0:12]

### Why architectural thinking matters
- **In plain words:** Complex systems need holistic reasoning.
- **Revisit:** [3:45]

## Insights & takeaways

- Soft skills compound technical judgment.
`;

describe("extractKeyConcepts", () => {
  test("extracts timestamped H3 concepts under Key concepts", () => {
    const concepts = extractKeyConcepts(SAMPLE);
    expect(concepts.map((c) => c.title)).toEqual(["Memory hierarchy", "Cache locality"]);
    expect(concepts[0]!.startSec).toBe(45);
    expect(concepts[0]!.timestampLabel).toBe("[0:45]");
    expect(concepts[1]!.startSec).toBe(130);
  });

  test("extracts bold/list concept lines", () => {
    const concepts = extractKeyConcepts(BOLD_LIST);
    expect(concepts.length).toBeGreaterThanOrEqual(2);
    expect(concepts[0]!.title).toContain("Architectural Thinking");
    expect(concepts[0]!.startSec).toBe(30);
    expect(concepts.some((c) => c.startSec === 75)).toBe(true);
  });

  test("handles numbered Key concepts section heading", () => {
    const concepts = extractKeyConcepts(NUMBERED_SECTION);
    expect(concepts).toHaveLength(2);
    expect(concepts[0]!.title).toBe("Architectural thinking");
    expect(concepts[0]!.startSec).toBe(62);
    expect(concepts[1]!.startSec).toBe(760);
  });

  test("extracts from realistic talk pack", () => {
    const concepts = extractKeyConcepts(TALK_PACK);
    expect(concepts.length).toBe(2);
    expect(concepts[0]!.startSec).toBe(12);
    expect(concepts[0]!.title.toLowerCase()).toContain("title");
    expect(concepts[1]!.startSec).toBe(225);
  });

  test("extracts numbered bold concepts with en-dash ranges", () => {
    const concepts = extractKeyConcepts(RANGE_PACK);
    expect(concepts.length).toBe(3);
    expect(concepts[0]!.startSec).toBe(61);
    expect(concepts[0]!.timestampLabel).toBe("[1:01]");
    expect(concepts[0]!.title).toContain("Architectural thinking");
    expect(concepts[1]!.startSec).toBe(140);
    expect(concepts[2]!.startSec).toBe(581);
  });

  test("returns empty when no timestamps", () => {
    expect(
      extractKeyConcepts(`## Key concepts\n\n### Foo\n- No time here\n`),
    ).toEqual([]);
  });

  test("ignores concepts outside the section when section has timed items", () => {
    const concepts = extractKeyConcepts(SAMPLE);
    expect(concepts.find((c) => c.title === "Not a concept")).toBeUndefined();
  });
});

describe("activeConceptAt", () => {
  const concepts = extractKeyConcepts(SAMPLE);

  test("returns first concept before its start (upcoming)", () => {
    expect(activeConceptAt(concepts, 0)?.title).toBe("Memory hierarchy");
    expect(activeConceptAt(concepts, 44)?.title).toBe("Memory hierarchy");
  });

  test("picks latest start <= t", () => {
    expect(activeConceptAt(concepts, 45)?.title).toBe("Memory hierarchy");
    expect(activeConceptAt(concepts, 129)?.title).toBe("Memory hierarchy");
    expect(activeConceptAt(concepts, 130)?.title).toBe("Cache locality");
    expect(activeConceptAt(concepts, 999)?.title).toBe("Cache locality");
  });
});
