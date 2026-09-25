"use client";

import type { ModerateData } from "@/lib/parse/moderate";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { Missing } from "./shared";
import type { CardProps } from "./types";

export function ModerateCard({ data, signals }: CardProps<ModerateData>) {
  const flagged = signals.needsModeration;

  return (
    <DecisionShell
      suggestion={
        <h2 className="text-[17px] leading-6 font-[550]">{flagged ? "Flag for moderator" : "Looks clear"}</h2>
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
