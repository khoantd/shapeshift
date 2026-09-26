export const CITE_PROTOCOL = "shapeshift-cite://";

export type CiteSource = {
  title: string;
  url: string;
  /** Perplexity search/page result id used by `[web:N]` / `[page:N]`. */
  id?: number;
};

/** Match consecutive `[web:N]` / `[page:N]` clusters (Perplexity Agent cite marks). */
const CITE_CLUSTER = /(?:\[(?:web|page):(\d+)\])+/g;
const CITE_INDEX = /\[(?:web|page):(\d+)\]/g;

/** Rewrite consecutive `[web:N]` / `[page:N]` clusters into markdown cite links. */
export function encodeWebCitations(markdown: string): string {
  return markdown.replace(CITE_CLUSTER, (match) => {
    const indices: string[] = [];
    for (const m of match.matchAll(CITE_INDEX)) {
      indices.push(m[1]!);
    }
    if (indices.length === 0) return match;
    return `[sources](${CITE_PROTOCOL}${indices.join(",")})`;
  });
}

/** Parse `shapeshift-cite://2,1` → `[2, 1]` (allows 0-based indices). */
export function parseCiteHref(href: string | undefined | null): number[] | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith(CITE_PROTOCOL)) return null;
  const raw = trimmed.slice(CITE_PROTOCOL.length);
  if (!raw) return [];
  const indices: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n >= 0) indices.push(n);
  }
  return indices;
}

/**
 * Resolve citation indices against the sources list.
 * Prefer explicit `id` (Perplexity search/page result id, may be 0-based).
 * Fallback when ids are absent: try 1-based then 0-based array position.
 */
export function resolveCiteSources(
  indices: readonly number[],
  sources: readonly CiteSource[],
): CiteSource[] {
  const byId = new Map<number, CiteSource>();
  for (const src of sources) {
    if (typeof src.id === "number" && Number.isInteger(src.id)) {
      byId.set(src.id, src);
    }
  }
  const useIds = byId.size > 0;

  const seen = new Set<string>();
  const out: CiteSource[] = [];
  for (const index of indices) {
    const src = useIds
      ? byId.get(index)
      : (sources[index - 1] ?? sources[index]);
    if (!src?.url) continue;
    if (seen.has(src.url)) continue;
    seen.add(src.url);
    out.push(
      typeof src.id === "number"
        ? { id: src.id, title: src.title, url: src.url }
        : { title: src.title, url: src.url },
    );
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
