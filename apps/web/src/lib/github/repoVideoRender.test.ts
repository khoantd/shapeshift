import { describe, expect, test } from "bun:test";
import { FPS, secondsToFrames } from "@/remotion/constants";

describe("secondsToFrames", () => {
  test("adds a short ~200ms tail", () => {
    expect(secondsToFrames(2)).toBe(Math.ceil(2 * FPS) + 6);
  });

  test("floors at 1 second of frames", () => {
    expect(secondsToFrames(0.1)).toBe(FPS);
  });

  test("handles non-finite input", () => {
    expect(secondsToFrames(Number.NaN)).toBe(FPS);
  });
});
