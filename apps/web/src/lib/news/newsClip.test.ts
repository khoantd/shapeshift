import { describe, expect, test } from "bun:test";
import {
  newsClipContentHash,
  normalizeCanonicalUrl,
  parseNewsClipRequest,
} from "./newsClip";

describe("parseNewsClipRequest", () => {
  test("accepts title and excerpt", () => {
    const parsed = parseNewsClipRequest({
      title: "Hello",
      excerpt: "World",
      canonicalUrl: "https://news.example.com/a",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.title).toBe("Hello");
      expect(parsed.data.canonicalUrl).toBe("https://news.example.com/a");
    }
  });

  test("rejects empty", () => {
    expect(parseNewsClipRequest(null).ok).toBe(false);
    expect(parseNewsClipRequest({ title: "", excerpt: "" }).ok).toBe(false);
  });
});

describe("newsClipContentHash", () => {
  test("stable for same URL ignoring tracking params", () => {
    const a = newsClipContentHash({
      canonicalUrl: "https://News.Example.com/a?utm_source=x",
      title: "T",
      excerpt: "E",
    });
    const b = newsClipContentHash({
      canonicalUrl: "https://news.example.com/a",
      title: "Other",
      excerpt: "Other",
    });
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  test("topic-only hashes differ by title/excerpt", () => {
    const a = newsClipContentHash({ title: "AI", excerpt: "chips" });
    const b = newsClipContentHash({ title: "AI", excerpt: "models" });
    expect(a).not.toBe(b);
  });
});

describe("normalizeCanonicalUrl", () => {
  test("strips hash and utm", () => {
    expect(
      normalizeCanonicalUrl("https://ex.com/a?utm_campaign=1&keep=1#frag"),
    ).toBe("https://ex.com/a?keep=1");
  });
});
