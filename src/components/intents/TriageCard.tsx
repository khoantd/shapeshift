"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TriageData } from "@/lib/parse/triage";
import { PRIORITY_LABEL, PRIORITY_LEVELS, type PriorityLevel, priorityFromScore } from "@/lib/parse/priority";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { HeroNumber, Missing } from "./shared";
import type { CardProps } from "./types";

export function TriageCard({ data, signals, interactive }: CardProps<TriageData>) {
  const suggested = signals.priorityLevel ?? priorityFromScore(signals.ticketPriority);
  const [picked, setPicked] = useState<PriorityLevel | null>(null);
  const priority = picked ?? suggested;

  const evidence = [data.report || data.title, data.context].filter(Boolean).join("\n\n") || data.title;

  return (
    <DecisionShell
      suggestion={
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {data.title ? <h2 className="text-[17px] leading-6 font-[550] text-pretty break-words">{data.title}</h2> : <Missing>Add a ticket title</Missing>}
            <Select value={priority} onValueChange={(v) => setPicked(v as PriorityLevel)} disabled={!interactive}>
              <SelectTrigger
                size="sm"
                className="h-7 w-fit gap-1 rounded-full border-none bg-secondary px-2.5 text-[13px] font-medium text-ink-2 shadow-none"
                aria-label="Suggested priority"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <HeroNumber className="text-[22px]">{priority.toUpperCase()}</HeroNumber>
        </div>
      }
      meta="Suggested priority from the report"
      evidence={<EvidenceBlock label="Report">{evidence || null}</EvidenceBlock>}
    />
  );
}
