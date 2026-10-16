import { describe, expect, test } from "bun:test";
import {
  cleanDescription,
  formatCount,
  formatIsoDuration,
  joinMeta,
} from "./ui.js";

describe("formatIsoDuration", () => {
  test("parses YouTube ISO durations", () => {
    expect(formatIsoDuration("PT17M37S")).toBe("17:37");
    expect(formatIsoDuration("PT1H2M3S")).toBe("1:02:03");
    expect(formatIsoDuration("PT45S")).toBe("0:45");
  });

  test("passes through clock strings and rejects junk", () => {
    expect(formatIsoDuration("12:34")).toBe("12:34");
    expect(formatIsoDuration("")).toBeNull();
    expect(formatIsoDuration("not-a-duration")).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("clamps long clean text", () => {
    const long = "a".repeat(200);
    expect(cleanDescription(long).endsWith("…")).toBe(true);
    expect(cleanDescription(long).length).toBe(120);
  });

  test("rejects scraped GitHub chrome", () => {
    expect(
      cleanDescription(
        "Skip to content Code Issues 80 Pull requests 35 Showing 501 changed files",
      ),
    ).toBe("");
  });

  test("keeps normal descriptions", () => {
    expect(cleanDescription("A tiny React state library.")).toBe(
      "A tiny React state library.",
    );
  });
});

describe("joinMeta", () => {
  test("skips empties", () => {
    expect(joinMeta("A", null, "", "B")).toBe("A · B");
  });
});

describe("formatCount", () => {
  test("formats thousands", () => {
    expect(formatCount(138200)).toBe("138.2k");
  });
});
