"use client";

import type { ReactNode } from "react";
import { Field, Meta } from "./shared";

/** Shared layout for decision/review cards: evidence + suggestion + optional actions. */
export function DecisionShell({
  evidence,
  suggestion,
  meta,
  actions,
}: {
  evidence: ReactNode;
  suggestion: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field index={0} className="flex flex-col gap-1.5">
        {suggestion}
        {meta ? <Meta>{meta}</Meta> : null}
      </Field>
      <Field index={1} className="rounded-md bg-secondary/70 px-3 py-2.5 text-[14px] leading-5 text-ink-2">
        {evidence}
      </Field>
      {actions ? <Field index={2}>{actions}</Field> : null}
    </div>
  );
}

export function EvidenceBlock({ label, children }: { label?: string; children: ReactNode }) {
  if (!children) return <span className="text-muted-foreground">Add the source text</span>;
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span> : null}
      <div className="line-clamp-6 text-pretty break-words whitespace-pre-wrap">{children}</div>
    </div>
  );
}
