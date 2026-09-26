"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { formatAmount } from "@shapeshift/core/parse/common";
import { tipAmounts, type TipData } from "@shapeshift/core/parse/tip";
import { AnimatedNumber, Field, HeroNumber, Meta } from "./shared";
import type { CardProps } from "./types";

export function TipCard({ data, interactive }: CardProps<TipData>) {
  const [people, setPeople] = useState<number | null>(null);
  const [total, setTotal] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  const [prev, setPrev] = useState(data);
  if (prev.total !== data.total || prev.people !== data.people || prev.tipPercent !== data.tipPercent) {
    setPrev(data);
    setPeople(null);
    setTotal(null);
    setPercent(null);
  }

  const n = people ?? data.people;
  const amount = total !== null ? Number(total.replace(/,/g, "")) || 0 : (data.total ?? 0);
  const pct = percent ?? data.tipPercent ?? 0;
  const { tip, grand, each } = tipAmounts({ total: amount, tipPercent: pct, people: n });

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-3">
        <Field index={0} className="flex flex-col gap-1">
          <Meta>Bill</Meta>
          <div className="relative w-36">
            <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">
              {data.currency}
            </span>
            <Input
              inputMode="decimal"
              disabled={!interactive}
              aria-label="Bill total"
              placeholder="0"
              className="h-9 ps-7 text-base tabular-nums sm:text-[15px]"
              value={total ?? (data.total !== null ? String(data.total) : "")}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
        </Field>
        <Field index={1} className="flex flex-col gap-1">
          <Meta>Tip</Meta>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Lower tip"
              disabled={!interactive || pct <= 0}
              onClick={() => setPercent(Math.max(0, pct - 1))}
            >
              <Minus />
            </Button>
            <span className="w-12 text-center text-[17px] font-[550] tabular-nums">{pct}%</span>
            <Button size="icon-sm" variant="ghost" aria-label="Raise tip" disabled={!interactive || pct >= 100} onClick={() => setPercent(Math.min(100, pct + 1))}>
              <Plus />
            </Button>
          </div>
        </Field>
        <Field index={2} className="flex flex-col gap-1">
          <Meta>People</Meta>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Fewer people"
              disabled={!interactive || (n ?? 1) <= 1}
              onClick={() => setPeople(Math.max(1, (n ?? 1) - 1))}
            >
              <Minus />
            </Button>
            <span className="w-8 text-center text-[17px] font-[550] tabular-nums">{n ?? "—"}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="More people"
              disabled={!interactive || (n ?? 0) >= 99}
              onClick={() => setPeople((n ?? 0) + 1)}
            >
              <Plus />
            </Button>
          </div>
        </Field>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-3 text-end">
        <Field index={3} className="flex flex-col items-end gap-0.5">
          <Meta>Tip</Meta>
          <span className="text-[17px] font-[550] tabular-nums">
            <AnimatedNumber value={tip} format={(v) => formatAmount(v, data.currency)} />
          </span>
        </Field>
        <Field index={4} className="flex flex-col items-end gap-1">
          <Meta>{each !== null ? "Each pays" : "Total with tip"}</Meta>
          <HeroNumber>
            <AnimatedNumber value={each ?? grand} format={(v) => formatAmount(v, data.currency)} />
          </HeroNumber>
        </Field>
      </div>
    </div>
  );
}
