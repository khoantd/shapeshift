"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_CATEGORIES } from "@/lib/jev/types";
import type { ClassifyData } from "@/lib/parse/classify";
import { DecisionShell, EvidenceBlock } from "./DecisionShell";
import { Missing } from "./shared";
import type { CardProps } from "./types";

const LABEL: Record<string, string> = {
  finance: "Finance",
  legal: "Legal",
  hr: "HR",
  product: "Product",
  support: "Support",
  marketing: "Marketing",
  other: "Other",
};

export function ClassifyCard({ data, signals, interactive }: CardProps<ClassifyData>) {
  const options = data.categories.length ? data.categories : [...DOC_CATEGORIES];
  const suggested = signals.docCategory ?? "other";
  const [picked, setPicked] = useState<string | null>(null);
  const category = picked ?? (options.includes(suggested) ? suggested : options[0]!);

  return (
    <DecisionShell
      suggestion={
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[17px] leading-6 font-[550]">Category</h2>
          <Select value={category} onValueChange={setPicked} disabled={!interactive}>
            <SelectTrigger
              size="sm"
              className="h-8 w-fit gap-1 rounded-full border-none bg-secondary px-3 text-[13px] font-medium text-ink-2 shadow-none"
              aria-label="Document category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c} value={c}>
                  {LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      meta="Pick a category for this document"
      evidence={
        data.body ? (
          <EvidenceBlock label="Document">{data.body}</EvidenceBlock>
        ) : (
          <Missing>Paste the document text</Missing>
        )
      }
    />
  );
}
