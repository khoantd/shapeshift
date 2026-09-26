import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/** Terms that mark “critical” briefing language in titles/excerpts. */
export const NEWS_CRITICAL_TERMS = [
  "critical",
  "urgent",
  "breaking",
  "must-know",
  "must know",
  "key",
  "crisis",
  "risk",
  "alert",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Dedupe + drop empty terms; longer phrases first so they win overlaps. */
export function normalizeHighlightTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

export function collectNewsHighlightTerms(query?: string | null): string[] {
  const q = (query ?? "").trim();
  const extras = q ? q.split(/\s+/).filter((w) => w.length >= 2) : [];
  if (q && !extras.includes(q)) extras.unshift(q);
  return normalizeHighlightTerms([...extras, ...NEWS_CRITICAL_TERMS]);
}

/**
 * Sentences (or the whole blob) that contain at least one highlight term.
 * Empty when nothing matches — callers should hide Highlights.
 */
export function extractNewsHighlightSnippets(
  text: string,
  terms: readonly string[],
): string[] {
  const normalized = normalizeHighlightTerms(terms);
  const trimmed = text.trim();
  if (!trimmed || normalized.length === 0) return [];

  const pattern = new RegExp(normalized.map(escapeRegExp).join("|"), "i");
  const pieces = trimmed.split(/(?<=[.!?…])\s+|\n+/);
  const sentences = pieces.map((s) => s.trim()).filter(Boolean);
  const candidates = sentences.length > 0 ? sentences : [trimmed];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const sentence of candidates) {
    if (!pattern.test(sentence)) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sentence);
  }
  return out;
}

/**
 * Split `text` into plain + marked React nodes. Never injects HTML — only text nodes
 * wrapped in `<mark>`.
 */
export function highlightNewsText(text: string, terms: readonly string[]): ReactNode {
  const normalized = normalizeHighlightTerms(terms);
  if (!text || normalized.length === 0) return text;

  const pattern = new RegExp(`(${normalized.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  const keys = new Set(normalized.map((t) => t.toLowerCase()));

  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      if (!part) return null;
      if (keys.has(part.toLowerCase())) {
        return createElement(
          "mark",
          {
            key: `m-${i}`,
            className: "rounded-sm bg-[var(--brand-soft)] px-0.5 text-foreground",
          },
          part,
        );
      }
      return createElement(Fragment, { key: `t-${i}` }, part);
    }),
  );
}
