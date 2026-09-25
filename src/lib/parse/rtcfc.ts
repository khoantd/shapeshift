import { collapse } from "./common";

export type RtcfcData = {
  role: string;
  task: string;
  context: string;
  format: string;
  constraints: string;
};

export const RTCFC_FIELDS = ["role", "task", "context", "format", "constraints"] as const;
export type RtcfcField = (typeof RTCFC_FIELDS)[number];

const LABEL_TO_FIELD: Record<string, RtcfcField> = {
  role: "role",
  task: "task",
  context: "context",
  format: "format",
  constraints: "constraints",
};

/** Match Role / Task / Context / Format / Constraints labels (optional markdown bold). */
const LABEL_RE = /(?:\*\*)?(Role|Task|Context|Format|Constraints)(?:\*\*)?\s*:\s*/gi;

const empty = (): RtcfcData => ({ role: "", task: "", context: "", format: "", constraints: "" });

export function parseRtcfc(text: string): RtcfcData {
  const data = empty();
  const raw = text.replace(/\brtcfc\b/gi, " ").trim();
  if (!raw) return data;

  const matches = [...raw.matchAll(LABEL_RE)];
  if (!matches.length) return data;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const field = LABEL_TO_FIELD[m[1].toLowerCase()];
    if (!field) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    data[field] = collapse(raw.slice(start, end).replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, ""));
  }
  return data;
}

export function composeRtcfc(d: RtcfcData): string {
  return RTCFC_FIELDS.map((k) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${d[k]}`).join("\n");
}

export function completeRtcfc(d: RtcfcData) {
  return RTCFC_FIELDS.filter((k) => d[k].trim()).length / RTCFC_FIELDS.length;
}

/** Curated complete prompts for empty-card auto-fill and “Roll again”. */
export const RTCFC_SAMPLES: readonly RtcfcData[] = [
  {
    role: "staff engineer",
    task: "review this PR for correctness and security risks",
    context: "NestJS monorepo with apps/api and packages/shared",
    format: "Markdown severity table P0–P3, max 15 findings",
    constraints: "Skip style nits. Prefer concrete file:line references",
  },
  {
    role: "senior marketer",
    task: "write 3 Zalo outreach messages for a free CRM trial",
    context: "SME owners in Ho Chi Minh City, busy founders",
    format: "≤400 characters each, Vietnamese, numbered list",
    constraints: "No emojis in the first line. Soft CTA only",
  },
  {
    role: "product designer",
    task: "critique this onboarding flow and propose 3 fixes",
    context: "B2B SaaS, first-run empty state after signup",
    format: "Bullet list: problem → why → suggested fix",
    constraints: "Stay within existing component library. No new pages",
  },
  {
    role: "technical writer",
    task: "draft a README quickstart for a TypeScript CLI",
    context: "Open-source tool published on npm, Node 20+",
    format: "Markdown: Install, Usage, Flags, Example",
    constraints: "Assume zero prior context. No marketing fluff",
  },
  {
    role: "QA lead",
    task: "generate regression test cases for the checkout path",
    context: "E-commerce web app with Stripe and guest checkout",
    format: "Table: ID, Steps, Expected, Priority",
    constraints: "Include at least 2 negative paths. No UI copy changes",
  },
  {
    role: "executive coach",
    task: "turn raw notes into a 5-bullet CEO brief",
    context: "Mid-market expansion decision for a SaaS company",
    format: "Exactly 5 bullets, one sentence each",
    constraints: "No jargon. Flag unknowns explicitly",
  },
];

function sameRtcfc(a: RtcfcData, b: RtcfcData) {
  return RTCFC_FIELDS.every((k) => a[k] === b[k]);
}

/** Pick a random complete RTCFC sample; optionally avoid repeating `exclude`. */
export function rollRtcfc(rand: () => number = Math.random, exclude?: RtcfcData): RtcfcData {
  const pool =
    exclude && RTCFC_SAMPLES.length > 1 ? RTCFC_SAMPLES.filter((s) => !sameRtcfc(s, exclude)) : RTCFC_SAMPLES;
  return pool[Math.floor(rand() * pool.length)]!;
}
