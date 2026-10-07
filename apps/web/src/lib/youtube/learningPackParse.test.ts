import { describe, expect, test } from "bun:test";
import {
  buildLearningPackPrompt,
  learningPackCacheKey,
  parseLearningPackContentType,
  parseLearningPackRequest,
  resolvePackContentType,
} from "./learningPackParse";

const SAMPLE_TRANSCRIPT = `[0:00] Welcome to this lesson on TypeScript generics.
[0:45] A generic lets you write reusable type-safe functions.
[1:20] Here is an example with identity functions and constraints.
[2:00] Practice by typing a map helper yourself.
[2:30] Next we cover conditional types briefly.
`.repeat(3);

describe("parseLearningPackContentType", () => {
  test("maps legacy labels", () => {
    expect(parseLearningPackContentType("how-to")).toBe("tutorial");
    expect(parseLearningPackContentType("education")).toBe("lecture");
    expect(parseLearningPackContentType("news")).toBe("review");
  });

  test("accepts skill types", () => {
    expect(parseLearningPackContentType("tutorial")).toBe("tutorial");
    expect(parseLearningPackContentType("talk")).toBe("talk");
  });
});

describe("resolvePackContentType", () => {
  test("falls back to lecture for entertainment", () => {
    expect(resolvePackContentType("entertainment")).toBe("lecture");
    expect(resolvePackContentType("music")).toBe("lecture");
  });
});

describe("parseLearningPackRequest", () => {
  test("rejects short transcript", () => {
    const r = parseLearningPackRequest({
      videoId: "dQw4w9WgXcQ",
      title: "Demo",
      contentType: "lecture",
      transcript: "too short",
    });
    expect(r.ok).toBe(false);
  });

  test("accepts valid payload", () => {
    const r = parseLearningPackRequest({
      videoId: "dQw4w9WgXcQ",
      title: "Generics explained",
      channelTitle: "Acme",
      contentType: "lecture",
      transcript: SAMPLE_TRANSCRIPT,
      language: "en",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.contentType).toBe("lecture");
      expect(r.data.channelTitle).toBe("Acme");
      expect(r.data.language).toBe("en");
    }
  });
});

describe("buildLearningPackPrompt", () => {
  test("includes content-type emphasis and transcript", () => {
    const prompt = buildLearningPackPrompt({
      videoId: "dQw4w9WgXcQ",
      title: "How to set up Next.js",
      contentType: "tutorial",
      transcript: SAMPLE_TRANSCRIPT,
      language: "en",
    });
    expect(prompt).toContain("Content type: tutorial");
    expect(prompt).toContain("do this yourself");
    expect(prompt).toContain("TypeScript generics");
    expect(prompt).toContain("Output ONLY the Markdown");
    expect(prompt).toContain("**Revisit:** [mm:ss]");
    expect(prompt).toContain("Study depth: standard");
    expect(prompt).toContain("Audience: intermediate");
  });

  test("injects Jev depth and audience guidance", () => {
    const prompt = buildLearningPackPrompt({
      videoId: "dQw4w9WgXcQ",
      title: "Complete course",
      contentType: "lecture",
      transcript: SAMPLE_TRANSCRIPT,
      depth: "deep",
      audience: "advanced",
    });
    expect(prompt).toContain("Study depth: deep");
    expect(prompt).toContain("Audience: advanced");
    expect(prompt).toContain("multi-module");
    expect(prompt).toContain("experienced learners");
  });
});

describe("learningPackCacheKey", () => {
  test("stable for same input", () => {
    const input = {
      videoId: "dQw4w9WgXcQ",
      title: "T",
      contentType: "lecture" as const,
      transcript: SAMPLE_TRANSCRIPT,
      language: "en" as const,
    };
    expect(learningPackCacheKey(input)).toBe(learningPackCacheKey(input));
  });
});
