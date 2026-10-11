import { describe, expect, test } from "bun:test";
import {
  TITLE_MAX,
  EXCERPT_MAX,
  analyzePageFields,
  isExcludedArticleUrl,
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
