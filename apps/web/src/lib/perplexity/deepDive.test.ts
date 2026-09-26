import { describe, expect, test } from "bun:test";
import {
  buildDeepDivePrompt,
  deepDiveCacheKey,
  detectDeepDiveLanguage,
  extractDeepDiveSources,
  parseDeepDiveRequest,
} from "./deepDiveParse";

describe("parseDeepDiveRequest", () => {
  test("accepts title and excerpt", () => {
    const parsed = parseDeepDiveRequest({
      title: "  Hello  ",
      excerpt: " World ",
      canonicalUrl: " https://example.com/story ",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual({
      title: "Hello",
      excerpt: "World",
      canonicalUrl: "https://example.com/story",
    });
  });

  test("rejects empty body", () => {
    expect(parseDeepDiveRequest(null).ok).toBe(false);
    expect(parseDeepDiveRequest({ title: "", excerpt: "" }).ok).toBe(false);
  });

  test("accepts id and force", () => {
    const parsed = parseDeepDiveRequest({
      title: "T",
      excerpt: "E",
      id: "  abc-123  ",
      force: true,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.id).toBe("abc-123");
    expect(parsed.data.force).toBe(true);
  });
});

describe("extractDeepDiveSources", () => {
  test("dedupes search_results and annotations by url", () => {
    const sources = extractDeepDiveSources({
      output: [
        {
          type: "search_results",
          results: [
            { id: 1, title: "A", url: "https://a.example/1", snippet: "" },
            { id: 2, title: "B", url: "https://b.example/2", snippet: "" },
          ],
        },
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "Hello",
              annotations: [
                { type: "url_citation", title: "A again", url: "https://a.example/1" },
                { type: "url_citation", title: "C", url: "https://c.example/3" },
              ],
            },
          ],
        },
      ],
    });
    expect(sources.map((s) => s.url)).toEqual([
      "https://a.example/1",
      "https://b.example/2",
      "https://c.example/3",
    ]);
    expect(sources[0]?.title).toBe("A");
  });

  test("skips non-http urls", () => {
    expect(
      extractDeepDiveSources({
        output: [
          {
            type: "search_results",
            results: [{ id: 1, title: "Bad", url: "javascript:alert(1)", snippet: "" }],
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("detectDeepDiveLanguage", () => {
  test("detects Vietnamese from diacritics", () => {
    expect(
      detectDeepDiveLanguage({
        title: "Việt Nam thúc đẩy chuyển đổi số",
        excerpt: "Chính phủ công bố kế hoạch mới.",
      }),
    ).toBe("vi");
    expect(detectDeepDiveLanguage({ title: "Đồng USD tăng", excerpt: "" })).toBe("vi");
  });

  test("defaults to English for ASCII", () => {
    expect(
      detectDeepDiveLanguage({
        title: "Fed holds rates steady",
        excerpt: "Markets react calmly.",
      }),
    ).toBe("en");
  });
});

describe("buildDeepDivePrompt", () => {
  test("instructs Vietnamese for Vietnamese stories", () => {
    const prompt = buildDeepDivePrompt({
      title: "Việt Nam thúc đẩy chuyển đổi số",
      excerpt: "Chính phủ công bố kế hoạch mới.",
    });
    expect(prompt).toContain("tiếng Việt");
    expect(prompt).not.toContain("Respond in English.");
  });

  test("instructs English for English stories", () => {
    const prompt = buildDeepDivePrompt({
      title: "Fed holds rates steady",
      excerpt: "Markets react calmly.",
    });
    expect(prompt).toContain("Respond in English.");
    expect(prompt).not.toContain("tiếng Việt");
  });
});

describe("deepDiveCacheKey", () => {
  test("normalizes whitespace", () => {
    expect(deepDiveCacheKey({ title: "Hi", excerpt: "There", canonicalUrl: "https://x" })).toBe(
      deepDiveCacheKey({ title: "  Hi ", excerpt: "There\n", canonicalUrl: "https://x" }),
    );
  });

  test("includes language prefix", () => {
    const en = deepDiveCacheKey({ title: "Hello", excerpt: "World" });
    const vi = deepDiveCacheKey({ title: "Xin chào", excerpt: "Thế giới" });
    expect(en.startsWith("en|")).toBe(true);
    expect(vi.startsWith("vi|")).toBe(true);
  });
});
