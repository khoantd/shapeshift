import { describe, expect, test } from "bun:test";
import { gitDiagramUrls, parseGitHubRepoUrl } from "./repoUrl";

describe("parseGitHubRepoUrl", () => {
  test("parses owner/repo shorthand", () => {
    expect(parseGitHubRepoUrl("vercel/next.js")).toEqual({
      owner: "vercel",
      name: "next.js",
      fullName: "vercel/next.js",
    });
  });

  test("parses https URLs with deep paths", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/facebook/react/tree/main/packages"),
    ).toEqual({
      owner: "facebook",
      name: "react",
      fullName: "facebook/react",
    });
  });

  test("strips .git and parses ssh", () => {
    expect(parseGitHubRepoUrl("git@github.com:rust-lang/rust.git")).toEqual({
      owner: "rust-lang",
      name: "rust",
      fullName: "rust-lang/rust",
    });
  });

  test("returns null for invalid input", () => {
    expect(parseGitHubRepoUrl(null)).toBeNull();
    expect(parseGitHubRepoUrl("")).toBeNull();
    expect(parseGitHubRepoUrl("not a repo")).toBeNull();
    expect(parseGitHubRepoUrl("https://gitlab.com/a/b")).toBeNull();
  });
});

describe("gitDiagramUrls", () => {
  test("builds diagram and video URLs", () => {
    expect(gitDiagramUrls("vercel/next.js")).toEqual({
      diagram: "https://gitdiagram.com/vercel/next.js",
      video: "https://gitdiagram.com/vercel/next.js/video",
    });
  });
});
