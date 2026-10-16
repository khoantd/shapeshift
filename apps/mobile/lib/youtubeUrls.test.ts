import { describe, expect, test } from "bun:test";
import {
  YOUTUBE_EMBED_ORIGIN,
  youtubeEmbedHtml,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "./youtubeUrls";

describe("youtubeWatchUrl", () => {
  test("builds watch URL for a video id", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  test("returns empty for blank id", () => {
    expect(youtubeWatchUrl("")).toBe("");
    expect(youtubeWatchUrl("   ")).toBe("");
  });
});

describe("youtubeEmbedUrl", () => {
  test("builds embed URL with playsinline and origin", () => {
    expect(youtubeEmbedUrl("abc123")).toBe(
      `https://www.youtube.com/embed/abc123?playsinline=1&rel=0&origin=${encodeURIComponent(YOUTUBE_EMBED_ORIGIN)}`,
    );
  });

  test("returns empty for blank id", () => {
    expect(youtubeEmbedUrl("")).toBe("");
  });
});

describe("youtubeEmbedHtml", () => {
  test("includes iframe, referrer policy, and embed src", () => {
    const html = youtubeEmbedHtml("abc123");
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).toContain(youtubeEmbedUrl("abc123"));
    expect(html).toContain("<iframe");
  });

  test("returns empty for blank id", () => {
    expect(youtubeEmbedHtml("")).toBe("");
  });
});
