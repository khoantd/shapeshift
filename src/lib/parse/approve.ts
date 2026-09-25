import { collapse, tidy } from "./common";

export type ApproveData = {
  tool: string;
  args: string;
  rationale: string;
};

const LABEL_RE = /(?:\*\*)?(Tool|Function|Name|Args?|Arguments?|Params?|Parameters?|Rationale|Reason|Why)(?:\*\*)?\s*:\s*/gi;

const empty = (): ApproveData => ({ tool: "", args: "", rationale: "" });

function fieldFor(label: string): keyof ApproveData | null {
  const k = label.toLowerCase();
  if (k === "tool" || k === "function" || k === "name") return "tool";
  if (k === "arg" || k === "args" || k === "argument" || k === "arguments" || k === "param" || k === "params" || k === "parameters") return "args";
  if (k === "rationale" || k === "reason" || k === "why") return "rationale";
  return null;
}

/** Pull `tool_name({...})` or `tool_name({...})` style proposals from free text. */
function fromCallShape(raw: string): ApproveData | null {
  const m = raw.match(/\b([a-zA-Z_][\w.]{1,64})\s*\(\s*(\{[\s\S]*\}|\[[\s\S]*\]|"[^"]*"|'[^']*'|[^)]{0,400})\s*\)/);
  if (!m) return null;
  return { tool: m[1]!, args: tidy(m[2] ?? ""), rationale: "" };
}

export function parseApprove(text: string): ApproveData {
  const data = empty();
  const raw = text.replace(/\b(approve|approval|tool[- ]?call|allow execution|pause for approval)\b/gi, " ").trim();
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

  const shaped = fromCallShape(raw);
  if (shaped) return shaped;

  return { tool: "", args: "", rationale: tidy(raw) };
}

export function completeApprove(d: ApproveData) {
  return (d.tool ? 0.5 : 0) + (d.args ? 0.35 : 0) + (d.rationale ? 0.15 : 0);
}
