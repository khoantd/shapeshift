import { DOC_CATEGORIES } from "@/lib/jev/types";
import { collapse, tidy } from "./common";

export type ClassifyData = {
  body: string;
  /** Vocabulary from a Categories: line, else the built-in set. */
  categories: string[];
};

const CATEGORIES_RE = /(?:\*\*)?Categor(?:y|ies)(?:\*\*)?\s*:\s*(.+)$/im;
const DEFAULT_CATEGORIES: string[] = [...DOC_CATEGORIES];

export function parseClassify(text: string): ClassifyData {
  const raw = text.replace(/\b(classify|categorize|categorise)\b/gi, " ").trim();
  if (!raw) return { body: "", categories: DEFAULT_CATEGORIES };

  const catMatch = raw.match(CATEGORIES_RE);
  let categories: string[] = DEFAULT_CATEGORIES;
  let body = raw;

  if (catMatch) {
    const listed = catMatch[1]!
      .split(/[,;/|]/)
      .map((s) => tidy(s))
      .filter(Boolean);
    if (listed.length >= 2) categories = listed.map((c) => c.toLowerCase());
    body = collapse(raw.slice(0, catMatch.index).trim());
  }

  return { body: tidy(body), categories };
}

export function completeClassify(d: ClassifyData) {
  const words = d.body.split(/\s+/).filter(Boolean).length;
  return Math.min(1, (words >= 4 ? 0.7 : words / 6) + (d.categories.length >= 2 ? 0.3 : 0));
}
