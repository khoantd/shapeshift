import { describe, expect, test } from "bun:test";
import {
  TITLE_MAX,
  EXCERPT_MAX,
  analyzePageFields,
  buildForcedArticleContext,
  extractCleanTextFromHtml,
  isExcludedArticleUrl,
  looksLikeArticleNoise,
  mergeArticleWithQuery,
  syntheticArticleContext,
  buildArticlePageContext,
} from "./article.js";

describe("isExcludedArticleUrl", () => {
  test("skips GitHub, YouTube, Meanbox", () => {
    expect(isExcludedArticleUrl("https://github.com/foo/bar")).toBe(true);
    expect(isExcludedArticleUrl("https://www.youtube.com/watch?v=abcdefghijk")).toBe(
      true,
    );
    expect(isExcludedArticleUrl("https://meanbox.vercel.app/news")).toBe(true);
    expect(isExcludedArticleUrl("http://localhost:3000/gadgets")).toBe(true);
  });

  test("allows news and learning hosts", () => {
    expect(isExcludedArticleUrl("https://www.reuters.com/world/article")).toBe(
      false,
    );
    expect(isExcludedArticleUrl("https://www.coursera.org/learn/ml")).toBe(false);
  });
});

describe("analyzePageFields", () => {
  test("detects strong article via og:type", () => {
    const result = analyzePageFields({
      pageUrl: "https://news.example.com/story/1",
      title: "Markets rally on rate cut",
      ogTitle: "Markets rally on rate cut",
      ogType: "article",
      ogDescription: "Stocks jumped after the Fed decision.",
      metaDescription: "",
      h1: "Markets rally on rate cut",
      canonical: "https://news.example.com/story/1",
      jsonLdTypes: [],
      hasArticleEl: false,
      selection: "",
      articleText: "",
    });
    expect(result).not.toBeNull();
    expect(result.kind).toBe("article");
    expect(result.confidence).toBe("high");
    expect(result.variant).toBe("article");
    expect(result.title).toContain("Markets");
    expect(result.excerpt).toContain("Stocks jumped");
    expect(result.canonicalUrl).toBe("https://news.example.com/story/1");
  });

  test("detects lesson via path + LearningResource", () => {
    const result = analyzePageFields({
      pageUrl: "https://learn.example.com/course/js/lesson/1",
      title: "Closures in JavaScript",
      ogTitle: "",
      ogType: "",
      ogDescription: "",
      metaDescription: "Understand lexical scope and closures.",
      h1: "Closures in JavaScript",
      canonical: "https://learn.example.com/course/js/lesson/1",
      jsonLdTypes: ["LearningResource"],
      hasArticleEl: false,
      selection: "",
      articleText: "",
    });
    expect(result).not.toBeNull();
    expect(result.variant).toBe("lesson");
    expect(result.confidence).toBe("high");
  });

  test("soft match with title + description", () => {
    const result = analyzePageFields({
      pageUrl: "https://blog.example.com/post/hello",
      title: "Why TypeScript wins",
      ogTitle: "",
      ogType: "",
      ogDescription: "",
      metaDescription: "A practical case for gradual typing in large apps.",
      h1: "",
      canonical: "",
      jsonLdTypes: [],
      hasArticleEl: false,
      selection: "",
      articleText: "",
    });
    expect(result).not.toBeNull();
    expect(result.confidence).toBe("low");
  });

  test("returns null when too thin", () => {
    expect(
      analyzePageFields({
        pageUrl: "https://example.com/",
        title: "Home",
        ogTitle: "",
        ogType: "",
        ogDescription: "",
        metaDescription: "",
        h1: "",
        canonical: "",
        jsonLdTypes: [],
        hasArticleEl: false,
        selection: "",
        articleText: "",
      }),
    ).toBeNull();
  });

  test("prefers selection as excerpt", () => {
    const result = analyzePageFields({
      pageUrl: "https://news.example.com/a",
      title: "Headline",
      ogTitle: "Headline",
      ogType: "article",
      ogDescription: "Meta blurb here for the story.",
      metaDescription: "",
      h1: "Headline",
      canonical: "https://news.example.com/a",
      jsonLdTypes: [],
      hasArticleEl: true,
      selection: "Selected paragraph about policy changes.",
      articleText: "",
    });
    expect(result.excerpt).toBe("Selected paragraph about policy changes.");
  });

  test("prefers mainText over og description when no selection", () => {
    const result = analyzePageFields({
      pageUrl: "https://docs.example.com/guide",
      title: "Getting started with Meanbox",
      ogTitle: "Getting started with Meanbox",
      ogType: "article",
      ogDescription: "Short meta blurb only.",
      metaDescription: "",
      h1: "Getting started",
      canonical: "https://docs.example.com/guide",
      jsonLdTypes: [],
      hasArticleEl: false,
      selection: "",
      articleText: "",
      mainText:
        "Install the extension, grant host access, then open any page and tap Deep dive.",
    });
    expect(result.excerpt).toContain("Install the extension");
  });

  test("truncates title and excerpt", () => {
    const result = analyzePageFields({
      pageUrl: "https://news.example.com/a",
      title: "T".repeat(600),
      ogTitle: "",
      ogType: "article",
      ogDescription: "E".repeat(5000),
      metaDescription: "",
      h1: "",
      canonical: "https://news.example.com/a",
      jsonLdTypes: [],
      hasArticleEl: false,
      selection: "",
      articleText: "",
    });
    expect(result.title.length).toBe(TITLE_MAX);
    expect(result.excerpt.length).toBe(EXCERPT_MAX);
  });
});

