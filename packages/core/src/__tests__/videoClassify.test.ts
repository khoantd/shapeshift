import { describe, expect, test } from "bun:test";
import {
  composeVideoClassifyLine,
  mockClassifyVideo,
  videoTextForClassify,
} from "../jev/videoClassify";

describe("mockClassifyVideo", () => {
  test("detects tutorial topic", () => {
    const r = mockClassifyVideo({
      title: "How to set up a Next.js app",
      description: "Step-by-step guide for beginners.",
    });
    expect(r.source).toBe("mock");
    expect(r.topic).toBe("tutorial");
    expect(r.flagged).toBe(false);
    expect(r.line).toContain("Tutorial");
    expect(r.line).toContain("OK");
  });

  test("detects music topic", () => {
    const r = mockClassifyVideo({
      title: "Artist – Song (Official Video)",
      description: "Music video premiere.",
    });
    expect(r.topic).toBe("music");
  });

  test("detects talk topic", () => {
    const r = mockClassifyVideo({
      title: "Podcast interview with the founder",
      description: "A fireside conversation about building products.",
    });
    expect(r.topic).toBe("talk");
  });

  test("detects documentary topic", () => {
    const r = mockClassifyVideo({
      title: "Case study: what happened at the plant",
      description: "A documentary investigation.",
    });
    expect(r.topic).toBe("documentary");
  });

  test("flags unsafe language", () => {
    const r = mockClassifyVideo({
      title: "Graphic violence compilation",
      description: "Contains gore and explicit material.",
    });
    expect(r.flagged).toBe(true);
    expect(r.needsModeration).toBeGreaterThanOrEqual(0.5);
    expect(r.line).toContain("Flag");
  });

  test("scores relevance from query tokens", () => {
    const r = mockClassifyVideo({
      title: "Deep learning for computer vision",
      description: "CNNs and transformers explained.",
      query: "deep learning",
    });
    expect(r.relevance).toBeGreaterThan(0.4);
  });

  test("urgency and caution for breaking review language", () => {
    const r = mockClassifyVideo({
      title: "Breaking: critical alert on grid risk",
      description: "Operators warn of cascading outage.",
    });
    expect(r.urgency).toBeGreaterThanOrEqual(0.67);
    expect(r.tone).toBe("caution");
    expect(r.topic).toBe("review");
  });
});

describe("composeVideoClassifyLine", () => {
  test("joins labels", () => {
    expect(
      composeVideoClassifyLine({
        topic: "lecture",
        flagged: false,
        urgency: 0.2,
        relevance: 0.8,
        tone: "neutral",
        query: "AI",
      }),
    ).toBe("Lecture · OK · Low urgency · Highly relevant · Neutral tone");
  });
});

describe("videoTextForClassify", () => {
  test("includes channel when present", () => {
    const text = videoTextForClassify({
      title: "Intro",
      description: "Body",
      channelTitle: "Acme",
    });
    expect(text).toContain("Intro");
    expect(text).toContain("Channel: Acme");
    expect(text).toContain("Body");
  });
});
