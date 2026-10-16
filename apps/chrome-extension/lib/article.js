/** Article / lesson page detection + deep-dive payload helpers. */

export const TITLE_MAX = 500;
export const EXCERPT_MAX = 4000;
export const URL_MAX = 2000;

/** CSS chrome removed before reading article/main text. */
export const ARTICLE_CHROME_SELECTOR =
  "script, style, noscript, nav, header, footer, aside, form, [aria-hidden='true'], [hidden]";

/**
 * Class/id tokens for in-article widgets (related stories, share, comments, ads).
 * Keep in sync with the copy nested inside gatherPageFieldsInTab.
 */
export const ARTICLE_NOISE_CLASS_RE =
  /\b(related|recommend(?:ed|ation)?s?|tin[\s_-]*lien[\s_-]*quan|box[\s_-]*categor(?:y|ies)?|see[\s_-]*also|more[\s_-]*stor(?:y|ies)|most[\s_-]*read|newsletter|social[\s_-]*share|share[\s_-]*(?:bar|box|buttons?)|binh[\s_-]*luan|comments?|comment[\s_-]*count|outbrain|taboola|promoted|promo[\s_-]*box|hot[\s_-]*news|doc[\s_-]*them|xem[\s_-]*them|read[\s_-]*more[\s_-]*box|widget[\s_-]*(?:related|recommend)|article[\s_-]*related)\b/i;

const LEARNING_PATH_RE =
  /\/(lesson|lessons|course|courses|learn|learning|module|modules|lecture|lectures|tutorial|tutorials|unit|units|chapter|chapters|article|articles|post|posts|blog)\b/i;

const CHROME_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
]);

const NOISE_ROLES = new Set([
  "navigation",
  "complementary",
  "banner",
  "contentinfo",
  "search",
]);

/**
 * Whether a node looks like chrome / related-news / promo (not article prose).
 * @param {{
 *   tagName?: string,
 *   id?: string,
 *   className?: string,
 *   role?: string,
 *   ariaHidden?: string,
 *   hidden?: boolean,
 * }} attrs
 */
export function looksLikeArticleNoise(attrs = {}) {
  const tag = String(attrs.tagName || "")
    .trim()
    .toLowerCase();
  if (CHROME_TAGS.has(tag)) return true;
  if (attrs.hidden || String(attrs.ariaHidden || "").toLowerCase() === "true") {
    return true;
  }
  const role = String(attrs.role || "")
    .trim()
    .toLowerCase();
  if (NOISE_ROLES.has(role)) return true;
  const hay = `${attrs.id || ""} ${attrs.className || ""}`;
  return ARTICLE_NOISE_CLASS_RE.test(hay);
}

/**
 * Remove chrome + related widgets from a cloned DOM subtree (in-page use).
 * @param {Element} root
 */
export function stripArticleNoise(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  for (const bad of Array.from(
    root.querySelectorAll(ARTICLE_CHROME_SELECTOR),
  )) {
    bad.remove();
  }
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (typeof el.isConnected === "boolean" && !el.isConnected) continue;
    const className =
      typeof el.className === "string"
        ? el.className
        : el.getAttribute?.("class") || "";
    if (
      looksLikeArticleNoise({
        tagName: el.tagName,
        id: el.id || "",
        className,
        role: el.getAttribute?.("role") || "",
        ariaHidden: el.getAttribute?.("aria-hidden") || "",
        hidden: Boolean(el.hasAttribute?.("hidden")),
      })
    ) {
      el.remove();
    }
  }
}

/**
 * @param {string} attrChunk
 * @param {string} name
 */
function readHtmlAttr(attrChunk, name) {
  const re = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const m = String(attrChunk || "").match(re);
  return m ? m[1] || m[2] || m[3] || "" : "";
}

/**
 * Stack-based HTML walker for unit tests (no DOM required).
 * Mirrors stripArticleNoise + innerText for fixtures.
 * @param {string} html
 */
