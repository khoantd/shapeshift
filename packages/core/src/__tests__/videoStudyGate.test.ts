import { describe, expect, test } from "bun:test";
import {
  composeVideoStudyGateLine,
  mockVideoStudyGate,
  videoTextForStudyGate,
} from "../jev/videoStudyGate";

describe("mockVideoStudyGate", () => {
  test("detects short depth for Shorts-like titles", () => {
    const r = mockVideoStudyGate({
      title: "Quick tip: 60 second CSS trick #shorts",
      description: "A brief overview.",
    });
    expect(r.source).toBe("mock");
    expect(r.depth).toBe("short");
    expect(r.line).toContain("Short");
  });

  test("detects deep depth for long-form course language", () => {
    const r = mockVideoStudyGate({
      title: "Complete React course — full deep dive",
      description: "Comprehensive end-to-end curriculum covering advanced patterns.",
    });
    expect(r.depth).toBe("deep");
    expect(r.audience).toBe("advanced");
  });

  test("marks entertainment as not pack-suitable", () => {
    const r = mockVideoStudyGate({
      title: "Funny prank compilation",
      description: "Comedy reaction video.",
      topic: "entertainment",
    });
    expect(r.packSuitable).toBe(false);
    expect(r.line).toContain("Skip pack");
  });

  test("beginner audience from intro language", () => {
    const r = mockVideoStudyGate({
      title: "Intro to Python for absolute beginners",
      description: "No prior experience required.",
    });
    expect(r.audience).toBe("beginner");
    expect(r.packSuitable).toBe(true);
  });
});

describe("composeVideoStudyGateLine", () => {
  test("joins labels", () => {
    expect(
      composeVideoStudyGateLine({
        depth: "standard",
        audience: "intermediate",
        packSuitable: true,
      }),
    ).toBe("Standard · Intermediate · Pack ready");
  });
});

describe("videoTextForStudyGate", () => {
  test("includes topic when present", () => {
    const text = videoTextForStudyGate({
      title: "Lecture 1",
      description: "Body",
      topic: "lecture",
    });
    expect(text).toContain("Lecture 1");
    expect(text).toContain("Content type: lecture");
    expect(text).toContain("Body");
  });
});
