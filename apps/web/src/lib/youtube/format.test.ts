import { describe, expect, test } from "bun:test";
import { formatYouTubeDuration } from "./format";

describe("formatYouTubeDuration", () => {
  test("formats minutes and seconds", () => {
    expect(formatYouTubeDuration("PT3M5S")).toBe("3:05");
  });

  test("formats hours", () => {
    expect(formatYouTubeDuration("PT1H2M3S")).toBe("1:02:03");
  });

  test("returns null for empty", () => {
    expect(formatYouTubeDuration(undefined)).toBeNull();
    expect(formatYouTubeDuration("")).toBeNull();
  });
});
