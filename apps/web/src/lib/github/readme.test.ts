import { describe, expect, test } from "bun:test";
import {
  README_MAX_CHARS,
  README_SUMMARY_INPUT_MAX,
  buildReadmeResult,
  parseRepoFullName,
  truncateReadmeForSummary,
  truncateReadmeMarkdown,
} from "./readme";

describe("parseRepoFullName", () => {
  test("parses owner/name", () => {
    expect(parseRepoFullName("acme/widget")).toEqual({
      ok: true,
      fullName: "acme/widget",
      owner: "acme",
      name: "widget",
    });
  });

  test("strips github URL", () => {
    const r = parseRepoFullName("https://github.com/foo/bar");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fullName).toBe("foo/bar");
  });

  test("rejects empty and invalid", () => {
    expect(parseRepoFullName("")).toMatchObject({ ok: false });
    expect(parseRepoFullName("not-a-repo")).toMatchObject({ ok: false });
    expect(parseRepoFullName(null)).toMatchObject({ ok: false });
  });
});

describe("truncateReadmeMarkdown", () => {
  test("leaves short content alone", () => {
    expect(truncateReadmeMarkdown("# Hi\n\nWorld")).toEqual({
      markdown: "# Hi\n\nWorld",
      truncated: false,
    });
  });

  test("truncates long content", () => {
    const long = "x".repeat(README_MAX_CHARS + 5_000);
    const r = truncateReadmeMarkdown(long);
    expect(r.truncated).toBe(true);
    expect(r.markdown.length).toBeLessThan(long.length);
    expect(r.markdown.startsWith("x".repeat(100))).toBe(true);
    expect(r.markdown).toContain("[README truncated");
  });
});

describe("truncateReadmeForSummary", () => {
  test("caps at summary input max", () => {
    const long = "y".repeat(README_SUMMARY_INPUT_MAX + 10);
    const out = truncateReadmeForSummary(long);
    expect(out.length).toBeLessThanOrEqual(README_SUMMARY_INPUT_MAX + 80);
    expect(out).toContain("[README truncated");
  });
});

describe("buildReadmeResult", () => {
  test("builds DTO", () => {
    const r = buildReadmeResult({
      fullName: "acme/widget",
      markdown: "# Widget\n",
      htmlUrl: "https://github.com/acme/widget#readme",
    });
    expect(r.fullName).toBe("acme/widget");
    expect(r.markdown).toBe("# Widget\n");
    expect(r.truncated).toBe(false);
    expect(r.htmlUrl).toContain("acme/widget");
    expect(r.fetchedAt).toBeGreaterThan(0);
  });
});
