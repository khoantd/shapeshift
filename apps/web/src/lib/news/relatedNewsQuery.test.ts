import { describe, expect, test } from "bun:test";
import {
  buildRelatedNewsFromRepoQuery,
  buildRelatedNewsFromVideoQuery,
  buildRelatedReposFromNewsQuery,
  buildRelatedVideosFromNewsQuery,
  newsBridgeHref,
} from "./relatedNewsQuery";

describe("buildRelatedNewsFromRepoQuery", () => {
  test("uses name and topics", () => {
    const q = buildRelatedNewsFromRepoQuery({
      fullName: "vercel/next.js",
      name: "next.js",
      language: "JavaScript",
      topics: ["react", "framework"],
    });
    expect(q).toContain("next.js");
    expect(q).toContain("react");
  });

  test("falls back to language when no topics", () => {
    const q = buildRelatedNewsFromRepoQuery({
      fullName: "rust-lang/rust",
      name: "rust",
      language: "Rust",
      topics: [],
    });
    expect(q).toContain("rust");
    expect(q).toContain("Rust");
  });
});

describe("buildRelatedNewsFromVideoQuery", () => {
  test("strips fluff and keeps tokens", () => {
    const q = buildRelatedNewsFromVideoQuery({
      title: "Next.js Full Course Tutorial 2024 — Learn React",
      topicLabel: "web",
    });
    expect(q.toLowerCase()).toContain("next.js");
    expect(q.toLowerCase()).not.toContain("tutorial");
    expect(q.toLowerCase()).toContain("web");
  });

  test("falls back to channel when title empty", () => {
    expect(
      buildRelatedNewsFromVideoQuery({ title: "", channelTitle: "Fireship" }),
    ).toBe("Fireship");
  });
});

describe("buildRelatedVideosFromNewsQuery", () => {
  test("includes title tokens and explained", () => {
    const q = buildRelatedVideosFromNewsQuery({
      title: "OpenAI launches new GPT model for developers",
      sourceDisplayName: "TechCrunch",
    });
    expect(q.toLowerCase()).toContain("openai");
    expect(q.toLowerCase()).toContain("explained");
  });

  test("falls back to source when title empty", () => {
    expect(
      buildRelatedVideosFromNewsQuery({
        title: "",
        sourceDisplayName: "The Verge",
      }),
    ).toContain("The Verge");
  });
});

describe("buildRelatedReposFromNewsQuery", () => {
  test("keeps meaningful tokens from headline", () => {
    const q = buildRelatedReposFromNewsQuery({
      title: "Rust 1.80 release notes: async improvements",
    });
    expect(q.toLowerCase()).toContain("rust");
    expect(q.toLowerCase()).not.toContain("release");
  });
});

describe("newsBridgeHref", () => {
  test("builds q and story params", () => {
    expect(newsBridgeHref({ q: "next.js", story: "abc-123" })).toBe(
      "/news?q=next.js&story=abc-123",
    );
  });

  test("omits empty params", () => {
    expect(newsBridgeHref({ q: "" })).toBe("/news");
  });
});
