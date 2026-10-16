/**
 * Quick Gadgets — wrap @shapeshift/core parsers for mobile Tools tab.
 */

import {
  composeRtcfc,
  parseRtcfc,
  rollRtcfc,
  rtcfcSourceBody,
  RTCFC_FIELDS,
  type RtcfcData,
} from "../../../packages/core/src/parse/rtcfc";
import { parseConvert, UNIT_LABELS } from "../../../packages/core/src/parse/convert";
import { parseSplit } from "../../../packages/core/src/parse/split";
import { formatClock, parseTimer } from "../../../packages/core/src/parse/timer";
import { parseTip, tipAmounts } from "../../../packages/core/src/parse/tip";

export type QuickGadgetIntent = "tip" | "split" | "convert" | "timer" | "rtcfc";

export const QUICK_GADGET_INTENTS: readonly QuickGadgetIntent[] = [
  "tip",
  "split",
  "convert",
  "timer",
  "rtcfc",
] as const;

export type GadgetResult = {
  intent: QuickGadgetIntent;
  query: string;
  title: string;
  badge?: string;
  amount?: string;
  meta: string;
  rows: Array<{ label: string; value: string; bold?: boolean }>;
  lines: string[];
  ready: boolean;
  copyText: string;
  timerSeconds?: number | null;
  timerLabel?: string;
  rtcfc?: RtcfcData;
  needsStructure?: boolean;
};

const EXAMPLE_SEEDS: Record<QuickGadgetIntent, string> = {
  tip: "tip 18% on $70",
  split: "split $40 for 3",
  convert: "10 km to mi",
  timer: "25 min focus",
  rtcfc:
    "Role: staff engineer. Task: review this PR for correctness and security risks. Context: NestJS monorepo. Format: Markdown severity table P0–P3. Constraints: Skip style nits.",
};

export function exampleSeed(intent: QuickGadgetIntent): string {
  return EXAMPLE_SEEDS[intent];
}

export function isQuickGadgetIntent(v: string): v is QuickGadgetIntent {
  return (QUICK_GADGET_INTENTS as readonly string[]).includes(v);
}

export function resolveQuickGadget(
  text: string,
  preferredIntent: QuickGadgetIntent | null = null,
): GadgetResult | null {
  let query = String(text || "").trim();
  const preferred =
    preferredIntent && isQuickGadgetIntent(preferredIntent)
      ? preferredIntent
      : null;
  if (!query && preferred) query = exampleSeed(preferred);
  if (!query) return null;

  const intent = preferred || detectQuickIntent(query);
  if (!intent) return null;

  if (intent === "tip") return buildTip(query);
  if (intent === "split") return buildSplit(query);
  if (intent === "convert") return buildConvert(query);
  if (intent === "timer") return buildTimer(query);
  return buildRtcfc(query);
}

function detectQuickIntent(text: string): QuickGadgetIntent | null {
  const t = text.toLowerCase();
  const scores: Partial<Record<QuickGadgetIntent, number>> = {};

  if (/\b(tip|gratuity|service\s*charge|%|percent)\b/i.test(text)) {
    scores.tip = (scores.tip || 0) + 6;
  }
  if (/\b(split|divide|share|ways)\b/i.test(t)) {
    scores.split = (scores.split || 0) + 6;
  }
  if (/\b(convert|km|mi|kg|lb|celsius|fahrenheit|°)\b/i.test(t)) {
    scores.convert = (scores.convert || 0) + 6;
  }
  if (/\b(timer|minute|min|pomodoro|countdown|hour)\b/i.test(t)) {
    scores.timer = (scores.timer || 0) + 6;
  }
  if (/\brtcfc\b/i.test(t) || /\b(role|task|context|format|constraints)\s*:/i.test(text)) {
    scores.rtcfc = (scores.rtcfc || 0) + 8;
  }

  let best: QuickGadgetIntent | null = null;
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores) as Array<[QuickGadgetIntent, number]>) {
    if (v > bestScore) {
      best = k;
      bestScore = v;
    }
  }
  return best;
}

