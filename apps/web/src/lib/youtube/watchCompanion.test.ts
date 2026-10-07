import { describe, expect, it } from "vitest";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  resolveWatchTldr,
  watchCompanionGraphStats,
  watchCompanionPhase,
} from "./watchCompanion";

const PACK_WITH_TLDR = `# How to Think Like an Architect

**Creator:** Developer Summit · **Duration:** 58:32

### TL;DR
You don't have to hold the title to think like an architect.
Architectural thinking is a skill anyone can practice.

## Key Concepts

### You don't need the title
- **Revisit:** [0:12]
`;

const PACK_NO_TLDR = `# Memory Internals

**Creator:** Example

Cache locality is the idea that recently used data is likely to be used again soon.

## Key Concepts

### Cache locality
- **Revisit:** [2:00]
`;

describe("watchCompanionPhase", () => {
  it("is empty when neither pack nor summary exists", () => {
    expect(watchCompanionPhase({ packText: null, summaryText: null })).toBe("empty");
    expect(watchCompanionPhase({ packText: "  ", summaryText: "" })).toBe("empty");
  });

  it("is ready when a pack or summary exists", () => {
    expect(watchCompanionPhase({ packText: "# Pack", summaryText: null })).toBe("ready");
    expect(watchCompanionPhase({ packText: null, summaryText: "Short blurb." })).toBe("ready");
  });
});

describe("resolveWatchTldr", () => {
  it("prefers the session summary over pack TL;DR", () => {
    expect(
      resolveWatchTldr({
        summaryText: "Session summary wins.",
        packMarkdown: PACK_WITH_TLDR,
      }),
    ).toBe("Session summary wins.");
  });

  it("strips markdown tags from summary text", () => {
    const raw =
      "## **TL;DR** Video giới thiệu năm mẫu kiến trúc. [5:13][5:19] ## **Key points** - **Layered architecture:** Chia hệ thống thành các lớp.";
    const out = resolveWatchTldr({
      summaryText: raw,
      packMarkdown: null,
      maxChars: 500,
    });
    expect(out).not.toBeNull();
    expect(out!).not.toMatch(/#{1,6}|\*\*|^\s*-\s/m);
    expect(out!).toContain("Video giới thiệu năm mẫu kiến trúc");
    expect(out!).not.toContain("Key points");
    expect(out!).not.toContain("Layered architecture");
  });

  it("strips bold and list markers from multiline summary", () => {
    const raw = `## TL;DR
**Layered** and *event-driven* patterns.

## Key points
- **Skip me:** noise
`;
    const out = resolveWatchTldr({ summaryText: raw, packMarkdown: null });
    expect(out).toBe("Layered and event-driven patterns.");
  });

  it("extracts the pack TL;DR section", () => {
    const tldr = resolveWatchTldr({
      summaryText: null,
      packMarkdown: PACK_WITH_TLDR,
    });
    expect(tldr).toContain("don't have to hold the title");
    expect(tldr).toContain("skill anyone can practice");
  });

  it("falls back to the first prose paragraph", () => {
    expect(
      resolveWatchTldr({
        summaryText: null,
        packMarkdown: PACK_NO_TLDR,
      }),
    ).toContain("Cache locality is the idea");
  });

  it("returns null when nothing usable exists", () => {
    expect(
      resolveWatchTldr({ summaryText: null, packMarkdown: null }),
    ).toBeNull();
    expect(
      resolveWatchTldr({ summaryText: "  ", packMarkdown: "# Title only\n" }),
    ).toBeNull();
  });

  it("clamps long text at a word boundary", () => {
    const long = "word ".repeat(120).trim();
    const out = resolveWatchTldr({
      summaryText: long,
      packMarkdown: null,
      maxChars: 40,
    });
    expect(out).not.toBeNull();
    expect(out!.endsWith("…")).toBe(true);
    expect(out!.length).toBeLessThanOrEqual(40);
  });
});

describe("watchCompanionGraphStats", () => {
  it("returns null with no pack and no graph", () => {
    expect(
      watchCompanionGraphStats({ packMarkdown: null, graphPayload: null }),
    ).toBeNull();
  });

  it("counts concepts from pack markdown", () => {
    expect(
      watchCompanionGraphStats({ packMarkdown: PACK_WITH_TLDR }),
    ).toEqual({ conceptCount: 1, termCount: 0 });
  });

  it("prefers graph payload node counts", () => {
    const graph: GraphPayload = {
      nodes: [
        { id: "c1", labels: ["YtConcept"], properties: {}, label: "A" },
        { id: "c2", labels: ["YtConcept"], properties: {}, label: "B" },
        { id: "t1", labels: ["YtGlossaryTerm"], properties: {}, label: "T" },
      ],
      links: [],
    };
    expect(
      watchCompanionGraphStats({
        packMarkdown: PACK_WITH_TLDR,
        graphPayload: graph,
      }),
    ).toEqual({ conceptCount: 2, termCount: 1 });
  });
});
