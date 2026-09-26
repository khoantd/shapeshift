import { collapse } from "./common";

export type EvalData = {
  request: string;
  answer: string;
  reference: string;
};

const LABEL_RE =
  /(?:\*\*)?(Request|Question|User|Answer|Response|Generated|Reference|Sources?|Material)(?:\*\*)?\s*:\s*/gi;

const empty = (): EvalData => ({ request: "", answer: "", reference: "" });

function fieldFor(label: string): keyof EvalData | null {
  const k = label.toLowerCase();
  if (k === "request" || k === "question" || k === "user") return "request";
  if (k === "answer" || k === "response" || k === "generated") return "answer";
  if (k === "reference" || k === "source" || k === "sources" || k === "material") return "reference";
  return null;
}

export function parseEval(text: string): EvalData {
  const data = empty();
  const raw = text.replace(/\b(eval(?:uate)?|grade|score)\b/gi, " ").trim();
  if (!raw) return data;

  const matches = [...raw.matchAll(LABEL_RE)];
  if (!matches.length) return data;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const field = fieldFor(m[1]!);
    if (!field) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? raw.length) : raw.length;
    const value = collapse(raw.slice(start, end).replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, ""));
    if (data[field]) data[field] = `${data[field]} ${value}`.trim();
    else data[field] = value;
  }
  return data;
}

export function completeEval(d: EvalData) {
  return (d.request ? 0.35 : 0) + (d.answer ? 0.45 : 0) + (d.reference ? 0.2 : 0);
}
