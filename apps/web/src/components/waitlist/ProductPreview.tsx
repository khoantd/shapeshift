"use client";

import { Check } from "lucide-react";

/** Static product mock: calm input morphing into an event card. */
export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="ml-3 text-[11px] text-muted-foreground">shapeshift — input</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-border/80 bg-background px-4 py-3 shadow-xs">
          <p className="text-[13px] leading-5 text-muted-foreground">
            dinner with priya friday 8pm on zoom
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Event
              </p>
              <p className="mt-1 text-sm font-medium tracking-tight text-foreground">
                Dinner with Priya
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
              <Check className="size-3" aria-hidden strokeWidth={3} />
              Ready
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Friday", "8:00 PM", "Priya", "Video call"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] text-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
