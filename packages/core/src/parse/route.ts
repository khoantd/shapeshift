import { capitalize, collapse, titleCase, tidy } from "./common";

export type RouteData = {
  subject: string;
  fields: string;
  owners: string[];
};

const LABEL_RE = /(?:\*\*)?(Subject|Form|Fields?|Destination|Owners?|Assignees?|Queue)(?:\*\*)?\s*:\s*/gi;

const empty = (): RouteData => ({ subject: "", fields: "", owners: [] });

function fieldFor(label: string): "subject" | "fields" | "owners" | null {
  const k = label.toLowerCase();
  if (k === "subject" || k === "form") return "subject";
  if (k === "field" || k === "fields" || k === "destination") return "fields";
  if (k === "owner" || k === "owners" || k === "assignee" || k === "assignees" || k === "queue") return "owners";
  return null;
}

function splitOwners(raw: string): string[] {
  return raw
    .split(/[,;/|]| and /i)
    .map((s) => titleCase(tidy(s)))
    .filter(Boolean);
}

export function parseRoute(text: string): RouteData {
  const data = empty();
  const raw = text.replace(/\b(route|routing|assign|assignee)\b/gi, " ").trim();
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
      if (field === "owners") data.owners = splitOwners(value);
      else data[field] = value;
    }
    return data;
  }

  // "route to Maya / Billing queue" style
  const toMatch = raw.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Za-z][\w\s/-]{1,40}?)(?:\s*$|[.!]|\s+for\b)/);
  if (toMatch) {
    data.owners = splitOwners(toMatch[1]!);
    data.subject = capitalize(tidy(raw.replace(toMatch[0], " ")));
    return data;
  }

  return { subject: capitalize(tidy(raw)), fields: "", owners: [] };
}

export function completeRoute(d: RouteData) {
  return (d.subject ? 0.4 : 0) + (d.fields ? 0.2 : 0) + (d.owners.length ? 0.4 : 0);
}
