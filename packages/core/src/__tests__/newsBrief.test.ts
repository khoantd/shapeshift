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
    expect(r.worthDeepDive).toBe(true);
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
    expect(r.worthDeepDive).toBe(true);
  });

  test("marks graph-worthy stories with named entities", () => {
    const r = mockBriefNewsStory({
      title: "MB Bank and Vietcombank expand digital banking",
      excerpt: "CEO of ACB said regulators backed the plan.",
    });
    expect(r.worthGraph).toBe(true);
    expect(r.line).toContain("Graph");
  });
});

describe("composeNewsBriefLine", () => {
  test("joins labels", () => {
    expect(
      composeNewsBriefLine({
        urgency: 0.9,
        relevance: 0.8,
        tone: "caution",
        query: "AI",
        worthDeepDive: true,
        worthGraph: true,
      }),
    ).toBe("Urgent · Highly relevant · Cautionary tone · Deep dive · Graph");
  });

  test("joins Vietnamese labels", () => {
    expect(
      composeNewsBriefLine({
        urgency: 0.9,
        relevance: 0.8,
        tone: "caution",
        query: "AI",
        worthDeepDive: true,
        worthGraph: true,
        language: "vi",
      }),
    ).toBe("Khẩn cấp · Rất liên quan · Giọng thận trọng · Phân tích sâu · Đồ thị");
  });
});
