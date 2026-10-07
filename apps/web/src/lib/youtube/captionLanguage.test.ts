import { describe, expect, test } from "bun:test";
import {
  hasDominantArabicScript,
  isAcceptableTranscriptLanguage,
  languageMatchesPrefer,
  pickPreferredCaptionTrack,
} from "./captionLanguage";

describe("languageMatchesPrefer", () => {
  test("matches en prefix to en-US", () => {
    expect(languageMatchesPrefer("en-US", ["en", "vi"])).toBe(true);
    expect(languageMatchesPrefer("en", ["en-US"])).toBe(true);
  });

  test("rejects unrelated codes", () => {
    expect(languageMatchesPrefer("ar", ["en", "vi"])).toBe(false);
    expect(languageMatchesPrefer("ja", ["en"])).toBe(false);
  });
});

describe("pickPreferredCaptionTrack", () => {
  test("prefers en manual over ASR and over ar", () => {
    const picked = pickPreferredCaptionTrack(
      [
        { languageCode: "ar", kind: "asr" },
        { languageCode: "en", kind: "asr" },
        { languageCode: "en", kind: "standard" },
      ],
      ["en", "vi"],
    );
    expect(picked?.languageCode).toBe("en");
    expect(picked?.kind).toBe("standard");
  });

  test("does not fall back to Arabic when prefer is en/vi", () => {
    const picked = pickPreferredCaptionTrack(
      [
        { languageCode: "ar", kind: "asr" },
        { languageCode: "es", kind: "asr" },
      ],
      ["en", "vi"],
    );
    expect(picked).toBeNull();
  });

  test("allowAny falls back to first non-ASR", () => {
    const picked = pickPreferredCaptionTrack(
      [
        { languageCode: "ar", kind: "asr" },
        { languageCode: "ja", kind: "standard" },
      ],
      ["en"],
      { allowAny: true },
    );
    expect(picked?.languageCode).toBe("ja");
  });
});

describe("hasDominantArabicScript", () => {
  test("detects Arabic auto-translate transcripts", () => {
    const ar = `[00:13] دعونا نتحدث، أود قضاء بعض الوقت للحديث عن أنماط هندسة البرمجيات. أفضل وقت لطرح الأسئلة`;
    expect(hasDominantArabicScript(ar)).toBe(true);
  });

  test("accepts English", () => {
    expect(
      hasDominantArabicScript(
        "[00:13] Let's talk about software architecture patterns for a few minutes.",
      ),
    ).toBe(false);
  });
});

describe("isAcceptableTranscriptLanguage", () => {
  const prefer = ["en", "vi", "en-US", "en-GB"];

  test("rejects reported ar language", () => {
    expect(
      isAcceptableTranscriptLanguage({
        language: "ar",
        text: "Hello patterns",
        preferLangs: prefer,
      }),
    ).toBe(false);
  });

  test("rejects Arabic script even without language code", () => {
    const text =
      "[00:13] دعونا نتحدث، أود قضاء بعض الوقت للحديث عن أنماط هندسة البرمجيات. أفضل وقت لطرح الأسئلة أو التعليق";
    expect(
      isAcceptableTranscriptLanguage({
        language: null,
        text,
        preferLangs: prefer,
      }),
    ).toBe(false);
  });

  test("accepts English with en language", () => {
    expect(
      isAcceptableTranscriptLanguage({
        language: "en",
        text: "[0:00] Let's talk about patterns.",
        preferLangs: prefer,
      }),
    ).toBe(true);
  });
});
