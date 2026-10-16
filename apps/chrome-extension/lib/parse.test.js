import { describe, expect, test } from "bun:test";
import {
  buildRelatedReposQuery,
  buildRelatedVideosQuery,
  parseGitHubRepoUrl,
  parsePageContext,
  parseYouTubeVideoUrl,
} from "./parse.js";

describe("parseGitHubRepoUrl", () => {
  test("parses owner/repo and nested paths", () => {
    expect(parseGitHubRepoUrl("https://github.com/vercel/next.js")?.fullName).toBe(
      "vercel/next.js",
    );
    expect(
      parseGitHubRepoUrl("https://github.com/vercel/next.js/tree/canary/docs")?.fullName,
    ).toBe("vercel/next.js");
  });

  test("rejects non-repo surfaces", () => {
    expect(parseGitHubRepoUrl("https://github.com/explore")).toBeNull();
    expect(parseGitHubRepoUrl("https://example.com/a/b")).toBeNull();
  });
});

describe("parseYouTubeVideoUrl", () => {
  test("parses watch, shorts, and youtu.be", () => {
    expect(
      parseYouTubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId,
    ).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      parseYouTubeVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.videoId,
    ).toBe("dQw4w9WgXcQ");
  });
});

describe("parsePageContext", () => {
  test("dispatches by host", () => {
    expect(parsePageContext("https://github.com/a/b")?.kind).toBe("github");
    expect(
      parsePageContext("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.kind,
    ).toBe("youtube");
  });
});

describe("related queries", () => {
  test("buildRelatedVideosQuery includes tutorial", () => {
    const q = buildRelatedVideosQuery({
      fullName: "vercel/next.js",
      name: "next.js",
      language: "TypeScript",
      topics: ["react"],
    });
    expect(q.toLowerCase()).toContain("next.js");
    expect(q.toLowerCase()).toContain("tutorial");
  });

  test("buildRelatedReposQuery strips noise", () => {
    const q = buildRelatedReposQuery({
      title: "Official Next.js Tutorial — Full Course Part 1",
      channelTitle: "Vercel",
    });
    expect(q.toLowerCase()).toContain("next");
    expect(q.toLowerCase()).not.toContain("official");
  });
});
