import { describe, expect, test } from "bun:test";
import {
  contentFingerprint,
  estimateSpeechDurationSeconds,
  parseRepoVideoRequest,
  VIDEO_PIPELINE_VERSION,
  videoAudioObjectKey,
  videoContentHash,
  videoObjectKey,
  videoPlaybackProxyPath,
} from "./repoVideoParse";

describe("contentFingerprint", () => {
  test("is stable for the same input", () => {
    expect(contentFingerprint(["a", "b"])).toBe(contentFingerprint(["a", "b"]));
  });

  test("changes when content changes", () => {
    expect(contentFingerprint(["a"])).not.toBe(contentFingerprint(["b"]));
  });
});

describe("videoContentHash / object keys", () => {
  const chapters = [
    { title: "What", body: "A tool for X." },
    { title: "Parts", body: "Core and apps." },
  ];

  test("includes pipeline version in hash", () => {
    expect(VIDEO_PIPELINE_VERSION).toBe("v2");
    const withVersion = contentFingerprint([
      VIDEO_PIPELINE_VERSION,
      "owner/repo",
      "en",
      "t",
      "b",
    ]);
    const without = contentFingerprint(["owner/repo", "en", "t", "b"]);
    expect(withVersion).not.toBe(without);
  });

  test("builds mp4 and audio keys", () => {
    const hash = videoContentHash({
      fullName: "vercel/next.js",
      language: "en",
      chapters,
    });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(
      videoObjectKey({
        fullName: "vercel/next.js",
        language: "en",
        contentHash: hash,
      }),
    ).toBe(`github-videos/vercel/next.js/en/${hash}.mp4`);
    expect(
      videoAudioObjectKey({
        fullName: "vercel/next.js",
        language: "en",
        contentHash: hash,
        chapterIndex: 0,
      }),
    ).toBe(`github-videos/vercel/next.js/en/${hash}/audio/ch-0.mp3`);
    expect(
      videoPlaybackProxyPath({
        fullName: "vercel/next.js",
        language: "en",
        contentHash: hash,
      }),
    ).toBe(
      `/api/github/video/file?repo=vercel%2Fnext.js&lang=en&hash=${hash}`,
    );
  });
});

describe("estimateSpeechDurationSeconds", () => {
  test("returns a floor for empty text", () => {
    expect(estimateSpeechDurationSeconds("")).toBe(1.5);
  });

  test("scales with length and caps", () => {
    expect(estimateSpeechDurationSeconds("Hello world")).toBeGreaterThanOrEqual(
      1.5,
    );
    expect(estimateSpeechDurationSeconds("x".repeat(1000))).toBe(45);
  });
});

describe("parseRepoVideoRequest", () => {
  test("parses owner/repo body", () => {
    const result = parseRepoVideoRequest({
      repo: "facebook/react",
      description: "UI lib",
      language: "vi",
      force: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fullName).toBe("facebook/react");
    expect(result.data.language).toBe("vi");
    expect(result.data.force).toBe(true);
  });

  test("rejects invalid body", () => {
    expect(parseRepoVideoRequest(null).ok).toBe(false);
    expect(parseRepoVideoRequest({}).ok).toBe(false);
  });
});
