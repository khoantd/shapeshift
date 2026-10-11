/** Article / lesson page detection + deep-dive payload helpers. */

export const TITLE_MAX = 500;
export const EXCERPT_MAX = 4000;
export const URL_MAX = 2000;

const LEARNING_PATH_RE =
  /\/(lesson|lessons|course|courses|learn|learning|module|modules|lecture|lectures|tutorial|tutorials|unit|units|chapter|chapters|article|articles|post|posts|blog)\b/i;

const ARTICLE_OG_TYPES = new Set([
  "article",
  "news",
  "blog",
  "website.article",
]);

const ARTICLE_LD_TYPES = new Set([
  "article",
  "newsarticle",
  "blogposting",
  "reportage",
  "scholarlyarticle",
  "techarticle",
  "learningresource",
  "course",
  "coursesection",
]);

/**
 * Hosts where GitHub/YouTube lenses or Meanbox itself own the context.
 * @param {string} href
 */
export function isExcludedArticleUrl(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return true;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "github.com") return true;
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be"
  ) {
    return true;
  }
  if (host === "meanbox.vercel.app") return true;
  if (host === "localhost" || host === "127.0.0.1") {
    // Local Meanbox / Next — not a news article surface.
    return true;
  }
  return false;
}

/**
 * @param {string} s
 * @param {number} max
 */
function clip(s, max) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * @param {{
 *   pageUrl: string,
 *   title?: string,
 *   ogTitle?: string,
 *   ogType?: string,
 *   ogDescription?: string,
 *   metaDescription?: string,
 *   h1?: string,
 *   canonical?: string,
 *   jsonLdTypes?: string[],
 *   hasArticleEl?: boolean,
 *   selection?: string,
 *   articleText?: string,
 * }} fields
 * @returns {{
 *   kind: "article",
 *   title: string,
 *   excerpt: string,
 *   canonicalUrl: string,
 *   pageUrl: string,
 *   confidence: "high" | "low",
 *   variant: "article" | "lesson",
 * } | null}
 */
export function analyzePageFields(fields) {
  const pageUrl = clip(fields.pageUrl || "", URL_MAX);
  if (!pageUrl || isExcludedArticleUrl(pageUrl)) return null;

  let pathname = "/";
  try {
    pathname = new URL(pageUrl).pathname || "/";
  } catch {
    return null;
  }

  const ogType = String(fields.ogType || "")
    .trim()
    .toLowerCase()
    .split(/[\s;]/)[0];
  const ldTypes = (fields.jsonLdTypes || []).map((t) =>
    String(t || "")
      .trim()
      .toLowerCase(),
  );
  const hasLdArticle = ldTypes.some((t) => ARTICLE_LD_TYPES.has(t));
  const hasLearningLd = ldTypes.some((t) =>
    ["learningresource", "course", "coursesection"].includes(t),
  );
  const learningPath = LEARNING_PATH_RE.test(pathname);
  const strongOg = ARTICLE_OG_TYPES.has(ogType);
  const hasArticleEl = Boolean(fields.hasArticleEl);

  const title = clip(
    fields.ogTitle || fields.h1 || fields.title || "",
    TITLE_MAX,
  );
  const selection = clip(fields.selection || "", EXCERPT_MAX);
  const excerpt = clip(
    selection ||
      fields.ogDescription ||
      fields.metaDescription ||
      fields.articleText ||
      "",
    EXCERPT_MAX,
  );

  if (!title && !excerpt) return null;

  const high =
    strongOg || hasLdArticle || hasArticleEl || (learningPath && hasLearningLd);
  const soft =
    title.length >= 12 &&
    (excerpt.length >= 40 || learningPath || hasLearningLd);

  if (!high && !soft) return null;

  const variant =
    hasLearningLd || (learningPath && (high || soft)) ? "lesson" : "article";

  const canonicalRaw = clip(fields.canonical || pageUrl, URL_MAX);
  let canonicalUrl = pageUrl;
  try {
    canonicalUrl = new URL(canonicalRaw, pageUrl).href.slice(0, URL_MAX);
  } catch {
    canonicalUrl = pageUrl;
  }

  return {
    kind: "article",
    title: title || excerpt.slice(0, 120),
    excerpt: excerpt || title,
    canonicalUrl,
    pageUrl,
    confidence: high ? "high" : "low",
    variant,
  };
}

/**
 * @param {{
 *   title: string,
 *   excerpt: string,
 *   canonicalUrl: string,
 *   pageUrl: string,
 *   confidence: "high" | "low",
 *   variant: "article" | "lesson",
 * }} analyzed
 */
export function buildArticlePageContext(analyzed) {
  return {
    kind: "article",
    title: analyzed.title,
    excerpt: analyzed.excerpt,
    canonicalUrl: analyzed.canonicalUrl,
    pageUrl: analyzed.pageUrl,
    confidence: analyzed.confidence,
    variant: analyzed.variant,
  };
}

/**
 * Topic-only context (popup / omnibox / empty-state News).
 * @param {{ title?: string, excerpt?: string, canonicalUrl?: string }} opts
 */
export function syntheticArticleContext(opts = {}) {
  const title = clip(opts.title || "", TITLE_MAX);
  const excerpt = clip(opts.excerpt || title, EXCERPT_MAX);
  if (!title && !excerpt) return null;
  const canonicalUrl = clip(opts.canonicalUrl || "", URL_MAX);
  return {
    kind: "article",
    title: title || excerpt.slice(0, 120),
    excerpt: excerpt || title,
    canonicalUrl,
    pageUrl: canonicalUrl,
    confidence: "synthetic",
    variant: "article",
  };
}

/**
 * Runs in the page via scripting.executeScript (no imports — self-contained gather).
 * Returns raw fields for analyzePageFields in the extension context.
 */
export function gatherPageFieldsInTab() {
  const meta = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute("content") || "").trim() : "";
  };
  const absUrl = (raw) => {
    if (!raw) return "";
    try {
      return new URL(raw, location.href).href;
    } catch {
      return "";
    }
  };

  const jsonLdTypes = [];
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const data = JSON.parse(script.textContent || "null");
      const stack = Array.isArray(data) ? data.slice() : [data];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        const t = node["@type"];
        if (typeof t === "string") jsonLdTypes.push(t);
        else if (Array.isArray(t)) {
          for (const x of t) if (typeof x === "string") jsonLdTypes.push(x);
        }
        if (Array.isArray(node["@graph"])) stack.push(...node["@graph"]);
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }

  const articleEl = document.querySelector("article");
  let articleText = "";
  if (articleEl) {
    articleText = (articleEl.innerText || "").replace(/\s+/g, " ").trim();
    if (articleText.length > 4000) articleText = articleText.slice(0, 4000);
  }

  const h1 = (document.querySelector("h1")?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  const selection = (window.getSelection?.()?.toString() || "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    pageUrl: location.href,
    title: (document.title || "").replace(/\s+/g, " ").trim(),
    ogTitle: meta('meta[property="og:title"]'),
    ogType: meta('meta[property="og:type"]'),
    ogDescription: meta('meta[property="og:description"]'),
    metaDescription: meta('meta[name="description"]'),
    h1,
    canonical: absUrl(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
        "",
    ),
    jsonLdTypes,
    hasArticleEl: Boolean(articleEl),
    selection,
    articleText,
  };
}