export function extractCleanTextFromHtml(html) {
  const src = String(html || "");
  let text = "";
  let i = 0;
  /** @type {{ skip: boolean }[]} */
  const stack = [];

  while (i < src.length) {
    if (src[i] !== "<") {
      const next = src.indexOf("<", i);
      const chunk = next === -1 ? src.slice(i) : src.slice(i, next);
      const skipping = stack.length > 0 && stack[stack.length - 1].skip;
      if (!skipping) text += chunk;
      i = next === -1 ? src.length : next;
      continue;
    }

    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }

    const close = src.indexOf(">", i);
    if (close === -1) break;
    const raw = src.slice(i + 1, close).trim();
    i = close + 1;
    if (!raw || raw.startsWith("!") || raw.startsWith("?")) continue;

    const isClose = raw.startsWith("/");
    const body = isClose ? raw.slice(1).trim() : raw;
    const selfClosing = !isClose && /\/\s*$/.test(body);
    const tagMatch = body.match(/^([a-zA-Z][\w:-]*)/);
    if (!tagMatch) continue;
    const tagName = tagMatch[1].toLowerCase();
    const attrChunk = body.slice(tagMatch[0].length);

    if (isClose) {
      if (stack.length) stack.pop();
      continue;
    }

    const voidish =
      selfClosing ||
      /^(br|hr|img|meta|link|input|source|area|base|col|embed|wbr)$/i.test(
        tagName,
      );

    const parentSkip = stack.length > 0 && stack[stack.length - 1].skip;
    const noisy = looksLikeArticleNoise({
      tagName,
      id: readHtmlAttr(attrChunk, "id"),
      className: readHtmlAttr(attrChunk, "class"),
      role: readHtmlAttr(attrChunk, "role"),
      ariaHidden: readHtmlAttr(attrChunk, "aria-hidden"),
      hidden: /\bhidden\b/i.test(attrChunk),
    });
    if (!voidish) {
      stack.push({ skip: parentSkip || noisy });
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

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
 * Resolve canonical URL from fields + page URL.
 * @param {string} pageUrl
 * @param {string} [canonicalRaw]
 */
function resolveCanonical(pageUrl, canonicalRaw) {
  const raw = clip(canonicalRaw || pageUrl, URL_MAX);
  try {
    return new URL(raw, pageUrl).href.slice(0, URL_MAX);
  } catch {
    return pageUrl;
  }
}

/**
 * Excerpt priority: selection → mainText → articleText → og/meta.
 * @param {{
 *   selection?: string,
 *   mainText?: string,
 *   articleText?: string,
 *   ogDescription?: string,
 *   metaDescription?: string,
 * }} fields
 */
function resolveExcerpt(fields) {
  return clip(
    fields.selection ||
      fields.mainText ||
      fields.articleText ||
      fields.ogDescription ||
      fields.metaDescription ||
      "",
    EXCERPT_MAX,
  );
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
 *   mainText?: string,
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
  const excerpt = resolveExcerpt(fields);

  if (!title && !excerpt) return null;

  const high =
    strongOg || hasLdArticle || hasArticleEl || (learningPath && hasLearningLd);
  const soft =
    title.length >= 12 &&
    (excerpt.length >= 40 || learningPath || hasLearningLd);

  if (!high && !soft) return null;

  const variant =
    hasLearningLd || (learningPath && (high || soft)) ? "lesson" : "article";

  return {
    kind: "article",
    title: title || excerpt.slice(0, 120),
    excerpt: excerpt || title,
    canonicalUrl: resolveCanonical(pageUrl, fields.canonical),
    pageUrl,
    confidence: high ? "high" : "low",
    variant,
  };
}

/**
 * Forced deep-dive context when heuristics fail but title/body exist.
 * @param {{
 *   pageUrl?: string,
 *   title?: string,
 *   ogTitle?: string,
 *   h1?: string,
 *   selection?: string,
 *   mainText?: string,
 *   articleText?: string,
 *   ogDescription?: string,
 *   metaDescription?: string,
 *   canonical?: string,
 * }} fields
 * @returns {{
 *   kind: "article",
 *   title: string,
 *   excerpt: string,
 *   canonicalUrl: string,
 *   pageUrl: string,
 *   confidence: "synthetic",
 *   variant: "article",
 * } | null}
 */
export function buildForcedArticleContext(fields = {}) {
  const pageUrl = clip(fields.pageUrl || fields.canonical || "", URL_MAX);
  const title = clip(
    fields.ogTitle || fields.h1 || fields.title || "",
    TITLE_MAX,
  );
  const excerpt = resolveExcerpt(fields) || title;
  if (!title && !excerpt) return null;
  const canonicalUrl = resolveCanonical(
    pageUrl || clip(fields.canonical || "", URL_MAX),
    fields.canonical,
  );
  return {
    kind: "article",
    title: title || excerpt.slice(0, 120),
    excerpt: excerpt || title,
    canonicalUrl,
    pageUrl: pageUrl || canonicalUrl,
    confidence: "synthetic",
    variant: "article",
  };
}

/**
 * Merge active-tab article context with an optional topic query.
 * @param {any} ctx
 * @param {string} q
 * @returns {any | null}
 */
export function mergeArticleWithQuery(ctx, q) {
  const query = String(q || "").trim();
  if (!ctx || ctx.kind !== "article") {
    return query.length >= 2
      ? syntheticArticleContext({ title: query, excerpt: query })
      : null;
  }
  if (query.length < 2) return ctx;
  const excerpt = String(ctx.excerpt || "");
  const useQuery =
    !excerpt ||
    ctx.confidence === "synthetic" ||
    query.length > excerpt.length;
  if (!useQuery) return ctx;
  return {
    ...ctx,
    title: ctx.title || query,
    excerpt: query.length > excerpt.length ? query : excerpt || query,
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

  const clipText = (raw) => {
    let t = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (t.length > 4000) t = t.slice(0, 4000);
    return t;
  };

  // Self-contained noise strip (executeScript cannot import module helpers).
  // Keep patterns aligned with ARTICLE_NOISE_CLASS_RE / stripArticleNoise.
  const NOISE_CLASS_RE =
    /\b(related|recommend(?:ed|ation)?s?|tin[\s_-]*lien[\s_-]*quan|box[\s_-]*categor(?:y|ies)?|see[\s_-]*also|more[\s_-]*stor(?:y|ies)|most[\s_-]*read|newsletter|social[\s_-]*share|share[\s_-]*(?:bar|box|buttons?)|binh[\s_-]*luan|comments?|comment[\s_-]*count|outbrain|taboola|promoted|promo[\s_-]*box|hot[\s_-]*news|doc[\s_-]*them|xem[\s_-]*them|read[\s_-]*more[\s_-]*box|widget[\s_-]*(?:related|recommend)|article[\s_-]*related)\b/i;
  const CHROME_SEL =
    "script, style, noscript, nav, header, footer, aside, form, [aria-hidden='true'], [hidden]";
  const CHROME_TAG = new Set([
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
  ]);
  const NOISE_ROLE = new Set([
    "navigation",
    "complementary",
    "banner",
    "contentinfo",
    "search",
  ]);

  const isNoiseEl = (el) => {
    const tag = String(el.tagName || "")
      .trim()
      .toLowerCase();
    if (CHROME_TAG.has(tag)) return true;
    if (el.hasAttribute?.("hidden")) return true;
    if (
      String(el.getAttribute?.("aria-hidden") || "").toLowerCase() === "true"
    ) {
      return true;
    }
    const role = String(el.getAttribute?.("role") || "")
      .trim()
      .toLowerCase();
    if (NOISE_ROLE.has(role)) return true;
    const className =
      typeof el.className === "string"
        ? el.className
        : el.getAttribute?.("class") || "";
    return NOISE_CLASS_RE.test(`${el.id || ""} ${className}`);
  };

  const stripNoise = (root) => {
    for (const bad of Array.from(root.querySelectorAll(CHROME_SEL))) {
      bad.remove();
    }
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (typeof el.isConnected === "boolean" && !el.isConnected) continue;
      if (isNoiseEl(el)) el.remove();
    }
  };

  const textFromContentRoot = (el) => {
    try {
      const clone = el.cloneNode(true);
      stripNoise(clone);
      return clipText(clone.innerText || "");
    } catch {
      return clipText(el.innerText || "");
    }
  };

  /** Prefer main content; fall back to body with chrome stripped. */
  const collectMainText = () => {
    const selectors = [
      "article",
      '[role="main"]',
      "main",
      "#content",
      ".article-body",
      ".post-content",
      ".entry-content",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = textFromContentRoot(el);
      if (text.length >= 40) return text;
    }
    try {
      const clone = document.body?.cloneNode(true);
      if (!clone) return "";
      stripNoise(clone);
      return clipText(clone.innerText || "");
    } catch {
      return clipText(document.body?.innerText || "");
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
    articleText = textFromContentRoot(articleEl);
  }

  const mainText = collectMainText();

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
    mainText,
  };
}
