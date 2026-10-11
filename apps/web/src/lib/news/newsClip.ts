import { createHash } from "node:crypto";

const TITLE_MAX = 500;
const EXCERPT_MAX = 4000;
const URL_MAX = 2000;

export const BROWSER_CLIPS_SOURCE_NAME = "Browser clips";
export const BROWSER_CLIPS_SITE_URL = "https://meanbox.vercel.app/extension-clips";

export type NewsClipRequest = {
  title: string;
  excerpt: string;
  canonicalUrl?: string;
};

export type NewsClipParseOk = { ok: true; data: NewsClipRequest };
export type NewsClipParseError = { ok: false; error: string };

export function parseNewsClipRequest(body: unknown): NewsClipParseOk | NewsClipParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { title, excerpt, canonicalUrl? }" };
  }
  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, TITLE_MAX) : "";
  const excerpt = typeof raw.excerpt === "string" ? raw.excerpt.trim().slice(0, EXCERPT_MAX) : "";
  const canonicalUrlRaw =
    typeof raw.canonicalUrl === "string" ? raw.canonicalUrl.trim().slice(0, URL_MAX) : "";
  const canonicalUrl = canonicalUrlRaw || undefined;

  if (!title && !excerpt) {
    return { ok: false, error: "title or excerpt required" };
  }

  return {
    ok: true,
    data: {
      title: title || excerpt.slice(0, 120),
      excerpt: excerpt || title,
      ...(canonicalUrl ? { canonicalUrl } : {}),
    },
  };
}

/** Stable hash for upsert conflict key (source_id, content_hash). */
export function newsClipContentHash(input: {
  canonicalUrl?: string;
  title: string;
  excerpt: string;
}): string {
  const url = normalizeCanonicalUrl(input.canonicalUrl);
  const material = url || `topic:${input.title}\n${input.excerpt}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 64);
}

export function normalizeCanonicalUrl(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.hash = "";
    // Drop common tracking params
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid") {
        u.searchParams.delete(key);
      }
    }
    return u.href.slice(0, URL_MAX);
  } catch {
    return "";
  }
}

export function resolveClipSourceIdFromEnv(): string {
  return (process.env.INSPIRED_CANVAS_CLIP_SOURCE_ID ?? "").trim();
}
