import { describe, expect, test } from "bun:test";
import { extractChapters, extractKeyPoints } from "./packMarkdown";

describe("extractKeyPoints", () => {
  test("reads bullets", () => {
    const md = "## Overview\n\n- Attention replaces recurrence\n- Self-attention weighs tokens\n";
    expect(extractKeyPoints(md)).toEqual([
      "Attention replaces recurrence",
      "Self-attention weighs tokens",
    ]);
  });
});

describe("extractChapters", () => {
  test("reads headings and timed lines", () => {
    const md = "## Introduction\n\n- 02:14 Why attention works\n";
    const ch = extractChapters(md);
    expect(ch[0]?.title).toBe("Introduction");
    expect(ch[1]?.time).toBe("02:14");
    expect(ch[1]?.title).toContain("attention");
  });
});
