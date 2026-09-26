import { collapse, tidy } from "./common";

export type ModerateData = {
  content: string;
  context: string;
  policy: string;
};

const LABEL_RE = /(?:\*\*)?(Content|Text|Context|Surrounding|Policy|Criteria)(?:\*\*)?\s*:\s*/gi;

const empty = (): ModerateData => ({ content: "", context: "", policy: "" });

function fieldFor(label: string): keyof ModerateData | null {
  const k = label.toLowerCase();
  if (k === "content" || k === "text") return "content";
  if (k === "context" || k === "surrounding") return "context";
  if (k === "policy" || k === "criteria") return "policy";
  return null;
}

export function parseModerate(text: string): ModerateData {
  const data = empty();
  const raw = text.replace(/\b(moderate|moderation|flag)\b/gi, " ").trim();
  if (!raw) return data;

  const matches = [...raw.matchAll(LABEL_RE)];
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const field = fieldFor(m[1]!);
      if (!field) continue;
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? raw.length) : raw.length;
      data[field] = collapse(raw.slice(start, end).replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, ""));
    }
    return data;
  }

  return { content: tidy(raw), context: "", policy: "" };
}

export function completeModerate(d: ModerateData) {
  return (d.content ? 0.6 : 0) + (d.context ? 0.2 : 0) + (d.policy ? 0.2 : 0);
}
