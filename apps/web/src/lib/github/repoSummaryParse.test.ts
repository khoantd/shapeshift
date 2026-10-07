import { describe, expect, test } from "bun:test";
import {
  buildRepoSummaryPrompt,
  parseRepoSummaryRequest,
  repoSummaryCacheKey,
} from "./repoSummaryParse";

describe("parseRepoSummaryRequest", () => {
  test("parses repo + optional readme", () => {
    const r = parseRepoSummaryRequest({
      repo: "acme/widget",
      description: "A widget",
      readme: "# Widget\n\nDoes things.",
      language: "en",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fullName).toBe("acme/widget");
    expect(r.data.description).toBe("A widget");
    expect(r.data.readme).toContain("# Widget");
    expect(r.data.language).toBe("en");
  });

  test("allows missing readme for server fetch", () => {
    const r = parseRepoSummaryRequest({ repo: "foo/bar" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.readme).toBe("");
  });

  test("rejects invalid repo", () => {
    expect(parseRepoSummaryRequest({ repo: "nope" }).ok).toBe(false);
    expect(parseRepoSummaryRequest(null).ok).toBe(false);
  });
});

describe("repoSummaryCacheKey", () => {
  test("includes fullName and language", () => {
    const key = repoSummaryCacheKey({
      fullName: "a/b",
      description: null,
      readme: "hello world content here",
      language: "vi",
    });
    expect(key.startsWith("a/b::vi::")).toBe(true);
  });
});

describe("buildRepoSummaryPrompt", () => {
  test("includes repo and readme", () => {
    const prompt = buildRepoSummaryPrompt({
      fullName: "acme/widget",
      description: "Widgets",
      readme: "# Hi",
      language: "en",
    });
    expect(prompt).toContain("acme/widget");
    expect(prompt).toContain("# Hi");
    expect(prompt).toContain("English");
    expect(prompt).toContain("Output ONLY the Markdown summary");
  });

  test("vietnamese output language", () => {
    const prompt = buildRepoSummaryPrompt({
      fullName: "a/b",
      description: null,
      readme: "x",
      language: "vi",
    });
    expect(prompt).toContain("Vietnamese");
  });
});
