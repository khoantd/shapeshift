"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { type Currency, formatAmount } from "@shapeshift/core/parse/common";
import { emiAmounts, type EmiData } from "@shapeshift/core/parse/emi";
import { AnimatedNumber, Field, HeroNumber, Meta } from "./shared";
import type { CardProps } from "./types";

const EMI_CURRENCIES = [
  { value: "₫" as const, label: "VND" },
  { value: "$" as const, label: "USD" },
];

function emiCurrency(c: Currency): "₫" | "$" {
  return c === "$" ? "$" : "₫";
}

export function EmiCard({ data, interactive }: CardProps<EmiData>) {
  const [principal, setPrincipal] = useState<string | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [months, setMonths] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"₫" | "$" | null>(null);

  const [prev, setPrev] = useState(data);
  if (
    prev.principal !== data.principal ||
    prev.annualRate !== data.annualRate ||
    prev.tenureMonths !== data.tenureMonths ||
    prev.currency !== data.currency
  ) {
    setPrev(data);
    setPrincipal(null);
    setRate(null);
    setMonths(null);
    setCurrency(null);
  }

  const P = principal !== null ? Number(principal.replace(/,/g, "")) || 0 : (data.principal ?? 0);
  const annualRate = rate !== null ? Number(rate) || 0 : (data.annualRate ?? 0);
  const tenureMonths = months !== null ? Number(months) || 0 : (data.tenureMonths ?? 0);
  const activeCurrency = currency ?? emiCurrency(data.currency);
  const { monthly, totalInterest } = emiAmounts({
    principal: P || null,
    annualRate: rate !== null || data.annualRate !== null ? annualRate : null,
    tenureMonths: tenureMonths || null,
  });

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-3">
        <Field index={0} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Meta>Principal</Meta>
            <Select
              value={activeCurrency}
              onValueChange={(v) => setCurrency(v as "₫" | "$")}
              disabled={!interactive}
            >
              <SelectTrigger
                size="sm"
                aria-label="Currency"
                className="h-7 w-fit gap-1 border-none bg-secondary px-2.5 text-[13px] font-medium text-ink-2 shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMI_CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-40">
            <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">
              {activeCurrency}
            </span>
            <Input
              inputMode="decimal"
              disabled={!interactive}
              aria-label="Loan principal"
              placeholder="0"
              className="h-9 ps-7 text-base tabular-nums sm:text-[15px]"
              value={principal ?? (data.principal !== null ? String(data.principal) : "")}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </div>
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field index={1} className="flex flex-col gap-1">
            <Meta>Rate / yr</Meta>
            <div className="relative w-24">
              <Input
                inputMode="decimal"
                disabled={!interactive}
                aria-label="Annual interest rate"
                placeholder="0"
                className="h-9 pe-7 text-base tabular-nums sm:text-[15px]"
                value={rate ?? (data.annualRate !== null ? String(data.annualRate) : "")}
                onChange={(e) => setRate(e.target.value)}
              />
              <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                %
              </span>
            </div>
          </Field>
          <Field index={2} className="flex flex-col gap-1">
            <Meta>Tenure</Meta>
            <div className="relative w-28">
              <Input
                inputMode="numeric"
                disabled={!interactive}
                aria-label="Tenure in months"
                placeholder="0"
                className="h-9 pe-12 text-base tabular-nums sm:text-[15px]"
                value={months ?? (data.tenureMonths !== null ? String(data.tenureMonths) : "")}
                onChange={(e) => setMonths(e.target.value)}
              />
              <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                mo
              </span>
            </div>
          </Field>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-3 text-end">
        <Field index={3} className="flex flex-col items-end gap-0.5">
          <Meta>Total interest</Meta>
          <span className="text-[17px] font-[550] tabular-nums">
            {totalInterest !== null ? (
              <AnimatedNumber value={totalInterest} format={(v) => formatAmount(v, activeCurrency)} />
            ) : (
              "—"
            )}
          </span>
        </Field>
        <Field index={4} className="flex flex-col items-end gap-1">
          <Meta>Monthly EMI</Meta>
          <HeroNumber>
            {monthly !== null ? (
              <AnimatedNumber value={monthly} format={(v) => formatAmount(v, activeCurrency)} />
            ) : (
              "—"
            )}
          </HeroNumber>
        </Field>
      </div>
    </div>
  );
}
