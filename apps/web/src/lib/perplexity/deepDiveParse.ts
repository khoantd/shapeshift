export type DeepDiveSource = {
  title: string;
  url: string;
};

export type DeepDiveRequest = {
  title: string;
  excerpt: string;
  canonicalUrl?: string;
  /** Inspired Canvas feed item id — required to persist / hydrate from DB */
  id?: string;
  /** When true, skip DB cache and regenerate via Perplexity */
  force?: boolean;
};

export type DeepDiveParseError = { ok: false; error: string };
export type DeepDiveParseOk = { ok: true; data: DeepDiveRequest };

const TITLE_MAX = 500;
const EXCERPT_MAX = 4000;
const URL_MAX = 2000;

export function parseDeepDiveRequest(body: unknown): DeepDiveParseOk | DeepDiveParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { title, excerpt, canonicalUrl? }" };
  }
  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, TITLE_MAX) : "";
  const excerpt = typeof raw.excerpt === "string" ? raw.excerpt.trim().slice(0, EXCERPT_MAX) : "";
  const canonicalUrlRaw =
    typeof raw.canonicalUrl === "string" ? raw.canonicalUrl.trim().slice(0, URL_MAX) : "";
  const canonicalUrl = canonicalUrlRaw || undefined;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 128) : undefined;
  const force = raw.force === true;

  if (!title && !excerpt) {
    return { ok: false, error: "title or excerpt required" };
  }

  return {
    ok: true,
    data: {
      title,
      excerpt,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(id ? { id } : {}),
      ...(force ? { force: true } : {}),
    },
  };
}

export type DeepDiveLanguage = "vi" | "en";

/**
 * Heuristic: Vietnamese news uses distinctive Latin letters (đ/ơ/ư and
 * Latin Extended Additional tone marks U+1EA0–U+1EF9). Plain ASCII → English.
 */
const VIETNAMESE_CHAR_RE =
  /[\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/;

export function detectDeepDiveLanguage(input: Pick<DeepDiveRequest, "title" | "excerpt">): DeepDiveLanguage {
  const text = `${input.title} ${input.excerpt}`;
  return VIETNAMESE_CHAR_RE.test(text) ? "vi" : "en";
}

export function deepDiveCacheKey(input: DeepDiveRequest): string {
  const lang = detectDeepDiveLanguage(input);
  const body = `${input.title}\n${input.excerpt}\n${input.canonicalUrl ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${lang}|${body}`;
}

/** Collect unique http(s) sources from an Agent response shape. */
export function extractDeepDiveSources(response: {
  output?: unknown;
  output_text?: string;
}): DeepDiveSource[] {
  const byUrl = new Map<string, DeepDiveSource>();

  const add = (title: string | undefined, url: string | undefined) => {
    const href = url?.trim();
    if (!href || !/^https?:\/\//i.test(href)) return;
    if (byUrl.has(href)) return;
    byUrl.set(href, { title: (title?.trim() || href).slice(0, 300), url: href });
  };

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "search_results" && Array.isArray(row.results)) {
      for (const r of row.results) {
        if (!r || typeof r !== "object") continue;
        const sr = r as Record<string, unknown>;
        add(typeof sr.title === "string" ? sr.title : undefined, typeof sr.url === "string" ? sr.url : undefined);
      }
    }
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        if (!part || typeof part !== "object") continue;
        const p = part as Record<string, unknown>;
        if (!Array.isArray(p.annotations)) continue;
        for (const ann of p.annotations) {
          if (!ann || typeof ann !== "object") continue;
          const a = ann as Record<string, unknown>;
          add(typeof a.title === "string" ? a.title : undefined, typeof a.url === "string" ? a.url : undefined);
        }
      }
    }
  }

  return [...byUrl.values()];
}

export function buildDeepDivePrompt(input: DeepDiveRequest): string {
  const lang = detectDeepDiveLanguage(input);
  const parts = [
    "Provide a concise deep dive on this news story for an executive reader.",
    "Respond in clean Markdown: short paragraphs, **bold** for key terms, bullet lists when helpful. Prefer 2–4 short sections. No HTML.",
    "Ground claims in current web sources. Explain context, why it matters, and notable caveats. Do not invent facts.",
  ];
  if (lang === "vi") {
    parts.push(
      "Write the entire deep dive in Vietnamese (tiếng Việt). Keep Markdown structure; do not translate proper nouns unnecessarily.",
    );
  } else {
    parts.push("Respond in English.");
  }
  if (input.title) parts.push(`Title: ${input.title}`);
  if (input.excerpt) parts.push(`Summary: ${input.excerpt}`);
  if (input.canonicalUrl) {
    parts.push(`Original article URL (fetch if helpful): ${input.canonicalUrl}`);
  }
  return parts.join("\n");
}
