/**
 * In-sidebar Quick Gadgets — tip, split, convert, timer, rtcfc.
 * Lightweight parsers (no @shapeshift/core) so the add-on stays dependency-free.
 */

/** @typedef {"tip" | "split" | "convert" | "timer" | "rtcfc"} QuickGadgetIntent */

/** @typedef {{ role: string, task: string, context: string, format: string, constraints: string }} RtcfcData */

/** @type {ReadonlyArray<keyof RtcfcData>} */
export const RTCFC_FIELDS = ["role", "task", "context", "format", "constraints"];

/** @type {ReadonlySet<QuickGadgetIntent>} */
export const QUICK_GADGET_INTENTS = new Set([
  "tip",
  "split",
  "convert",
  "timer",
  "rtcfc",
]);

const RTCFC_EXAMPLE =
  "Role: staff engineer. Task: review this PR for correctness and security risks. Context: NestJS monorepo. Format: Markdown severity table P0–P3. Constraints: Skip style nits.";

/** @type {Record<QuickGadgetIntent, string>} */
const EXAMPLE_SEEDS = {
  tip: "tip 18% on $90",
  split: "split $40 for 3",
  convert: "10 km to mi",
  timer: "25 min focus",
  rtcfc: RTCFC_EXAMPLE,
};

/** @type {ReadonlyArray<RtcfcData>} */
const RTCFC_SAMPLES = [
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
];

const RTCFC_LABEL_RE =
  /(?:\*\*)?(Role|Task|Context|Format|Constraints)(?:\*\*)?\s*:\s*/gi;

const WORD_NUM = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const TIP_PCT_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:%|percent|pct)\s*(?:tip|gratuity)?\b|\b(?:tip|gratuity|service\s*charge)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:%|percent|pct)?\b/i;

const PEOPLE_RE =
  /\b(?:for|between|among|amongst|with|by|into)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*(?:people|persons|friends|of us|ways))?/i;
const PEOPLE_RE_ALT =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(?:ways|people|persons|friends|of us)\b/i;

const AMOUNT_RE = /(?:₹|rs\.?|inr|\$|€|£|₫)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k\b)?/i;

/** @type {Record<string, string>} */
const UNIT_ALIASES = {
  km: "km",
  kms: "km",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  kilometres: "km",
  mi: "mi",
  mile: "mi",
  miles: "mi",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  cm: "cm",
  ft: "ft",
  foot: "ft",
  feet: "ft",
  in: "in",
  inch: "in",
  inches: "in",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  c: "C",
  "°c": "C",
  celsius: "C",
  f: "F",
  "°f": "F",
  fahrenheit: "F",
};

/** @type {Record<string, string>} */
const DEFAULT_TARGET = {
  km: "mi",
  mi: "km",
  m: "ft",
  cm: "in",
  ft: "m",
  in: "cm",
  kg: "lb",
  g: "oz",
  lb: "kg",
  oz: "g",
  C: "F",
  F: "C",
};

/**
 * Common unit conversions (no convert-units dependency).
 * @type {Record<string, Record<string, (n: number) => number>>}
 */
