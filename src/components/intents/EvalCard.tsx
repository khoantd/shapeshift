"use client";

import type { EvalData } from "@/lib/parse/eval";
import { qualityLabel } from "@/lib/parse/priority";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { HeroNumber, Missing } from "./shared";
import type { CardProps } from "./types";

export function EvalCard({ data, signals }: CardProps<EvalData>) {
  const score = signals.answerQuality;
  const revise = signals.needsRevision || score < 0.75;
  const label = qualityLabel(score);

  return (
    <DecisionShell
      suggestion={
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[17px] leading-6 font-[550]">{revise ? "Request revision" : "Pass"}</h2>
          <HeroNumber className="text-[22px]">{label}</HeroNumber>
        </div>
      }
      meta={revise ? "Answer looks weak against the request or references" : "Answer looks grounded enough to accept"}
      evidence={
        data.request || data.answer ? (
          <div className="flex flex-col gap-2.5">
            {data.request ? <EvidenceBlock label="Request">{data.request}</EvidenceBlock> : null}
            {data.answer ? <EvidenceBlock label="Answer">{data.answer}</EvidenceBlock> : null}
            {data.reference ? <EvidenceBlock label="Reference">{data.reference}</EvidenceBlock> : null}
          </div>
        ) : (
          <Missing>Add Request:, Answer:, and optional Reference:</Missing>
        )
      }
    />
  );
}
