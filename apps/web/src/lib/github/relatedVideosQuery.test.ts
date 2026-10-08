import { describe, expect, test } from "bun:test";
import {
  buildRelatedVideosQuery,
  youtubeBridgeHref,
} from "./relatedVideosQuery";

describe("buildRelatedVideosQuery", () => {
  test("includes name, topic, and tutorial", () => {
    const q = buildRelatedVideosQuery({
      fullName: "vercel/next.js",
      name: "next.js",
      language: "JavaScript",
      topics: ["react", "framework"],
    });
    expect(q).toContain("next.js");
    expect(q).toContain("react");
    expect(q).toContain("tutorial");
  });

  test("falls back to language when no topics", () => {
    const q = buildRelatedVideosQuery({
      fullName: "rust-lang/rust",
      name: "rust",
      language: "Rust",
      topics: [],
    });
    expect(q).toContain("Rust");
  });
});

describe("youtubeBridgeHref", () => {
  test("builds q and videoId params", () => {
    expect(
      youtubeBridgeHref({ q: "next.js tutorial", videoId: "dQw4w9WgXcQ" }),
    ).toBe("/youtube?q=next.js+tutorial&videoId=dQw4w9WgXcQ");
  });
});
