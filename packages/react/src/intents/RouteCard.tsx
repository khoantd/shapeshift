"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { RouteDecision } from "@shapeshift/core/jev/types";
import type { RouteData } from "@shapeshift/core/parse/route";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { Chip, Missing } from "./shared";
import type { CardProps } from "./types";

const ACTION_LABEL: Record<Exclude<RouteDecision, "unspecified">, string> = {
  assign: "Assign owner",
  another_review: "Request another review",
};

export function RouteCard({ data, signals, interactive }: CardProps<RouteData>) {
  const suggestedAction = signals.routeDecision === "another_review" ? "another_review" : "assign";
  const [action, setAction] = useState<"assign" | "another_review" | null>(null);
  const decision = action ?? suggestedAction;

  const owners = data.owners.length ? data.owners : ["Unassigned"];
  const [owner, setOwner] = useState<string | null>(null);
  const pickedOwner = owner ?? owners[0]!;

  return (
    <DecisionShell
      suggestion={
        <div className="flex flex-col gap-2">
          {data.subject ? <h2 className="text-[17px] leading-6 font-[550] text-pretty break-words">{data.subject}</h2> : <Missing>Add a form subject</Missing>}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={decision} onValueChange={(v) => setAction(v as "assign" | "another_review")} disabled={!interactive}>
              <SelectTrigger
                size="sm"
                className="h-7 w-fit gap-1 rounded-full border-none bg-secondary px-2.5 text-[13px] font-medium text-ink-2 shadow-none"
                aria-label="Routing action"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assign">{ACTION_LABEL.assign}</SelectItem>
                <SelectItem value="another_review">{ACTION_LABEL.another_review}</SelectItem>
              </SelectContent>
            </Select>
            {decision === "assign" ? (
              <Select value={pickedOwner} onValueChange={setOwner} disabled={!interactive || owners[0] === "Unassigned"}>
                <SelectTrigger
                  size="sm"
                  className="h-7 w-fit gap-1 rounded-full border-none bg-secondary px-2.5 text-[13px] font-medium text-ink-2 shadow-none"
                  aria-label="Owner"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Chip icon={UserRound}>Second reviewer</Chip>
            )}
          </div>
        </div>
      }
      meta={decision === "assign" ? `Assign to ${pickedOwner}` : "Hold for another review"}
      evidence={
        data.fields || data.owners.length ? (
          <EvidenceBlock label="Submitted fields">
            {[data.fields, data.owners.length ? `Owners: ${data.owners.join(", ")}` : ""].filter(Boolean).join("\n")}
          </EvidenceBlock>
        ) : data.subject ? (
          <EvidenceBlock>{data.subject}</EvidenceBlock>
        ) : (
          <Missing>Add Subject:, Fields:, and Owners:</Missing>
        )
      }
    />
  );
}
