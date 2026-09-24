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
