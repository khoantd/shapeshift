import { describe, expect, test } from "bun:test";
import {
  buildTranscriptSummaryPrompt,
  parseTranscriptSummaryRequest,
  transcriptSummaryCacheKey,
} from "./transcriptSummaryParse";

const SAMPLE_TRANSCRIPT = `[0:00] Welcome to this lesson on TypeScript generics.
[0:45] A generic lets you write reusable type-safe functions.
[1:20] Here is an example with identity functions and constraints.
[2:00] Practice by typing a map helper yourself.
[2:30] Next we cover conditional types briefly.
`.repeat(3);

describe("parseTranscriptSummaryRequest", () => {
  test("rejects short transcript", () => {
    const r = parseTranscriptSummaryRequest({
      videoId: "dQw4w9WgXcQ",
      title: "Demo",
      transcript: "too short",
    });
    expect(r.ok).toBe(false);
  });

  test("defaults language to vi", () => {
    const r = parseTranscriptSummaryRequest({
      videoId: "dQw4w9WgXcQ",
      title: "Generics explained",
      channelTitle: "Acme",
      transcript: SAMPLE_TRANSCRIPT,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.language).toBe("vi");
      expect(r.data.channelTitle).toBe("Acme");
    }
  });

  test("accepts en language", () => {
    const r = parseTranscriptSummaryRequest({
      videoId: "dQw4w9WgXcQ",
      title: "Generics explained",
      transcript: SAMPLE_TRANSCRIPT,
      language: "en",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.language).toBe("en");
    }
  });
});

describe("buildTranscriptSummaryPrompt", () => {
  test("requests Vietnamese summary by default", () => {
    const prompt = buildTranscriptSummaryPrompt({
      videoId: "dQw4w9WgXcQ",
      title: "How to set up Next.js",
      transcript: SAMPLE_TRANSCRIPT,
      language: "vi",
    });
    expect(prompt).toContain("Output language: Vietnamese");
    expect(prompt).toContain("Write the entire summary in Vietnamese");
    expect(prompt).toContain("TypeScript generics");
    expect(prompt).toContain("Output ONLY the Markdown summary");
  });

  test("requests English when language is en", () => {
    const prompt = buildTranscriptSummaryPrompt({
      videoId: "dQw4w9WgXcQ",
      title: "How to set up Next.js",
      transcript: SAMPLE_TRANSCRIPT,
      language: "en",
    });
    expect(prompt).toContain("Output language: English");
    expect(prompt).toContain("Write the entire summary in English");
  });
});

describe("transcriptSummaryCacheKey", () => {
  test("includes videoId and language", () => {
    const input = {
      videoId: "dQw4w9WgXcQ",
      title: "Demo",
      transcript: SAMPLE_TRANSCRIPT,
      language: "vi" as const,
    };
    const keyVi = transcriptSummaryCacheKey(input);
    const keyEn = transcriptSummaryCacheKey({ ...input, language: "en" });
    expect(keyVi).toContain("dQw4w9WgXcQ");
    expect(keyVi).toContain("vi");
    expect(keyEn).toContain("en");
    expect(keyVi).not.toBe(keyEn);
  });
});