function money(n: number, currency: string): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${currency}${fixed}`;
}

function buildTip(query: string): GadgetResult {
  const d = parseTip(query);
  const pct = d.tipPercent ?? 15;
  const assumed = d.tipPercent == null;
  const amounts = tipAmounts({
    total: d.total ?? 0,
    tipPercent: pct,
    people: d.people,
  });
  const cur = d.currency;
  const rows = [
    { label: "Bill", value: money(d.total ?? 0, cur) },
    {
      label: assumed ? `Tip (${pct}% assumed)` : `Tip (${pct}%)`,
      value: money(amounts.tip, cur),
    },
    { label: "Total", value: money(amounts.grand, cur), bold: true },
  ];
  if (amounts.each != null) {
    rows.push({ label: "Each", value: money(amounts.each, cur) });
  }
  const copyText = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
  return {
    intent: "tip",
    query,
    title: "Tip calculator",
    badge: `${pct}%`,
    amount: money(amounts.tip, cur),
    meta: d.total != null ? "Ready" : "Add a bill amount",
    rows,
    lines: rows.map((r) => `${r.label}: ${r.value}`),
    ready: d.total != null && d.total > 0,
    copyText,
  };
}

function buildSplit(query: string): GadgetResult {
  const d = parseSplit(query);
  const people = d.people && d.people > 0 ? d.people : null;
  const each =
    d.total != null && people
      ? Math.round((d.total / people) * 100) / 100
      : null;
  const cur = d.currency;
  const rows = [
    { label: "Total", value: money(d.total ?? 0, cur) },
    { label: "People", value: people ? String(people) : "—" },
    {
      label: "Each",
      value: each != null ? money(each, cur) : "—",
      bold: true,
    },
  ];
  return {
    intent: "split",
    query,
    title: "Split bill",
    badge: people ? `${people} ways` : undefined,
    amount: each != null ? money(each, cur) : undefined,
    meta: each != null ? "Ready" : "Add total and people",
    rows,
    lines: rows.map((r) => `${r.label}: ${r.value}`),
    ready: each != null,
    copyText: rows.map((r) => `${r.label}: ${r.value}`).join("\n"),
  };
}

function buildConvert(query: string): GadgetResult {
  const d = parseConvert(query);
  const fromLabel = d.from ? UNIT_LABELS[d.from] ?? d.from : "?";
  const toLabel = d.to ? UNIT_LABELS[d.to] ?? d.to : "?";
  const resultStr =
    d.result != null
      ? Number.isInteger(d.result)
        ? String(d.result)
        : d.result.toFixed(4).replace(/\.?0+$/, "")
      : "—";
  const rows = [
    {
      label: "From",
      value: d.value != null ? `${d.value} ${fromLabel}` : "—",
    },
    { label: "To", value: `${resultStr} ${toLabel}`, bold: true },
  ];
  return {
    intent: "convert",
    query,
    title: "Unit convert",
    badge: d.from && d.to ? `${fromLabel}→${toLabel}` : undefined,
    amount: d.result != null ? `${resultStr} ${toLabel}` : undefined,
    meta: d.result != null ? "Ready" : "Try “10 km to mi”",
    rows,
    lines: rows.map((r) => `${r.label}: ${r.value}`),
    ready: d.result != null,
    copyText:
      d.value != null && d.result != null
        ? `${d.value} ${fromLabel} = ${resultStr} ${toLabel}`
        : rows.map((r) => `${r.label}: ${r.value}`).join("\n"),
  };
}

function buildTimer(query: string): GadgetResult {
  const d = parseTimer(query);
  const clock = d.seconds != null ? formatClock(d.seconds) : "—";
  const rows = [
    { label: "Duration", value: clock, bold: true },
    { label: "Label", value: d.label || "Timer" },
  ];
  return {
    intent: "timer",
    query,
    title: "Timer",
    badge: d.seconds != null ? clock : undefined,
    amount: clock,
    meta: d.seconds != null ? "Ready" : "Try “25 min focus”",
    rows,
    lines: rows.map((r) => `${r.label}: ${r.value}`),
    ready: d.seconds != null && d.seconds > 0,
    copyText: `${d.label || "Timer"} ${clock}`.trim(),
    timerSeconds: d.seconds,
    timerLabel: d.label || "Timer",
  };
}

function emptyRtcfc(): RtcfcData {
  return { role: "", task: "", context: "", format: "", constraints: "" };
}

export function gadgetFromRtcfc(data: RtcfcData, query = ""): GadgetResult {
  const filled = RTCFC_FIELDS.filter((k) => (data[k] || "").trim()).length;
  const composed = composeRtcfc(data);
  const q = String(query || composed).trim() || composed;
  return {
    intent: "rtcfc",
    query: q,
    title: "RTCFC",
    badge: filled ? `${filled}/5` : undefined,
    meta: filled ? `${filled}/5 fields` : "Needs structure",
    rows: RTCFC_FIELDS.map((k) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      value: data[k] || "—",
      bold: k === "task",
    })),
    lines: composed.split("\n"),
    ready: filled > 0,
    copyText: composed,
    needsStructure: filled === 0 && Boolean(rtcfcSourceBody(q)),
    rtcfc: { ...data },
  };
}

function buildRtcfc(query: string): GadgetResult {
  const data = parseRtcfc(query);
  const filled = RTCFC_FIELDS.filter((k) => data[k].trim()).length;
  if (filled > 0) return gadgetFromRtcfc(data, query);
  const body = rtcfcSourceBody(query);
  if (body) {
    return {
      ...gadgetFromRtcfc(emptyRtcfc(), query),
      needsStructure: true,
      ready: false,
      lines: [
        "Freeform prompt — Structure to fill Role / Task / Context / Format / Constraints.",
        "",
        body.slice(0, 400),
      ],
      meta: "Needs structure",
      copyText: body,
    };
  }
  const rolled = rollRtcfc();
  return gadgetFromRtcfc(rolled, composeRtcfc(rolled));
}

export function rollRtcfcGadget(exclude?: RtcfcData): GadgetResult {
  const rolled = rollRtcfc(Math.random, exclude);
  return gadgetFromRtcfc(rolled, composeRtcfc(rolled));
}

export {
  composeRtcfc,
  parseRtcfc,
  rollRtcfc,
  rtcfcSourceBody,
  RTCFC_FIELDS,
  type RtcfcData,
};
