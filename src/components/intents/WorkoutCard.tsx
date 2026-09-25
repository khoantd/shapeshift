"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkoutData } from "@/lib/parse/workout";
import { AnimatedNumber, Field, HeroNumber, Meta, Missing } from "./shared";
import type { CardProps } from "./types";

export function WorkoutCard({ data, interactive }: CardProps<WorkoutData>) {
  const [sets, setSets] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);

  const [prev, setPrev] = useState(data);
  if (prev.exercise !== data.exercise || prev.sets !== data.sets || prev.reps !== data.reps || prev.weight !== data.weight) {
    setPrev(data);
    setSets(null);
    setReps(null);
    setWeight(null);
  }

  const s = sets ?? data.sets;
  const r = reps ?? data.reps;
  const w = weight ?? data.weight;
  const unit = data.unit ?? "kg";

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <Field index={0} className="flex flex-col gap-0.5">
          <Meta>Exercise</Meta>
          {data.exercise ? (
            <h2 className="text-[17px] leading-6 font-[550] text-balance">{data.exercise}</h2>
          ) : (
            <Missing>Name the lift</Missing>
          )}
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field index={1} className="flex flex-col gap-1">
            <Meta>Sets</Meta>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Fewer sets"
                disabled={!interactive || (s ?? 1) <= 1}
                onClick={() => setSets(Math.max(1, (s ?? 1) - 1))}
              >
                <Minus />
              </Button>
              <span className="w-8 text-center text-[17px] font-[550] tabular-nums">{s ?? "—"}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="More sets"
                disabled={!interactive || (s ?? 0) >= 99}
                onClick={() => setSets((s ?? 0) + 1)}
              >
                <Plus />
              </Button>
            </div>
          </Field>
          <Field index={2} className="flex flex-col gap-1">
            <Meta>Reps</Meta>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Fewer reps"
                disabled={!interactive || (r ?? 1) <= 1}
                onClick={() => setReps(Math.max(1, (r ?? 1) - 1))}
              >
                <Minus />
              </Button>
              <span className="w-8 text-center text-[17px] font-[550] tabular-nums">{r ?? "—"}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="More reps"
                disabled={!interactive || (r ?? 0) >= 99}
                onClick={() => setReps((r ?? 0) + 1)}
              >
                <Plus />
              </Button>
            </div>
          </Field>
          {(w !== null || interactive) && (
            <Field index={3} className="flex flex-col gap-1">
              <Meta>Weight</Meta>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Lower weight"
                  disabled={!interactive || (w ?? 0) <= 0}
                  onClick={() => setWeight(Math.max(0, (w ?? 0) - 2.5))}
                >
                  <Minus />
                </Button>
                <span className="min-w-14 text-center text-[17px] font-[550] tabular-nums">
                  {w !== null ? (
                    <>
                      <AnimatedNumber value={w} format={(v) => String(v)} /> {unit}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Raise weight"
                  disabled={!interactive}
                  onClick={() => setWeight((w ?? 0) + 2.5)}
                >
                  <Plus />
                </Button>
              </div>
            </Field>
          )}
        </div>
      </div>
      <Field index={4} className="flex flex-col items-end gap-1 text-end">
        <Meta>Volume</Meta>
        <HeroNumber>
          {s && r ? (
            <>
              {s}×{r}
              {w !== null ? (
                <span className="ms-2 text-[15px] font-normal text-muted-foreground">
                  · <AnimatedNumber value={s * r * w} format={(v) => `${v} ${unit}`} />
                </span>
              ) : null}
            </>
          ) : (
            "—"
          )}
        </HeroNumber>
      </Field>
    </div>
  );
}
