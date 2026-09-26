import { capitalize, collapse, tidy } from "./common";

export type TriageData = {
  title: string;
  report: string;
  context: string;
};

const LABEL_RE = /(?:\*\*)?(Title|Report|Ticket|Context|Service)(?:\*\*)?\s*:\s*/gi;

const empty = (): TriageData => ({ title: "", report: "", context: "" });

function fieldFor(label: string): "title" | "report" | "context" | null {
  const k = label.toLowerCase();
  if (k === "title" || k === "ticket") return "title";
  if (k === "report") return "report";
  if (k === "context" || k === "service") return "context";
  return null;
}

export function parseTriage(text: string): TriageData {
  const data = empty();
  const raw = text.replace(/\b(triage|priorit[iy]ze|ticket)\b/gi, " ").trim();
  if (!raw) return data;

  const matches = [...raw.matchAll(LABEL_RE)];
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const field = fieldFor(m[1]!);
      if (!field) continue;
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? raw.length) : raw.length;
      const value = collapse(raw.slice(start, end).replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, ""));
      if (field === "title" && data.title) data.report = data.report || value;
      else data[field] = value;
    }
    if (!data.title && data.report) {
      data.title = capitalize(data.report.slice(0, 60));
    }
    return data;
  }

  const lines = raw.split(/\n+/).map((l) => collapse(l)).filter(Boolean);
  if (lines.length >= 2) {
    data.title = capitalize(lines[0]!);
    data.report = tidy(lines.slice(1).join(" "));
    return data;
  }

  const first = collapse(raw);
  const m = first.match(/^(.{8,72}?[.!?])\s+(.+)$/);
  if (m) return { title: capitalize(m[1]!), report: tidy(m[2]!), context: "" };
  return { title: capitalize(first), report: "", context: "" };
}

export function completeTriage(d: TriageData) {
  return (d.title ? 0.4 : 0) + (d.report ? 0.4 : 0) + (d.context ? 0.2 : 0);
}
