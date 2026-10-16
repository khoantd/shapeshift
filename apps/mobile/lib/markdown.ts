/**
 * Lightweight markdown → AST for Meanbox mobile readers.
 * Covers deep-dive / learning-pack shapes: headings, lists, emphasis, links, [web:N] cites.
 */

export type MdInline =
  | { type: "text"; text: string }
  | { type: "bold"; children: MdInline[] }
  | { type: "italic"; children: MdInline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: MdInline[] }
  | { type: "cite"; indices: number[] };

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "bullet"; children: MdInline[] }
  | { type: "ordered"; index: number; children: MdInline[] }
  | { type: "blockquote"; children: MdInline[] }
  | { type: "hr" };

const HEADING = /^(#{1,4})\s+(.+)$/;
const BULLET = /^[-*+]\s+(.+)$/;
const ORDERED = /^(\d+)[.)]\s+(.+)$/;
const BLOCKQUOTE = /^>\s?(.*)$/;
const HR = /^(?:-{3,}|\*{3,}|_{3,})$/;

/** Inline token scanner: code, links, cites, bold, italic, plain. */
const INLINE =
  /(`+)([^`]+?)\1|\[([^\]]+)\]\(([^)]+)\)|(?:\[(?:web|page):(\d+)\])+|\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_/g;

const CITE_INDEX = /\[(?:web|page):(\d+)\]/g;

export function parseMarkdown(source: string): MdBlock[] {
  const normalized = String(source ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: MdBlock[] = [];
  let paraBuf: string[] = [];

  const flushParagraph = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join(" ").replace(/\s+/g, " ").trim();
    paraBuf = [];
    if (!text) return;
    blocks.push({ type: "paragraph", children: parseInline(text) });
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (HR.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "hr" });
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, heading[1]!.length) as 1 | 2 | 3 | 4;
      blocks.push({
        type: "heading",
        level,
        children: parseInline(heading[2]!.trim()),
      });
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: "bullet", children: parseInline(bullet[1]!.trim()) });
      continue;
    }

    const ordered = ORDERED.exec(trimmed);
    if (ordered) {
      flushParagraph();
      blocks.push({
        type: "ordered",
        index: Number.parseInt(ordered[1]!, 10) || 1,
        children: parseInline(ordered[2]!.trim()),
      });
      continue;
    }

    const quote = BLOCKQUOTE.exec(trimmed);
    if (quote) {
      flushParagraph();
      blocks.push({
        type: "blockquote",
        children: parseInline(quote[1]!.trim()),
      });
      continue;
    }

    paraBuf.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

export function parseInline(text: string): MdInline[] {
  const input = String(text ?? "");
  if (!input) return [];

  const out: MdInline[] = [];
  let last = 0;
  INLINE.lastIndex = 0;

  for (const match of input.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) {
      out.push({ type: "text", text: input.slice(last, index) });
    }

    if (match[2] != null) {
      out.push({ type: "code", text: match[2] });
    } else if (match[3] != null && match[4] != null) {
      out.push({
        type: "link",
        href: match[4].trim(),
        children: parseInline(match[3]),
      });
    } else if (match[5] != null || /\[(?:web|page):\d+\]/.test(match[0])) {
      const indices: number[] = [];
      for (const m of match[0].matchAll(CITE_INDEX)) {
        indices.push(Number.parseInt(m[1]!, 10));
      }
      if (indices.length > 0) out.push({ type: "cite", indices });
    } else if (match[6] != null) {
      out.push({ type: "bold", children: parseInline(match[6]) });
    } else if (match[7] != null) {
      out.push({ type: "italic", children: parseInline(match[7]) });
    } else if (match[8] != null) {
      out.push({ type: "bold", children: parseInline(match[8]) });
    } else if (match[9] != null) {
      out.push({ type: "italic", children: parseInline(match[9]) });
    }

    last = index + match[0].length;
  }

  if (last < input.length) {
    out.push({ type: "text", text: input.slice(last) });
  }

  return out.length > 0 ? out : [{ type: "text", text: input }];
}

export type CiteSource = {
  title: string;
  url: string;
  id?: number;
};

/**
 * Resolve citation indices against sources (same rules as web MarkdownBody).
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
    out.push(src);
  }
  return out;
}