describe("buildForcedArticleContext", () => {
  test("builds context from title + mainText without heuristics", () => {
    const ctx = buildForcedArticleContext({
      pageUrl: "https://docs.example.com/api",
      title: "API docs",
      mainText: "Authentication uses bearer tokens for all protected routes.",
      canonical: "https://docs.example.com/api",
    });
    expect(ctx).not.toBeNull();
    expect(ctx.kind).toBe("article");
    expect(ctx.confidence).toBe("synthetic");
    expect(ctx.title).toBe("API docs");
    expect(ctx.excerpt).toContain("bearer tokens");
    expect(ctx.canonicalUrl).toBe("https://docs.example.com/api");
  });

  test("returns null when no title or body", () => {
    expect(
      buildForcedArticleContext({
        pageUrl: "https://example.com/",
        title: "",
        mainText: "",
      }),
    ).toBeNull();
  });

  test("prefers selection over mainText", () => {
    const ctx = buildForcedArticleContext({
      pageUrl: "https://example.com/p",
      title: "Page",
      selection: "User highlighted this sentence.",
      mainText: "Full page body that should be ignored.",
    });
    expect(ctx.excerpt).toBe("User highlighted this sentence.");
  });
});

describe("mergeArticleWithQuery", () => {
  test("returns synthetic when no context and query present", () => {
    const ctx = mergeArticleWithQuery(null, "climate policy");
    expect(ctx.title).toBe("climate policy");
    expect(ctx.excerpt).toBe("climate policy");
    expect(ctx.confidence).toBe("synthetic");
  });

  test("returns null when no context and empty query", () => {
    expect(mergeArticleWithQuery(null, "")).toBeNull();
  });

  test("keeps page excerpt when longer than query", () => {
    const page = {
      kind: "article",
      title: "Page title",
      excerpt: "A long body excerpt from the open web page content here.",
      canonicalUrl: "https://ex.com/a",
      pageUrl: "https://ex.com/a",
      confidence: "high",
      variant: "article",
    };
    const merged = mergeArticleWithQuery(page, "topic");
    expect(merged.excerpt).toBe(page.excerpt);
    expect(merged.title).toBe("Page title");
  });

  test("uses query as excerpt when page excerpt is thin", () => {
    const page = {
      kind: "article",
      title: "Thin",
      excerpt: "Thin",
      canonicalUrl: "https://ex.com/a",
      pageUrl: "https://ex.com/a",
      confidence: "synthetic",
      variant: "article",
    };
    const merged = mergeArticleWithQuery(page, "a longer topic phrase for dive");
    expect(merged.excerpt).toBe("a longer topic phrase for dive");
  });
});

describe("syntheticArticleContext", () => {
  test("builds article context from topic query", () => {
    const ctx = syntheticArticleContext({ title: "AI chips", excerpt: "AI chips" });
    expect(ctx.kind).toBe("article");
    expect(ctx.title).toBe("AI chips");
    expect(ctx.excerpt).toBe("AI chips");
    expect(ctx.confidence).toBe("synthetic");
  });

  test("returns null without title or excerpt", () => {
    expect(syntheticArticleContext({ title: "", excerpt: "" })).toBeNull();
  });
});

describe("buildArticlePageContext", () => {
  test("maps analyze result", () => {
    const ctx = buildArticlePageContext({
      title: "Hello",
      excerpt: "World",
      canonicalUrl: "https://ex.com/a",
      pageUrl: "https://ex.com/a",
      confidence: "high",
      variant: "article",
    });
    expect(ctx).toEqual({
      kind: "article",
      title: "Hello",
      excerpt: "World",
      canonicalUrl: "https://ex.com/a",
      pageUrl: "https://ex.com/a",
      confidence: "high",
      variant: "article",
    });
  });
});

describe("looksLikeArticleNoise", () => {
  test("flags chrome tags and related class tokens", () => {
    expect(looksLikeArticleNoise({ tagName: "aside" })).toBe(true);
    expect(looksLikeArticleNoise({ tagName: "nav" })).toBe(true);
    expect(
      looksLikeArticleNoise({
        tagName: "div",
        className: "box-category related-news",
      }),
    ).toBe(true);
    expect(
      looksLikeArticleNoise({
        tagName: "div",
        className: "tin-lien-quan",
      }),
    ).toBe(true);
    expect(
      looksLikeArticleNoise({ tagName: "p", className: "Normal" }),
    ).toBe(false);
  });
});

describe("extractCleanTextFromHtml", () => {
  test("keeps article body and drops related news card", () => {
    const html = `
      <article>
        <p>Bill Gates đồng sáng lập Contrails.org để giúp hãng bay tránh vùng hình thành vệt ngưng tụ.</p>
        <p>Bảo Bảo (theo Thời báo Ấn Độ, Gates Notes)</p>
        <div class="box-category related-news">
          <a href="/bezos">
            Cam kết rót 10 tỷ USD cho khí hậu, tỷ phú Jeff Bezos thực tế đã chi bao nhiêu?
          </a>
          <p>Gần 7 năm trước, ông chủ Amazon cam kết chi 10 tỷ USD.</p>
          <span class="comment-count">16</span>
        </div>
      </article>
    `;
    const text = extractCleanTextFromHtml(html);
    expect(text).toContain("Contrails.org");
    expect(text).toContain("Bảo Bảo");
    expect(text).not.toContain("Jeff Bezos");
    expect(text).not.toContain("10 tỷ USD");
  });
});
