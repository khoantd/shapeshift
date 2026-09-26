"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { ToolApproval } from "@shapeshift/core/jev/types";
import type { ApproveData } from "@shapeshift/core/parse/approve";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { Missing } from "./shared";
import type { CardProps } from "./types";

const LABEL: Record<Exclude<ToolApproval, "unspecified">, string> = {
  allow: "Allow execution",
  pause: "Pause for approval",
};

export function ApproveCard({ data, signals, interactive }: CardProps<ApproveData>) {
  const suggested = signals.toolApproval === "allow" ? "allow" : "pause";
  const [picked, setPicked] = useState<"allow" | "pause" | null>(null);
  const decision = picked ?? suggested;
  const paused = decision === "pause";

  return (
    <DecisionShell
      suggestion={
        <div className="flex min-w-0 flex-col gap-1.5">
          {data.tool ? (
            <h2 className="font-mono text-[17px] leading-6 font-[550] text-pretty break-all">{data.tool}</h2>
          ) : (
            <Missing>Add a tool name</Missing>
          )}
          <Select value={decision} onValueChange={(v) => setPicked(v as "allow" | "pause")} disabled={!interactive}>
            <SelectTrigger
              size="sm"
              className="h-7 w-fit gap-1 rounded-full border-none bg-secondary px-2.5 text-[13px] font-medium text-ink-2 shadow-none"
              aria-label="Tool approval"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">{LABEL.allow}</SelectItem>
              <SelectItem value="pause">{LABEL.pause}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      meta={data.rationale || (paused ? "UI-only gate — no tool will run" : "UI-only gate — recorded as allowed")}
      evidence={
        data.args ? (
          <EvidenceBlock label="Arguments">
            <code className="block font-mono text-[13px] leading-5 break-all whitespace-pre-wrap">{data.args}</code>
          </EvidenceBlock>
        ) : (
          <Missing>Add Args: or a tool_name({"{"}...{"}"}) call</Missing>
        )
      }
    />
  );
}
