import { describe, expect, test } from "bun:test";
import {
  collectNewsHighlightTerms,
  extractNewsHighlightSnippets,
  highlightNewsText,
  NEWS_CRITICAL_TERMS,
  normalizeHighlightTerms,
} from "./highlightNewsText";

describe("normalizeHighlightTerms", () => {
  test("dedupes case-insensitively and prefers longer phrases", () => {
    expect(normalizeHighlightTerms(["Risk", "risk", "must know", "must"])).toEqual([
      "must know",
      "Risk",
      "must",
    ]);
  });

  test("drops empties", () => {
    expect(normalizeHighlightTerms(["", "  ", "alert"])).toEqual(["alert"]);
  });
});

describe("collectNewsHighlightTerms", () => {
  test("includes query tokens plus critical terms", () => {
    const terms = collectNewsHighlightTerms("AirPods EQ");
    expect(terms.some((t) => t.toLowerCase() === "airpods")).toBe(true);
    expect(terms.some((t) => t.toLowerCase() === "critical")).toBe(true);
  });
});

describe("highlightNewsText", () => {
  test("returns plain string when no matches", () => {
    expect(highlightNewsText("hello world", ["critical"])).toBe("hello world");
  });

  test("wraps matches without HTML injection", () => {
    const node = highlightNewsText("Critical update on risk", ["critical", "risk"]);
    expect(node).not.toBeTypeOf("string");
    const json = JSON.stringify(node);
    expect(json).toContain("Critical");
    expect(json).toContain("risk");
    expect(json).not.toContain("<script");
  });
});

describe("extractNewsHighlightSnippets", () => {
  test("returns empty when no terms match", () => {
    expect(
      extractNewsHighlightSnippets(
        "AirPods cuối cùng cũng có EQ tuỳ chỉnh. Không có từ khóa.",
        ["critical", "urgent"],
      ),
    ).toEqual([]);
  });

  test("returns only the matching sentence among several", () => {
    const text =
      "Quiet opener with no hits. Breaking news about supplies. Another quiet closer.";
    expect(extractNewsHighlightSnippets(text, ["breaking"])).toEqual([
      "Breaking news about supplies.",
    ]);
  });

  test("matches query terms case-insensitively", () => {
    expect(
      extractNewsHighlightSnippets("New AirPods get custom EQ. Other sentence.", ["airpods"]),
    ).toEqual(["New AirPods get custom EQ."]);
  });

  test("matches critical terms without a query", () => {
    expect(
      extractNewsHighlightSnippets("Markets calm. Elevated risk in Asia. Done.", NEWS_CRITICAL_TERMS),
    ).toEqual(["Elevated risk in Asia."]);
  });

  test("returns the whole blob when it matches and has no separators", () => {
    expect(extractNewsHighlightSnippets("Critical update online", ["critical"])).toEqual([
      "Critical update online",
    ]);
  });
});
