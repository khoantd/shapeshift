import { collapse } from "./common";

/** BCMT — Bối Cảnh · Con Người · Mục Tiêu · Tiêu Chuẩn (+ optional Đầu vào). */
export type BcmtData = {
  context: string;
  people: string;
  goal: string;
  standards: string;
  input: string;
};

export const BCMT_CORE = ["context", "people", "goal", "standards"] as const;
export const BCMT_FIELDS = [...BCMT_CORE, "input"] as const;
export type BcmtField = (typeof BCMT_FIELDS)[number];

/** Tag names used in the composed prompt (matches VN BCMT skeleton). */
export const BCMT_TAGS: Record<BcmtField, string> = {
  context: "bối_cảnh",
  people: "con_người",
  goal: "mục_tiêu",
  standards: "tiêu_chuẩn",
  input: "đầu_vào",
};

const LABEL_TO_FIELD: Record<string, BcmtField> = {
  // Vietnamese (with/without diacritics, spaces or underscores)
  "bối cảnh": "context",
  "bối_cảnh": "context",
  "boi canh": "context",
  "boi_canh": "context",
  "con người": "people",
  "con_người": "people",
  "con nguoi": "people",
  "con_nguoi": "people",
  "mục tiêu": "goal",
  "mục_tiêu": "goal",
  "muc tieu": "goal",
  "muc_tieu": "goal",
  "tiêu chuẩn": "standards",
  "tiêu_chuẩn": "standards",
  "tieu chuan": "standards",
  "tieu_chuan": "standards",
  "đầu vào": "input",
  "đầu_vào": "input",
  "dau vao": "input",
  "dau_vao": "input",
  // English aliases
  context: "context",
  people: "people",
  audience: "people",
  goal: "goal",
  objective: "goal",
  standards: "standards",
  criteria: "standards",
  input: "input",
};

const LABEL_RE =
  /(?:\*\*)?(Bối\s*cảnh|Bối_cảnh|Boi\s*canh|Boi_canh|Con\s*người|Con_người|Con\s*nguoi|Con_nguoi|Mục\s*tiêu|Mục_tiêu|Muc\s*tieu|Muc_tieu|Tiêu\s*chuẩn|Tiêu_chuẩn|Tieu\s*chuan|Tieu_chuan|Đầu\s*vào|Đầu_vào|Dau\s*vao|Dau_vao|Context|People|Audience|Goal|Objective|Standards|Criteria|Input)(?:\*\*)?\s*:\s*/gi;

const TAG_RE =
  /<(bối_cảnh|boi_canh|con_người|con_nguoi|mục_tiêu|muc_tieu|tiêu_chuẩn|tieu_chuan|đầu_vào|dau_vao)>([\s\S]*?)<\/\1>/gi;

const TAG_TO_FIELD: Record<string, BcmtField> = {
  bối_cảnh: "context",
  boi_canh: "context",
  con_người: "people",
  con_nguoi: "people",
  mục_tiêu: "goal",
  muc_tieu: "goal",
  tiêu_chuẩn: "standards",
  tieu_chuan: "standards",
  đầu_vào: "input",
  dau_vao: "input",
};

const empty = (): BcmtData => ({ context: "", people: "", goal: "", standards: "", input: "" });

function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tidyField(s: string, collapseWs: boolean): string {
  const trimmed = s.replace(/^\s+/, "").replace(/\s+$/, "");
  if (!trimmed) return "";
  if (collapseWs) return collapse(trimmed.replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, ""));
  // Keep list newlines inside standards / tagged blocks; still strip trailing punctuation crumbs.
  return trimmed.replace(/^[.;]\s*/, "").replace(/\s*[.;]\s*$/, "");
}

export function parseBcmt(text: string): BcmtData {
  const data = empty();
  const raw = text.replace(/\bbcmt\b/gi, " ").trim();
  if (!raw) return data;

  // Prefer XML-style tags from the BCMT skeleton.
  let tagged = false;
  for (const m of raw.matchAll(TAG_RE)) {
    const field = TAG_TO_FIELD[m[1].toLowerCase()];
    if (!field) continue;
    tagged = true;
    data[field] = tidyField(m[2], false);
  }
  if (tagged) return data;

  const matches = [...raw.matchAll(LABEL_RE)];
  if (!matches.length) return data;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const field = LABEL_TO_FIELD[normalizeLabel(m[1])];
    if (!field) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    // Standards often carry bullet lists — preserve newlines when the slice has them.
    const slice = raw.slice(start, end);
    data[field] = tidyField(slice, !/\n/.test(slice));
  }
  return data;
}

export function composeBcmt(d: BcmtData): string {
  const parts = BCMT_CORE.map((k) => `<${BCMT_TAGS[k]}>\n${d[k]}\n</${BCMT_TAGS[k]}>`);
  if (d.input.trim()) parts.push(`<${BCMT_TAGS.input}>\n${d.input}\n</${BCMT_TAGS.input}>`);
  return parts.join("\n\n");
}

/** Completeness over the four core BCMT sections; đầu vào is optional. */
export function completeBcmt(d: BcmtData) {
  return BCMT_CORE.filter((k) => d[k].trim()).length / BCMT_CORE.length;
}
