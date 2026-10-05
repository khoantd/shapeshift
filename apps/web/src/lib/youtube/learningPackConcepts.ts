/** Extract timestamped Key concepts from a learning-pack Markdown body. */

export type LearningPackConcept = {
  id: string;
  title: string;
  startSec: number;
  timestampLabel: string;
};

/** Match [m:ss], [mm:ss], [h:mm:ss], and the same without brackets. */
const TIMESTAMP_TOKEN_RE = /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?(?!\d)/;
/**
 * Bracketed single `[mm:ss]` / `[h:mm:ss]`, bracketed range `[mm:ss–mm:ss]`
 * (hyphen / en-dash / em-dash), or bare `mm:ss` at a word boundary.
 * Range capture groups: 1–3 = start, 4–6 = end (ignored; overlay uses start).
 * Single bracketed: 7–9. Bare: 10–12.
 */
const TIMESTAMP_GLOBAL_RE =
  /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]|\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]|(?:^|[\s(])(\d{1,2}):(\d{2})(?::(\d{2}))?(?=[\s).,]|$)/g;

const LOOKAHEAD_LINES = 10;

function partsToSeconds(a: number, b: number, c: number | null): number | null {
  if (![a, b].every(Number.isFinite) || (c !== null && !Number.isFinite(c))) return null;
  if (b >= 60) return null;
  if (c !== null) {
    if (c >= 60) return null;
    return a * 3600 + b * 60 + c;
  }
  return a * 60 + b;
}

/** Parse `[m:ss]`, `[mm:ss]`, `[h:mm:ss]`, range start of `[mm:ss–mm:ss]`, or bare `m:ss` → seconds. */
export function parsePackTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  const range = /^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—]\s*\d/.exec(trimmed);
  if (range) {
    return partsToSeconds(
      Number(range[1]),
      Number(range[2]),
      range[3] !== undefined ? Number(range[3]) : null,
    );
  }
  const m = TIMESTAMP_TOKEN_RE.exec(trimmed);
  if (!m) return null;
  return partsToSeconds(
    Number(m[1]),
    Number(m[2]),
    m[3] !== undefined ? Number(m[3]) : null,
  );
}

function formatTimestampLabel(startSec: number): string {
  const s = Math.max(0, Math.floor(startSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `[${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}]`;
  }
  return `[${m}:${String(r).padStart(2, "0")}]`;
}

function firstTimestampIn(text: string): { startSec: number; timestampLabel: string } | null {
  TIMESTAMP_GLOBAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIMESTAMP_GLOBAL_RE.exec(text)) !== null) {
    let startSec: number | null = null;
    let timestampLabel: string | null = null;

    if (m[1] !== undefined) {
      // Bracketed range — use start
      startSec = partsToSeconds(
        Number(m[1]),
        Number(m[2]),
        m[3] !== undefined ? Number(m[3]) : null,
      );
      if (startSec !== null) timestampLabel = formatTimestampLabel(startSec);
    } else if (m[7] !== undefined) {
      // Bracketed single
      const raw = `[${m[7]}:${m[8]}${m[9] !== undefined ? `:${m[9]}` : ""}]`;
      startSec = parsePackTimestamp(raw);
      if (startSec !== null) timestampLabel = raw;
    } else if (m[10] !== undefined) {
      // Bare mm:ss
      const raw = `${m[10]}:${m[11]}${m[12] !== undefined ? `:${m[12]}` : ""}`;
      startSec = parsePackTimestamp(raw);
      if (startSec !== null) timestampLabel = formatTimestampLabel(startSec);
    }

    if (startSec === null || timestampLabel === null) continue;
    return { startSec, timestampLabel };
  }
  return null;
}

function plainHeadingText(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\*+/g, "")
    .trim();
}

function isKeyConceptsHeading(line: string): boolean {
  if (!/^#{1,3}\s+/.test(line)) return false;
  const t = plainHeadingText(line).toLowerCase();
  return (
    /key\s*concepts?/.test(t) ||
    /khái\s*niệm/.test(t) ||
    /concepts?\s*worth/.test(t) ||
    /^concepts$/.test(t)
  );
}

function isSectionBreak(line: string): boolean {
  return /^#{1,2}\s+/.test(line.trim()) && !/^###/.test(line.trim());
}

/** Bold title at start of a list/paragraph line: `**Name**` or `1. **Name**`. */
function boldTitleFromLine(line: string): string | null {
  const m =
    /^\s*(?:\d+[.)]\s+|[-*]\s+)?\*\*(.+?)\*\*/.exec(line) ??
    /^\s*(?:\d+[.)]\s+)([^*][^*\n]{1,100}?)(?:\s*[—–:-]\s+|\s*$)/.exec(line);
  if (!m) return null;
  const title = m[1]!.replace(/\*+/g, "").trim();
  if (!title || title.length > 120) return null;
  if (
    /^(in plain words|why it matters|revisit|timestamp|plain words|creator|duration|language|tl;?dr)/i.test(
      title,
    )
  ) {
    return null;
  }
  return title;
}

