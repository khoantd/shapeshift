import { describe, expect, test } from "bun:test";
import {
  buildDeepDivePrompt,
  deepDiveCacheKey,
  deepDiveSourcesIncomplete,
  detectDeepDiveLanguage,
  extractDeepDiveSources,
  parseDeepDiveRequest,
  resolveDeepDiveLanguage,
  resolveStoredDeepDiveLanguage,
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
      language: "vi",
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
    expect(parsed.data.language).toBe("vi");
  });

  test("accepts language and defaults invalid to vi", () => {
    const en = parseDeepDiveRequest({ title: "T", excerpt: "E", language: "en" });
    expect(en.ok).toBe(true);
    if (en.ok) expect(en.data.language).toBe("en");

    const bad = parseDeepDiveRequest({ title: "T", excerpt: "E", language: "fr" });
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.data.language).toBe("vi");
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
    expect(sources[0]).toEqual({ id: 1, title: "A", url: "https://a.example/1" });
    expect(sources[1]).toEqual({ id: 2, title: "B", url: "https://b.example/2" });
    expect(sources[2]).toEqual({ title: "C", url: "https://c.example/3" });
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

  test("preserves search result ids for [web:N] resolution", () => {
    const sources = extractDeepDiveSources({
      output: [
        {
          type: "search_results",
          results: [
            { id: 0, title: "Zero", url: "https://z.example/0", snippet: "" },
            { id: 3, title: "Three", url: "https://t.example/3", snippet: "" },
          ],
        },
      ],
    });
    expect(sources).toEqual([
      { id: 0, title: "Zero", url: "https://z.example/0" },
      { id: 3, title: "Three", url: "https://t.example/3" },
    ]);
  });

  test("extracts fetch_url_results contents with positional page ids", () => {
    const sources = extractDeepDiveSources({
      output: [
        {
          type: "fetch_url_results",
          contents: [
            { title: "Page A", url: "https://a.example/p", snippet: "…" },
            { title: "Page B", url: "https://b.example/p", snippet: "…" },
          ],
        },
      ],
    });
    expect(sources).toEqual([
      { id: 0, title: "Page A", url: "https://a.example/p" },
      { id: 1, title: "Page B", url: "https://b.example/p" },
    ]);
  });
});

describe("deepDiveSourcesIncomplete", () => {
  test("true when text has cite marks but sources empty", () => {
    expect(deepDiveSourcesIncomplete("Claim [web:0].", [])).toBe(true);
    expect(deepDiveSourcesIncomplete("Claim [page:1].", [])).toBe(true);
    expect(deepDiveSourcesIncomplete("Claim [web:0].", [{ title: "A", url: "https://a.test" }])).toBe(
      false,
    );
    expect(deepDiveSourcesIncomplete("No cites.", [])).toBe(false);
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

describe("resolveDeepDiveLanguage", () => {
  test("defaults to Vietnamese", () => {
    expect(resolveDeepDiveLanguage({})).toBe("vi");
    expect(resolveDeepDiveLanguage({ language: undefined })).toBe("vi");
  });

  test("honors explicit English", () => {
    expect(resolveDeepDiveLanguage({ language: "en" })).toBe("en");
  });
});

describe("resolveStoredDeepDiveLanguage", () => {
  test("uses stored language when present", () => {
    expect(resolveStoredDeepDiveLanguage({ language: "en", text: "Xin chào" })).toBe("en");
    expect(resolveStoredDeepDiveLanguage({ language: "vi", text: "Hello" })).toBe("vi");
  });

  test("infers from text when language missing", () => {
    expect(
      resolveStoredDeepDiveLanguage({ text: "Việt Nam thúc đẩy chuyển đổi số trong doanh nghiệp." }),
    ).toBe("vi");
    expect(resolveStoredDeepDiveLanguage({ text: "Markets react calmly to the rate decision." })).toBe(
      "en",
    );
  });
});

describe("buildDeepDivePrompt", () => {
  test("defaults to Vietnamese when language omitted", () => {
    const prompt = buildDeepDivePrompt({
      title: "Fed holds rates steady",
      excerpt: "Markets react calmly.",
    });
    expect(prompt).toContain("tiếng Việt");
    expect(prompt).not.toContain("Respond in English.");
  });

  test("explicit English overrides Vietnamese title", () => {
    const prompt = buildDeepDivePrompt({
      title: "Việt Nam thúc đẩy chuyển đổi số",
      excerpt: "Chính phủ công bố kế hoạch mới.",
      language: "en",
    });
    expect(prompt).toContain("Respond in English.");
    expect(prompt).not.toContain("tiếng Việt");
  });

  test("explicit Vietnamese for ASCII stories", () => {
    const prompt = buildDeepDivePrompt({
      title: "Fed holds rates steady",
      excerpt: "Markets react calmly.",
      language: "vi",
    });
    expect(prompt).toContain("tiếng Việt");
  });
});

describe("deepDiveCacheKey", () => {
  test("normalizes whitespace", () => {
    expect(deepDiveCacheKey({ title: "Hi", excerpt: "There", canonicalUrl: "https://x" })).toBe(
      deepDiveCacheKey({ title: "  Hi ", excerpt: "There\n", canonicalUrl: "https://x" }),
    );
  });

  test("includes language prefix and separates langs", () => {
    const sameStory = { title: "Hello", excerpt: "World" };
    const vi = deepDiveCacheKey(sameStory);
    const en = deepDiveCacheKey({ ...sameStory, language: "en" });
    expect(vi.startsWith("vi|")).toBe(true);
    expect(en.startsWith("en|")).toBe(true);
    expect(vi).not.toBe(en);
  });
});
