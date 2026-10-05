import { describe, expect, test } from "bun:test";
import { extractYouTubeVideoId, looksLikeYouTubeUrl, youtubeWatchUrl } from "./url";

describe("extractYouTubeVideoId", () => {
  test("parses watch URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=30")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("parses youtu.be short links", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("parses embed and shorts", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("accepts bare video id", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("rejects non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeVideoId("not a url")).toBeNull();
    expect(extractYouTubeVideoId("")).toBeNull();
  });
});

describe("looksLikeYouTubeUrl", () => {
  test("true for youtube hosts", () => {
    expect(looksLikeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  test("false for bare id alone", () => {
    expect(looksLikeYouTubeUrl("dQw4w9WgXcQ")).toBe(false);
  });
});

describe("youtubeWatchUrl", () => {
  test("builds canonical watch URL", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
});