const CONVERT_FN = {
  km: { mi: (n) => n * 0.621371, m: (n) => n * 1000 },
  mi: { km: (n) => n / 0.621371, m: (n) => n * 1609.344 },
  m: { ft: (n) => n * 3.28084, km: (n) => n / 1000 },
  ft: { m: (n) => n / 3.28084 },
  cm: { in: (n) => n / 2.54 },
  in: { cm: (n) => n * 2.54 },
  kg: { lb: (n) => n * 2.20462 },
  lb: { kg: (n) => n / 2.20462 },
  g: { oz: (n) => n / 28.3495 },
  oz: { g: (n) => n * 28.3495 },
  C: { F: (n) => (n * 9) / 5 + 32 },
  F: { C: (n) => ((n - 32) * 5) / 9 },
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const FULL_CONVERT_RE = new RegExp(
  `(-?\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\s+(?:to|in|into|as|=|->)\\s*(${UNIT_PATTERN})(?![a-z])`,
  "i",
);
const PART_CONVERT_RE = new RegExp(
  `(-?\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})(?![a-z])`,
  "i",
);

/**
 * @param {QuickGadgetIntent} intent
 */
export function exampleSeed(intent) {
  return EXAMPLE_SEEDS[intent] || EXAMPLE_SEEDS.tip;
}

/**
 * @param {string} intent
 * @returns {intent is QuickGadgetIntent}
 */
export function isQuickGadgetIntent(intent) {
  return QUICK_GADGET_INTENTS.has(/** @type {QuickGadgetIntent} */ (intent));
}

/**
 * @param {number} total
 */
export function formatClock(total) {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Resolve tip / split / convert / timer / rtcfc for in-sidebar Quick Gadgets.
 * @param {string} text
 * @param {QuickGadgetIntent | null} [preferredIntent]
 * @returns {{
 *   kind: "gadget",
 *   intent: QuickGadgetIntent,
 *   query: string,
 *   title: string,
 *   meta: string,
 *   lines: string[],
 *   ready: boolean,
 *   assumedTipPercent?: boolean,
 *   timerSeconds?: number | null,
 *   timerLabel?: string,
 *   rtcfc?: RtcfcData,
 *   needsStructure?: boolean,
 * } | null}
 */
export function resolveQuickGadget(text, preferredIntent = null) {
  let query = String(text || "").trim();
  /** @type {QuickGadgetIntent | null} */
  let preferred = isQuickGadgetIntent(preferredIntent || "")
    ? /** @type {QuickGadgetIntent} */ (preferredIntent)
    : null;

  if (!query && preferred) {
    query = exampleSeed(preferred);
  }
  if (!query) return null;

  const intent = preferred || detectQuickIntent(query);
  if (!intent) return null;

  if (intent === "tip") return buildTip(query);
  if (intent === "split") return buildSplit(query);
  if (intent === "convert") return buildConvert(query);
  if (intent === "timer") return buildTimer(query);
  if (intent === "rtcfc") return buildRtcfc(query);
  return null;
}

/** @returns {RtcfcData} */
function emptyRtcfc() {
  return { role: "", task: "", context: "", format: "", constraints: "" };
}

/**
 * @param {string} text
 */
export function rtcfcSourceBody(text) {
  return String(text || "")
    .replace(/\brtcfc\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {RtcfcData} d
 */
export function composeRtcfc(d) {
  return RTCFC_FIELDS.map(
    (k) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${d[k] || ""}`,
  ).join("\n");
}

/**
 * @param {string} text
 * @returns {RtcfcData}
 */
export function parseRtcfc(text) {
  /** @type {RtcfcData} */
  const data = emptyRtcfc();
  const raw = rtcfcSourceBody(text);
  if (!raw) return data;

  const matches = [...raw.matchAll(RTCFC_LABEL_RE)];
  if (!matches.length) return data;

  /** @type {Record<string, keyof RtcfcData>} */
  const labelToField = {
    role: "role",
    task: "task",
    context: "context",
    format: "format",
    constraints: "constraints",
  };

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const field = labelToField[m[1].toLowerCase()];
    if (!field) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    data[field] = raw
      .slice(start, end)
      .replace(/^[.;]\s*/, "")
      .replace(/\s*[.;]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return data;
}

/**
 * @param {RtcfcData} [exclude]
 * @returns {RtcfcData}
 */
export function rollRtcfc(exclude) {
  const pool =
    exclude && RTCFC_SAMPLES.length > 1
      ? RTCFC_SAMPLES.filter(
          (s) => !RTCFC_FIELDS.every((k) => s[k] === exclude[k]),
        )
      : RTCFC_SAMPLES;
  return { ...(pool[Math.floor(Math.random() * pool.length)] || RTCFC_SAMPLES[0]) };
}

/**
 * @param {string} query
 * @param {RtcfcData} data
 */
export function needsRtcfcStructure(query, data) {
  const body = rtcfcSourceBody(query);
  if (!body) return false;
  const filled = RTCFC_FIELDS.filter((k) => (data[k] || "").trim()).length;
  return filled === 0;
}

/**
 * @param {RtcfcData} data
 * @param {string} [query]
 */
export function gadgetFromRtcfc(data, query = "") {
  const filled = RTCFC_FIELDS.filter((k) => (data[k] || "").trim()).length;
  const composed = composeRtcfc(data);
  const q = String(query || composed).trim() || composed;
  return {
    kind: /** @type {const} */ ("gadget"),
    intent: /** @type {const} */ ("rtcfc"),
    query: q,
    title: "RTCFC",
    meta: filled ? `${filled}/5 fields` : "Needs structure",
    lines: composed.split("\n"),
    ready: filled > 0,
    needsStructure: filled === 0 && Boolean(rtcfcSourceBody(q)),
    rtcfc: { ...data },
  };
}

/**
 * @param {string} query
 */
function buildRtcfc(query) {
  const data = parseRtcfc(query);
  const filled = RTCFC_FIELDS.filter((k) => data[k].trim()).length;
  if (filled > 0) {
    return gadgetFromRtcfc(data, query);
  }
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
    };
  }
  const rolled = rollRtcfc();
  return gadgetFromRtcfc(rolled, composeRtcfc(rolled));
}

/**
 * @param {string} text
 * @returns {QuickGadgetIntent | null}
 */
function detectQuickIntent(text) {
  const t = text.toLowerCase();
  /** @type {Partial<Record<QuickGadgetIntent, number>>} */
  const scores = {};

  if (TIP_PCT_RE.test(text) || /\b(tip|gratuity|service\s*charge)\b/i.test(text)) {
    scores.tip = (scores.tip || 0) + 6;
  }
  if (/^\s*[\d,]+\.?\d*\s*$/.test(text) || /^\$\s*[\d,]+\.?\d*\s*$/.test(text)) {
    scores.tip = (scores.tip || 0) + 4;
  }

  if (/\bsplit\b/i.test(text) || PEOPLE_RE.test(text) || PEOPLE_RE_ALT.test(text)) {
    scores.split = (scores.split || 0) + 5;
  }
  if (/\bsplit\b/i.test(text) && findAmount(text)) {
    scores.split = (scores.split || 0) + 3;
  }

  if (
    /\b(timer|countdown|stopwatch|pomodoro)\b/i.test(text) ||
    /\b\d+\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/i.test(
      text,
    )
  ) {
    scores.timer = (scores.timer || 0) + 6;
  }
  if (/\b(focus|break|rest|nap|deep work)\b/i.test(text) && /\d/.test(text)) {
    scores.timer = (scores.timer || 0) + 3;
  }

  if (FULL_CONVERT_RE.test(t) || PART_CONVERT_RE.test(t)) {
    scores.convert = (scores.convert || 0) + 7;
  }

  if (/\brtcfc\b/i.test(text)) {
    scores.rtcfc = (scores.rtcfc || 0) + 7;
  }
  const rtcfcLabels = (text.match(/\b(role|task|context|format|constraints)\s*:/gi) ?? [])
    .length;
  if (rtcfcLabels >= 4) scores.rtcfc = (scores.rtcfc || 0) + 7;
  else if (rtcfcLabels >= 2) scores.rtcfc = (scores.rtcfc || 0) + 5.5;
  else if (rtcfcLabels === 1) scores.rtcfc = (scores.rtcfc || 0) + 2.5;

  /** @type {QuickGadgetIntent | null} */
  let best = null;
  let bestScore = 0;
  for (const intent of QUICK_GADGET_INTENTS) {
    const s = scores[intent] || 0;
    if (s > bestScore) {
      bestScore = s;
      best = intent;
    }
  }
  return bestScore >= 4 ? best : null;
}

/**
 * @param {string} text
 */
function detectCurrency(text) {
  if (/\$|\busd\b|dollars?\b/i.test(text)) return "$";
  if (/€|\beur(os?)?\b/i.test(text)) return "€";
  if (/£|\bgbp\b/i.test(text)) return "£";
  if (/₫|\bvnd\b|đồng|\bdong\b/i.test(text)) return "₫";
  if (/₹|\binr\b|\brs\.?\b/i.test(text)) return "₹";
  return "$";
}

/**
 * @param {string} text
 */
function findAmount(text) {
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m;
  while ((m = re.exec(text))) {
    const n = Number(String(m[1]).replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    return { value: m[2] ? n * 1000 : n };
  }
  return null;
}

/**
 * @param {number} n
 * @param {string} currency
 */
function formatAmount(n, currency) {
  if (currency === "₫") {
    return currency + Math.round(n).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  }
  const locale = currency === "₹" ? "en-IN" : "en-US";
  const rounded = Math.round(n * 100) / 100;
  return (
    currency +
    rounded.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * @param {string} text
 */
function parsePeople(text) {
  const n = text.match(PEOPLE_RE) ?? text.match(PEOPLE_RE_ALT);
  if (!n) return null;
  const key = n[1].toLowerCase();
  const people = WORD_NUM[key] ?? Number(n[1]);
  return people > 0 ? people : null;
}

/**
 * @param {string} query
 */
function buildTip(query) {
  let rest = query;
  let tipPercent = null;
  let assumedTipPercent = false;
  const pct = rest.match(TIP_PCT_RE);
  if (pct) {
    tipPercent = Number(pct[1] ?? pct[2]);
    if (!Number.isFinite(tipPercent)) tipPercent = null;
    rest = rest.replace(pct[0], " ");
  }
  const people = parsePeople(rest);
  if (people) {
    const hit = rest.match(PEOPLE_RE) ?? rest.match(PEOPLE_RE_ALT);
    if (hit) rest = rest.replace(hit[0], " ");
  }
  rest = rest.replace(
    /\b(?:tip|gratuity|service\s*charge|add|a|an|the|on|to|bill|check)\b/gi,
    " ",
  );
  const amount = findAmount(rest);
  const total = amount?.value ?? null;
  const currency = detectCurrency(query);

  if (tipPercent === null && total !== null) {
    tipPercent = 15;
    assumedTipPercent = true;
  }

  const tip = Math.round((total ?? 0) * (tipPercent ?? 0)) / 100;
  const grand = Math.round(((total ?? 0) + tip) * 100) / 100;
  const each =
    people && people > 0 ? Math.round((grand / people) * 100) / 100 : null;
  const ready = total !== null && tipPercent !== null;

  /** @type {string[]} */
  const lines = [];
  if (ready) {
    lines.push(`Tip (${tipPercent}%): ${formatAmount(tip, currency)}`);
    lines.push(`Total: ${formatAmount(grand, currency)}`);
    if (each !== null) lines.push(`Each (${people}): ${formatAmount(each, currency)}`);
    if (assumedTipPercent) lines.push("Assumed 15% tip — add e.g. tip 18% to override.");
  } else {
    lines.push("Add a bill amount and tip % (e.g. tip 18% on $90).");
  }

  return {
    kind: /** @type {const} */ ("gadget"),
    intent: /** @type {const} */ ("tip"),
    query,
    title: "Tip",
    meta: ready
      ? `${formatAmount(total ?? 0, currency)} · ${tipPercent}%`
      : query,
    lines,
    ready,
    assumedTipPercent,
  };
}

/**
 * @param {string} query
 */
function buildSplit(query) {
  let rest = query;
  let people = parsePeople(rest);
  if (people) {
    const hit = rest.match(PEOPLE_RE) ?? rest.match(PEOPLE_RE_ALT);
    if (hit) rest = rest.replace(hit[0], " ");
  } else {
    const names = rest.match(/\b(?:between|among|with)\s+(.+)$/i);
    if (names) {
      const parts = names[1]
        .split(/\s*(?:,|&|\band\b)\s*/i)
        .filter((p) => /[a-z]/i.test(p));
      if (parts.length >= 2) people = parts.length;
      else if (parts.length === 1 && !/\d/.test(parts[0])) people = 2;
      rest = rest.replace(names[0], " ");
    }
  }
  rest = rest.replace(/\b(?:split|bill|check|the|a|an)\b/gi, " ");
  const amount = findAmount(rest);
  const total = amount?.value ?? null;
  const currency = detectCurrency(query);
  const ready = total !== null && people !== null && people > 0;
  const each = ready ? Math.round((total / people) * 100) / 100 : null;

  /** @type {string[]} */
  const lines = [];
  if (ready && each !== null) {
    lines.push(`Total: ${formatAmount(total, currency)}`);
    lines.push(`People: ${people}`);
    lines.push(`Each: ${formatAmount(each, currency)}`);
  } else {
    lines.push("Add total and people (e.g. split $40 for 3).");
  }

  return {
    kind: /** @type {const} */ ("gadget"),
    intent: /** @type {const} */ ("split"),
    query,
    title: "Split",
    meta: ready ? `${formatAmount(total ?? 0, currency)} ÷ ${people}` : query,
    lines,
    ready,
  };
}

/**
 * @param {number} value
 * @param {string} from
 * @param {string} to
 */
function convertValue(value, from, to) {
  if (from === to) return value;
  const fn = CONVERT_FN[from]?.[to];
  if (!fn) return null;
  return fn(value);
}

/**
 * @param {string} query
 */
function buildConvert(query) {
  const t = query.toLowerCase().replace(/degrees?\s+/g, "°").replace(/°\s+/g, "°");
  let value = null;
  let from = null;
  let to = null;
  let result = null;

  const full = t.match(FULL_CONVERT_RE);
  if (full) {
    value = Number(full[1]);
    from = UNIT_ALIASES[full[2].toLowerCase()] || UNIT_ALIASES[full[2]];
    to = UNIT_ALIASES[full[3].toLowerCase()] || UNIT_ALIASES[full[3]];
    if (from && to) result = convertValue(value, from, to);
  } else {
    const part = t.match(PART_CONVERT_RE);
    if (part) {
      value = Number(part[1]);
      from = UNIT_ALIASES[part[2].toLowerCase()] || UNIT_ALIASES[part[2]];
      to = from ? DEFAULT_TARGET[from] ?? null : null;
      if (from && to) result = convertValue(value, from, to);
    }
  }

  const ready = value !== null && from && to && result !== null;
  /** @type {string[]} */
  const lines = [];
  if (ready) {
    const rounded =
      Math.abs(result) >= 100
        ? Math.round(result * 100) / 100
        : Math.round(result * 10000) / 10000;
    lines.push(`${value} ${from} → ${rounded} ${to}`);
  } else {
    lines.push("Add a unit conversion (e.g. 10 km to mi, 70 F).");
  }

  return {
    kind: /** @type {const} */ ("gadget"),
    intent: /** @type {const} */ ("convert"),
    query,
    title: "Convert",
    meta: ready ? `${value} ${from} → ${to}` : query,
    lines,
    ready,
  };
}

/**
 * @param {string} query
 */
function buildTimer(query) {
  let rest = ` ${query.replace(/\s+/g, " ").trim().toLowerCase()} `;
  let seconds = 0;
  let found = false;

  /** @type {[RegExp, number][]} */
  const special = [
    [/\bpomodoro\b/, 25 * 60],
    [/\bhalf an? hour\b/, 30 * 60],
    [/\ban? hour\b/, 60 * 60],
    [/\ba minute\b/, 60],
  ];
  for (const [re, s] of special) {
    if (re.test(rest)) {
      seconds += s;
      found = true;
      if (re.source !== "\\bpomodoro\\b") rest = rest.replace(re, " ");
    }
  }

  const UNIT = { h: 3600, m: 60, s: 1 };
  rest = rest.replace(
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g,
    (_, n, u) => {
      seconds += Number(n) * UNIT[u[0]];
      found = true;
      return " ";
    },
  );

  rest = rest.replace(/\b(\d{1,2}):(\d{2})\b/, (_, m, s) => {
    seconds += Number(m) * 60 + Number(s);
    found = true;
    return " ";
  });

  const label = rest
    .replace(/\b(?:timer|set|start|a|for|countdown|of|focus|break|rest|nap)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const timerSeconds = found ? Math.round(seconds) : null;
  const ready = timerSeconds !== null && timerSeconds > 0;

  /** @type {string[]} */
  const lines = [];
  if (ready) {
    lines.push(`Duration: ${formatClock(timerSeconds)}`);
    if (label) lines.push(`Label: ${label.charAt(0).toUpperCase()}${label.slice(1)}`);
    lines.push("Press Start to run the timer in this sidebar.");
  } else {
    lines.push("Add a duration (e.g. 25 min focus, timer 10).");
  }

  return {
    kind: /** @type {const} */ ("gadget"),
    intent: /** @type {const} */ ("timer"),
    query,
    title: label ? `Timer · ${label.charAt(0).toUpperCase()}${label.slice(1)}` : "Timer",
    meta: ready ? formatClock(timerSeconds) : query,
    lines,
    ready,
    timerSeconds,
    timerLabel: label,
  };
}
