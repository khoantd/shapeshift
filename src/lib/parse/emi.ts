import { type Currency, detectCurrency, toNumber } from "./common";

export type EmiData = {
  principal: number | null;
  annualRate: number | null;
  tenureMonths: number | null;
  currency: Currency;
};

const RATE_RE = /\b(\d+(?:\.\d+)?)\s*(?:%|percent|pct)/i;
const TENURE_RE = /\b(\d+(?:\.\d+)?)\s*(years?|yrs?|y|months?|mos?|m)\b/i;
const PRINCIPAL_RE =
  /(?:₹|rs\.?|inr|\$|€|£)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|lakhs|lacs|crore|crores|k)?\b/i;

function scalePrincipal(n: number, suffix: string | undefined): number {
  if (!suffix) return n;
  const s = suffix.toLowerCase();
  if (s.startsWith("lakh") || s.startsWith("lac")) return n * 100_000;
  if (s.startsWith("crore")) return n * 10_000_000;
  if (s === "k") return n * 1000;
  return n;
}

export function parseEmi(text: string): EmiData {
  let rest = text;
  let annualRate: number | null = null;
  let tenureMonths: number | null = null;
  let principal: number | null = null;

  const rate = rest.match(RATE_RE);
  if (rate) {
    annualRate = Number(rate[1]);
    rest = rest.replace(rate[0], " ");
  }

  const tenure = rest.match(TENURE_RE);
  if (tenure) {
    const n = Number(tenure[1]);
    const unit = tenure[2].toLowerCase();
    tenureMonths = /^(years?|yrs?|y)$/.test(unit) ? Math.round(n * 12) : Math.round(n);
    rest = rest.replace(tenure[0], " ");
  }

  rest = rest.replace(/\b(emi|loan|mortgage|finance|financing|installment|instalment|for|on|at|of|a|an|the|monthly)\b/gi, " ");

  const p = rest.match(PRINCIPAL_RE);
  if (p) {
    principal = scalePrincipal(toNumber(p[1]), p[2]);
  }

  return {
    principal: principal !== null && Number.isFinite(principal) && principal > 0 ? principal : null,
    annualRate: annualRate !== null && Number.isFinite(annualRate) && annualRate >= 0 ? annualRate : null,
    tenureMonths: tenureMonths !== null && tenureMonths > 0 ? tenureMonths : null,
    currency: detectCurrency(text),
  };
}

export function completeEmi(d: EmiData) {
  return (d.principal ? 0.4 : 0) + (d.annualRate !== null ? 0.3 : 0) + (d.tenureMonths ? 0.3 : 0);
}

/** Reducing-balance EMI. Returns null if inputs incomplete. */
export function emiAmounts(d: Pick<EmiData, "principal" | "annualRate" | "tenureMonths">) {
  const { principal: P, annualRate, tenureMonths: n } = d;
  if (!P || annualRate === null || !n) return { monthly: null as number | null, totalInterest: null as number | null, totalPayment: null as number | null };

  if (annualRate === 0) {
    const monthly = P / n;
    return { monthly, totalInterest: 0, totalPayment: P };
  }

  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, n);
  const monthly = (P * r * factor) / (factor - 1);
  const totalPayment = monthly * n;
  const totalInterest = totalPayment - P;
  return { monthly, totalInterest, totalPayment };
}
