import { describe, expect, test } from "bun:test";
import {
  videoAudioObjectKey,
  videoContentHash,
  videoObjectKey,
} from "../github/repoVideoParse";

describe("minio object key layout", () => {
  test("keeps owner/repo segments and language", () => {
    const hash = videoContentHash({
      fullName: "ahmedkhaleel2004/gitdiagram",
      language: "en",
      chapters: [
        { title: "A", body: "one" },
        { title: "B", body: "two" },
      ],
    });
    expect(videoObjectKey({
      fullName: "ahmedkhaleel2004/gitdiagram",
      language: "en",
      contentHash: hash,
    })).toContain("github-videos/ahmedkhaleel2004/gitdiagram/en/");
    expect(videoAudioObjectKey({
      fullName: "ahmedkhaleel2004/gitdiagram",
      language: "vi",
      contentHash: hash,
      chapterIndex: 2,
    })).toBe(
      `github-videos/ahmedkhaleel2004/gitdiagram/vi/${hash}/audio/ch-2.mp3`,
    );
  });
});
