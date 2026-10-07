import type { GraphPayload } from "@/lib/neo4j/types";
import { summarizeLearningPackStats } from "@/lib/youtube/learningPackHistoryStats";

export type WatchCompanionPhase = "empty" | "ready";

/** Empty until a pack or transcript summary exists. */
export function watchCompanionPhase(input: {
  packText: string | null | undefined;
  summaryText: string | null | undefined;
}): WatchCompanionPhase {
  if (hasText(input.packText) || hasText(input.summaryText)) return "ready";
  return "empty";
}

/**
 * Prefer the session summary; else pack `### TL;DR` body;
 * else the first prose paragraph under the H1.
 * Always returns plain text (markdown markers stripped).
 */
export function resolveWatchTldr(input: {
  summaryText: string | null | undefined;
  packMarkdown: string | null | undefined;
  maxChars?: number;
}): string | null {
  const maxChars = input.maxChars ?? 420;
  const summary = input.summaryText?.trim();
  if (summary) {
    const plain = plainTextFromMarkdown(summary, { preferTldrSection: true });
    if (plain) return clampText(plain, maxChars);
  }

  const fromPack = extractTldrFromPack(input.packMarkdown ?? "");
  if (fromPack) return clampText(fromPack, maxChars);
  return null;
}

/** Concept / term counts for the graph teaser; null when nothing to show. */
export function watchCompanionGraphStats(input: {
  packMarkdown: string | null | undefined;
  graphPayload?: GraphPayload | null;
}): { conceptCount: number; termCount: number } | null {
  const markdown = input.packMarkdown?.trim() ?? "";
  const graph = input.graphPayload ?? null;
  if (!markdown && !graph) return null;

  const stats = summarizeLearningPackStats({
    markdown,
    graphPayload: graph,
  });
  if (stats.conceptCount === 0 && stats.termCount === 0) return null;
  return {
    conceptCount: stats.conceptCount,
    termCount: stats.termCount,
  };
}

function hasText(value: string | null | undefined): boolean {
  return (value?.trim() ?? "").length > 0;
}

function clampText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const cut = normalized.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

const TLDR_HEADING_RE = /#{1,6}\s*\*{0,2}TL;?DR\*{0,2}\s*/i;
const ANY_HEADING_RE = /#{1,6}\s*\*{0,2}/;

/**
 * Collapse markdown to readable plain text for the watch TL;DR strip.
 * When `preferTldrSection` is set, keep only the body after a TL;DR heading
 * (works for multiline or inline `## **TL;DR** … ## **Key points**`).
 */
export function plainTextFromMarkdown(
  markdown: string,
  options?: { preferTldrSection?: boolean },
): string {
  let body = markdown.replace(/\r\n/g, "\n");

  if (options?.preferTldrSection) {
    const tldr = TLDR_HEADING_RE.exec(body);
    if (tldr) {
      const after = body.slice(tldr.index + tldr[0].length);
      const next = ANY_HEADING_RE.exec(after);
      body = next ? after.slice(0, next.index) : after;
    }
  }

  return stripMarkdownMarkers(body);
}

function stripMarkdownMarkers(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(?:^|\s)[-*+]\s+(?=\S)/g, " ")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripInlineMd(text: string): string {
  return stripMarkdownMarkers(text);
}

function extractTldrFromPack(markdown: string): string | null {
  if (!markdown.trim()) return null;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let inTldr = false;
  const tldrBuf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+\*{0,2}TL;?DR\*{0,2}\b/i.test(trimmed)) {
      inTldr = true;
      continue;
    }
    if (inTldr) {
      if (/^#{1,3}\s+/.test(trimmed)) break;
      if (!trimmed) {
        if (tldrBuf.length > 0) break;
        continue;
      }
      tldrBuf.push(stripInlineMd(trimmed));
    }
  }
  if (tldrBuf.length > 0) return tldrBuf.join(" ");

  // Fallback: first non-empty prose paragraph after the H1 / meta line.
  let seenH1 = false;
  const para: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!seenH1) {
      if (/^#\s+/.test(trimmed)) seenH1 = true;
      continue;
    }
    if (/^#{1,3}\s+/.test(trimmed)) {
      if (para.length > 0) break;
      continue;
    }
    if (!trimmed) {
      if (para.length > 0) break;
      continue;
    }
    // Skip bold meta rows like **Creator:** …
    if (/^\*\*[^*]+:\*\*/.test(trimmed)) continue;
    para.push(stripInlineMd(trimmed));
  }
  return para.length > 0 ? para.join(" ") : null;
}
