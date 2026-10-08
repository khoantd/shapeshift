import { describe, expect, test } from "bun:test";
import {
  buildRelatedReposQuery,
  githubBridgeHref,
} from "./relatedReposQuery";

describe("buildRelatedReposQuery", () => {
  test("strips tutorial fluff and keeps tokens", () => {
    const q = buildRelatedReposQuery({
      title: "Next.js Full Course Tutorial 2024 — Learn React",
      topicLabel: "web",
    });
    expect(q.toLowerCase()).toContain("next.js");
    expect(q.toLowerCase()).not.toContain("tutorial");
    expect(q.toLowerCase()).toContain("web");
  });

  test("falls back to channel when title empty", () => {
    expect(
      buildRelatedReposQuery({ title: "", channelTitle: "Fireship" }),
    ).toBe("Fireship");
  });
});

describe("githubBridgeHref", () => {
  test("builds q and repo params", () => {
    expect(githubBridgeHref({ q: "next.js", repo: "vercel/next.js" })).toBe(
      "/github?q=next.js&repo=vercel%2Fnext.js",
    );
  });
});
