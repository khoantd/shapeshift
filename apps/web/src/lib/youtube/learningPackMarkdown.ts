/** Lightweight Markdown → structured blocks for learning-pack preview (no HTML). */

export type InlineSpan =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "list"; ordered: boolean; items: InlineSpan[][] }
  | { type: "flashcards"; cards: { q: InlineSpan[]; a: InlineSpan[] }[] }
  | { type: "hr" }
  | { type: "answerKey"; blocks: MdBlock[] };

const FLASHCARD_RE = /^\s*[-*]\s*Q:\s*(.+?)\s*\|\s*A:\s*(.+)\s*$/i;
const LIST_RE = /^\s*[-*]\s+(.+)$/;
const ORDERED_RE = /^\s*\d+[.)]\s+(.+)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

/** Parse inline `**bold**`, `*italic*`, `` `code` `` into spans. */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      spans.push({ type: "text", text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      spans.push({ type: "bold", text: m[2] });
    } else if (m[3] !== undefined) {
      spans.push({ type: "italic", text: m[3] });
    } else if (m[4] !== undefined) {
      spans.push({ type: "code", text: m[4] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    spans.push({ type: "text", text: text.slice(last) });
  }
  return spans.length > 0 ? spans : [{ type: "text", text: "" }];
}

function isAnswerKeyHeading(spans: InlineSpan[]): boolean {
  const plain = spans.map((s) => s.text).join("").toLowerCase();
  return /answer\s*key/.test(plain);
}

/**
 * Parse learning-pack Markdown into typed blocks.
 * Flashcard lines are grouped; content under an "Answer key" heading is nested.
 */
export function parseLearningPackMarkdown(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const raw: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (HR_RE.test(trimmed)) {
      raw.push({ type: "hr" });
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      const level = Math.min(3, heading[1]!.length) as 1 | 2 | 3;
      raw.push({ type: "heading", level, spans: parseInline(heading[2]!.trim()) });
      i += 1;
      continue;
    }

    // Flashcards cluster
    if (FLASHCARD_RE.test(line)) {
      const cards: { q: InlineSpan[]; a: InlineSpan[] }[] = [];
      while (i < lines.length) {
        const fm = FLASHCARD_RE.exec(lines[i]!);
        if (!fm) {
          if (!lines[i]!.trim()) {
            i += 1;
            // allow blank between cards; stop if next non-blank isn't a card
            if (i < lines.length && !FLASHCARD_RE.test(lines[i]!)) break;
            continue;
          }
          break;
        }
        cards.push({
          q: parseInline(fm[1]!.trim()),
          a: parseInline(fm[2]!.trim()),
        });
        i += 1;
      }
      if (cards.length > 0) raw.push({ type: "flashcards", cards });
      continue;
    }

    // Unordered / ordered list
    const ul = LIST_RE.exec(line);
    const ol = ORDERED_RE.exec(line);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const items: InlineSpan[][] = [];
      while (i < lines.length) {
        const cur = lines[i]!;
        if (FLASHCARD_RE.test(cur)) break;
        const um = LIST_RE.exec(cur);
        const om = ORDERED_RE.exec(cur);
        if (ordered ? om : um) {
          items.push(parseInline((ordered ? om![1]! : um![1]!).trim()));
          i += 1;
          continue;
        }
        if (!cur.trim()) {
          i += 1;
          if (i < lines.length) {
            const peek = lines[i]!;
            if ((ordered ? ORDERED_RE : LIST_RE).test(peek) && !FLASHCARD_RE.test(peek)) continue;
          }
          break;
        }
        break;
      }
      if (items.length > 0) raw.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: consume consecutive non-blank, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i]!;
      const t = cur.trim();
      if (!t) break;
      if (HEADING_RE.test(t) || HR_RE.test(t) || FLASHCARD_RE.test(cur) || LIST_RE.test(cur) || ORDERED_RE.test(cur)) {
        break;
      }
      paraLines.push(t);
      i += 1;
    }
    if (paraLines.length > 0) {
      raw.push({ type: "paragraph", spans: parseInline(paraLines.join(" ")) });
    }
  }

  return nestAnswerKey(raw);
}

function nestAnswerKey(blocks: MdBlock[]): MdBlock[] {
  const out: MdBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.type === "heading" && isAnswerKeyHeading(b.spans)) {
      const nested: MdBlock[] = [];
      i += 1;
      while (i < blocks.length) {
        const next = blocks[i]!;
        if (next.type === "heading" && next.level <= b.level) break;
        if (next.type === "heading" && isAnswerKeyHeading(next.spans)) break;
        // Stop answer key before Flashcards section
        if (
          next.type === "heading" &&
          /flashcard/i.test(next.spans.map((s) => s.text).join(""))
        ) {
          break;
        }
        nested.push(next);
        i += 1;
      }
      out.push({ type: "heading", level: b.level, spans: b.spans });
      out.push({ type: "answerKey", blocks: nested });
      continue;
    }
    out.push(b);
    i += 1;
  }
  return out;
}
