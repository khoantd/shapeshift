import { describe, expect, it } from "vitest";
import type { GraphPayload } from "@/lib/neo4j/types";
import type { HistoryPack } from "@/lib/youtube/historyPack";
import {
  HOME_TOPIC_CHIPS,
  pickContinuePack,
  pickMorePacks,
  pickTeaserGraphPack,
} from "./homeEmptyState";

function pack(
  overrides: Partial<HistoryPack> & Pick<HistoryPack, "id">,
): HistoryPack {
  return {
    videoId: "vid",
    videoUrl: "https://www.youtube.com/watch?v=vid",
    thumbnailUrl: "",
    videoTitle: "Title",
    channelTitle: null,
    contentType: null,
    conceptCount: 0,
    termCount: 0,
    markdown: "",
    transcript: null,
    graphPayload: null,
    createdAt: 0,
    ...overrides,
  };
}

const emptyGraph: GraphPayload = { nodes: [], links: [] };
const withNodes: GraphPayload = {
  nodes: [{ id: "n1", labels: ["YtConcept"], properties: { name: "A" }, label: "A" }],
  links: [],
};

describe("pickContinuePack", () => {
  it("returns null for empty list", () => {
    expect(pickContinuePack([])).toBeNull();
  });

  it("returns the first pack", () => {
    const a = pack({ id: "a" });
    const b = pack({ id: "b" });
    expect(pickContinuePack([a, b])).toBe(a);
  });
});

describe("pickTeaserGraphPack", () => {
  it("returns null when no pack has a graph", () => {
    expect(pickTeaserGraphPack([pack({ id: "a" })])).toBeNull();
  });

  it("prefers the continue pack when it has a graph", () => {
    const a = pack({ id: "a", graphPayload: withNodes });
    const b = pack({ id: "b", graphPayload: emptyGraph });
    expect(pickTeaserGraphPack([a, b])).toBe(a);
  });

  it("falls back to the first pack with a graphPayload", () => {
    const a = pack({ id: "a" });
    const b = pack({ id: "b", graphPayload: withNodes });
    expect(pickTeaserGraphPack([a, b])).toBe(b);
  });
});

describe("pickMorePacks", () => {
  it("returns empty when only one pack", () => {
    expect(pickMorePacks([pack({ id: "a" })])).toEqual([]);
  });

  it("skips the continue pack and respects limit", () => {
    const packs = [
      pack({ id: "a" }),
      pack({ id: "b" }),
      pack({ id: "c" }),
      pack({ id: "d" }),
      pack({ id: "e" }),
      pack({ id: "f" }),
    ];
    expect(pickMorePacks(packs, 4).map((p) => p.id)).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
  });
});

describe("HOME_TOPIC_CHIPS", () => {
  it("has several non-empty topics", () => {
    expect(HOME_TOPIC_CHIPS.length).toBeGreaterThanOrEqual(4);
    for (const topic of HOME_TOPIC_CHIPS) {
      expect(topic.trim().length).toBeGreaterThan(0);
    }
  });
});
