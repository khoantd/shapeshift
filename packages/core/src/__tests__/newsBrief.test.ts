import { describe, expect, test } from "bun:test";
import { composeNewsBriefLine, mockBriefNewsStory } from "../jev/newsBrief";

describe("mockBriefNewsStory", () => {
  test("flags critical language as urgent + caution", () => {
    const r = mockBriefNewsStory({
      title: "Breaking: critical alert on grid risk",
      excerpt: "Operators warn of cascading outage.",
    });
    expect(r.source).toBe("mock");
    expect(r.urgency).toBeGreaterThanOrEqual(0.67);
    expect(r.tone).toBe("caution");
    expect(r.line).toContain("Urgent");
  });

  test("scores relevance from query tokens", () => {
    const r = mockBriefNewsStory({
      title: "Chipmakers expand AI capacity",
      excerpt: "New fabs for accelerators.",
      query: "AI chips",
    });
    expect(r.relevance).toBeGreaterThan(0.4);
    expect(r.line).toMatch(/relevant|General/i);
  });

  test("opportunity tone for breakthrough language", () => {
    const r = mockBriefNewsStory({
      title: "Startup breakthrough in battery density",
      excerpt: "Record growth in energy storage.",
    });
    expect(r.tone).toBe("opportunity");
  });
});

describe("composeNewsBriefLine", () => {
  test("joins labels", () => {
    expect(
      composeNewsBriefLine({ urgency: 0.9, relevance: 0.8, tone: "caution", query: "AI" }),
    ).toBe("Urgent · Highly relevant · Cautionary tone");
  });
});