function pushConcept(
  raw: LearningPackConcept[],
  title: string,
  ts: { startSec: number; timestampLabel: string },
) {
  raw.push({
    id: `${ts.startSec}-${title}`,
    title,
    startSec: ts.startSec,
    timestampLabel: ts.timestampLabel,
  });
}

function timestampInWindow(lines: string[], fromIdx: number): {
  startSec: number;
  timestampLabel: string;
} | null {
  const end = Math.min(lines.length, fromIdx + LOOKAHEAD_LINES);
  const chunk: string[] = [];
  for (let i = fromIdx; i < end; i++) {
    const t = lines[i]!.trim();
    if (i > fromIdx && (isSectionBreak(t) || /^###\s+/.test(t))) break;
    // Stop lookahead at next numbered/bold concept start
    if (
      i > fromIdx &&
      (/^\s*(?:\d+[.)]\s+|[-*]\s+)\*\*/.test(t) || /^\s*\d+[.)]\s+\*\*/.test(t))
    ) {
      break;
    }
    chunk.push(lines[i]!);
  }
  return firstTimestampIn(chunk.join("\n"));
}

/**
 * Pull timestamped Key concepts from the pack.
 * Supports ### headings and bold/list items under a Key concepts section.
 * Falls back to any ### with a nearby [mm:ss] if the section yields nothing.
 */
export function extractKeyConcepts(markdown: string): LearningPackConcept[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inSection = false;
  let pending: { title: string; startIdx: number; body: string[] } | null = null;
  const raw: LearningPackConcept[] = [];

  const flush = () => {
    if (!pending) return;
    const body = pending.body.join("\n");
    const ts =
      firstTimestampIn(body) ??
      firstTimestampIn(pending.title) ??
      timestampInWindow(lines, pending.startIdx);
    if (ts) pushConcept(raw, pending.title, ts);
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (/^#{1,3}\s+/.test(trimmed) && !/^####/.test(trimmed)) {
      const level = (trimmed.match(/^#+/) ?? ["##"])[0]!.length;
      if (isKeyConceptsHeading(trimmed)) {
        flush();
        inSection = true;
        pending = null;
        continue;
      }
      if (level <= 2 && inSection) {
        flush();
        inSection = false;
        pending = null;
        continue;
      }
    }

    if (!inSection) continue;

    if (/^###\s+/.test(trimmed)) {
      flush();
      pending = { title: plainHeadingText(trimmed), startIdx: i, body: [] };
      continue;
    }

    const boldTitle = boldTitleFromLine(trimmed);
    if (
      boldTitle &&
      (/^\s*(?:\d+[.)]\s+|[-*]\s+)?\*\*/.test(trimmed) || /^\s*\d+[.)]\s+/.test(trimmed))
    ) {
      flush();
      // Always keep the concept line so same-line timestamps (incl. ranges) are searchable
      pending = {
        title: boldTitle,
        startIdx: i,
        body: [trimmed],
      };
      continue;
    }

    if (pending) {
      pending.body.push(line);
    }
  }
  if (inSection) flush();

  // Fallback: any ### with a timestamp nearby
  if (raw.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!/^###\s+/.test(trimmed)) continue;
      const title = plainHeadingText(trimmed);
      const ts = timestampInWindow(lines, i);
      if (ts) pushConcept(raw, title, ts);
    }
  }

  // Fallback 2: numbered/bold items anywhere that include a timestamp in-window
  if (raw.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      const boldTitle = boldTitleFromLine(trimmed);
      if (!boldTitle) continue;
      if (!/^\s*(?:\d+[.)]\s+|[-*]\s+)?\*\*/.test(trimmed) && !/^\s*\d+[.)]\s+/.test(trimmed)) {
        continue;
      }
      const ts = timestampInWindow(lines, i);
      if (ts) pushConcept(raw, boldTitle, ts);
    }
  }

  raw.sort((a, b) => a.startSec - b.startSec || a.title.localeCompare(b.title));
  const seen = new Set<number>();
  const out: LearningPackConcept[] = [];
  for (const c of raw) {
    if (seen.has(c.startSec)) continue;
    seen.add(c.startSec);
    out.push(c);
  }
  return out;
}

/**
 * Active concept at playback time.
 * Before the first timestamp, returns the first concept (upcoming) so the overlay is visible.
 */
export function activeConceptAt(
  concepts: LearningPackConcept[],
  tSec: number,
): LearningPackConcept | null {
  if (concepts.length === 0) return null;
  let active: LearningPackConcept | null = null;
  for (const c of concepts) {
    if (c.startSec <= tSec) active = c;
    else break;
  }
  return active ?? concepts[0]!;
}
