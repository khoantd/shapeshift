import { type Currency, detectCurrency, findAmount } from "./common";

export type TipData = {
  total: number | null;
  tipPercent: number | null;
  people: number | null;
  currency: Currency;
};

const WORD_NUM: Record<string, number> = {
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

const PCT_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:%|percent|pct)\s*(?:tip|gratuity)?\b|\b(?:tip|gratuity|service\s*charge)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:%|percent|pct)?\b/i;

export function parseTip(text: string): TipData {
  let rest = text;
  let tipPercent: number | null = null;
  let people: number | null = null;

  const pct = rest.match(PCT_RE);
  if (pct) {
    tipPercent = Number(pct[1] ?? pct[2]);
    if (!Number.isFinite(tipPercent)) tipPercent = null;
    rest = rest.replace(pct[0], " ");
  }

  const n =
    rest.match(/\b(?:for|between|among|amongst|with|by|into)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*(?:people|persons|friends|of us|ways))?/i) ??
    rest.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(?:ways|people|persons|friends|of us)\b/i);
  if (n) {
    people = WORD_NUM[n[1].toLowerCase()] ?? Number(n[1]);
    rest = rest.replace(n[0], " ");
  }

  rest = rest.replace(/\b(?:tip|gratuity|service\s*charge|add|a|an|the|on|to|bill|check)\b/gi, " ");
  const amount = findAmount(rest);

  return {
    total: amount?.value ?? null,
    tipPercent: tipPercent !== null && tipPercent >= 0 ? tipPercent : null,
    people: people && people > 0 ? people : null,
    currency: detectCurrency(text),
  };
}

export function completeTip(d: TipData) {
  return (d.total ? 0.5 : 0) + (d.tipPercent !== null ? 0.4 : 0) + (d.people ? 0.1 : 0);
}

export function tipAmounts(d: Pick<TipData, "total" | "tipPercent" | "people">) {
  const total = d.total ?? 0;
  const pct = d.tipPercent ?? 0;
  const tip = Math.round(total * pct) / 100;
  const grand = Math.round((total + tip) * 100) / 100;
  const people = d.people && d.people > 0 ? d.people : null;
  const each = people ? Math.round((grand / people) * 100) / 100 : null;
  return { tip, grand, each };
}
