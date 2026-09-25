"use client";

import { Flag, ShieldCheck } from "lucide-react";
import type { ModerateData } from "@/lib/parse/moderate";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { Chip, Missing } from "./shared";
import type { CardProps } from "./types";

export function ModerateCard({ data, signals }: CardProps<ModerateData>) {
  const flagged = signals.needsModeration;

  return (
    <DecisionShell
      suggestion={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] leading-6 font-[550]">{flagged ? "Flag for moderator" : "Looks clear"}</h2>
          <Chip icon={flagged ? Flag : ShieldCheck} className={flagged ? "bg-caution/8 text-caution-text" : undefined}>
            {flagged ? "Flagged" : "Clear"}
          </Chip>
        </div>
      }
      meta={data.policy ? `Policy: ${data.policy}` : "Based on content and policy criteria"}
      evidence={
        data.content ? (
          <EvidenceBlock label="Content">
            {[data.content, data.context].filter(Boolean).join("\n\n")}
          </EvidenceBlock>
        ) : (
          <Missing>Paste the content to review</Missing>
        )
      }
    />
  );
}
