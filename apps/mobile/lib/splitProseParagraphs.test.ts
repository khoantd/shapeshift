import { describe, expect, test } from "bun:test";
import { splitProseParagraphs } from "./splitProseParagraphs";

describe("splitProseParagraphs", () => {
  test("returns empty for blank", () => {
    expect(splitProseParagraphs("")).toEqual([]);
    expect(splitProseParagraphs("   ")).toEqual([]);
  });

  test("splits on blank lines", () => {
    expect(splitProseParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
  });

  test("keeps short single blocks intact", () => {
    expect(splitProseParagraphs("Short line.")).toEqual(["Short line."]);
  });
});
