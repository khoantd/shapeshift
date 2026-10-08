import { describe, expect, test } from "bun:test";
import {
  durationSecondsFromAudioBytes,
  planChapterAudioResume,
} from "./repoVideoResume";

describe("durationSecondsFromAudioBytes", () => {
  test("estimates from byte length at ~128 kbps", () => {
    expect(durationSecondsFromAudioBytes(160_000)).toBe(10);
  });

  test("clamps to [1.2, 45]", () => {
    expect(durationSecondsFromAudioBytes(100)).toBe(1.2);
    expect(durationSecondsFromAudioBytes(1_000_000)).toBe(45);
  });
});

describe("planChapterAudioResume", () => {
  const chapters = [
    { title: "A", body: "one" },
    { title: "B", body: "two" },
    { title: "C", body: "three" },
  ];

  test("marks missing indices when none exist", () => {
    const plan = planChapterAudioResume({
      chapterCount: chapters.length,
      existingFlags: [false, false, false],
      force: false,
    });
    expect(plan.toNarrate).toEqual([0, 1, 2]);
    expect(plan.toReuse).toEqual([]);
  });

  test("reuses existing audio when not forcing", () => {
    const plan = planChapterAudioResume({
      chapterCount: 3,
      existingFlags: [true, false, true],
      force: false,
    });
    expect(plan.toReuse).toEqual([0, 2]);
    expect(plan.toNarrate).toEqual([1]);
  });

  test("force re-narrates every chapter", () => {
    const plan = planChapterAudioResume({
      chapterCount: 3,
      existingFlags: [true, true, true],
      force: true,
    });
    expect(plan.toReuse).toEqual([]);
    expect(plan.toNarrate).toEqual([0, 1, 2]);
  });
});
