import { describe, expect, test } from "bun:test";
import { mapLibrarySegmentsToText } from "./captionFormat";

describe("mapLibrarySegmentsToText", () => {
  test("maps offset ms to [mm:ss] lines", () => {
    const text = mapLibrarySegmentsToText([
      { text: "Hello world", offset: 0 },
      { text: "Second line", offset: 65000 },
    ]);
    expect(text).toContain("[0:00] Hello world");
    expect(text).toContain("[1:05] Second line");
  });

  test("skips empty segments", () => {
    const text = mapLibrarySegmentsToText([
      { text: "  ", offset: 0 },
      { text: "Keep", offset: 1000 },
    ]);
    expect(text).toBe("[0:01] Keep");
  });
});
