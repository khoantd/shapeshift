export const CITE_PROTOCOL = "shapeshift-cite://";

export type CiteSource = {
  title: string;
  url: string;
};

const WEB_CITE_CLUSTER = /(?:\[web:(\d+)\])+/g;
const WEB_CITE_INDEX = /\[web:(\d+)\]/g;

/** Rewrite consecutive `[web:N]` clusters into markdown cite links. */
export function encodeWebCitations(markdown: string): string {
  return markdown.replace(WEB_CITE_CLUSTER, (match) => {
    const indices: string[] = [];
    for (const m of match.matchAll(WEB_CITE_INDEX)) {
      indices.push(m[1]!);
    }
    if (indices.length === 0) return match;
    return `[sources](${CITE_PROTOCOL}${indices.join(",")})`;
  });
}

/** Parse `shapeshift-cite://2,1` → `[2, 1]`. */
export function parseCiteHref(href: string | undefined | null): number[] | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith(CITE_PROTOCOL)) return null;
  const raw = trimmed.slice(CITE_PROTOCOL.length);
  if (!raw) return [];
  const indices: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n >= 1) indices.push(n);
  }
  return indices;
}

/**
 * Resolve 1-based citation indices against the sources list.
 * Preserves citation order; skips missing indices; unique by URL.
 */
export function resolveCiteSources(
  indices: readonly number[],
  sources: readonly CiteSource[],
): CiteSource[] {
  const seen = new Set<string>();
  const out: CiteSource[] = [];
  for (const index of indices) {
    const src = sources[index - 1];
    if (!src?.url) continue;
    if (seen.has(src.url)) continue;
    seen.add(src.url);
    out.push({ title: src.title, url: src.url });
  }
  return out;
}

export function faviconUrlFor(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch {
    return null;
  }
}

export function sourcesLabel(count: number): string {
  return count === 1 ? "1 source" : `${count} sources`;
}
