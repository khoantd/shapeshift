"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { composeRtcfc, RTCFC_FIELDS, type RtcfcData, type RtcfcField } from "@/lib/parse/rtcfc";
import { Field, Meta, Missing } from "./shared";
import type { CardProps } from "./types";

const LABELS: Record<RtcfcField, string> = {
  role: "Role",
  task: "Task",
  context: "Context",
  format: "Format",
  constraints: "Constraints",
};

const HINTS: Record<RtcfcField, string> = {
  role: "Who the model acts as",
  task: "Single verb + specific output",
  context: "Audience, prior state, world",
  format: "Structure, length, language",
  constraints: "Must-do / must-not-do",
};

export function RtcfcCard({ data, interactive }: CardProps<RtcfcData>) {
  const [copied, setCopied] = useState(false);
  const filled = RTCFC_FIELDS.filter((k) => data[k].trim()).length;
  const prompt = composeRtcfc(data);
  const canCopy = filled > 0 && interactive;

  async function copy() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be denied */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {RTCFC_FIELDS.map((key, i) => (
          <Field key={key} index={i} className="flex flex-col gap-0.5">
            <Meta>{LABELS[key]}</Meta>
            {data[key].trim() ? (
              <p className="text-[15px] leading-[22px] text-pretty break-words">{data[key]}</p>
            ) : (
              <Missing>{HINTS[key]}</Missing>
            )}
          </Field>
        ))}
      </div>
      {filled > 0 && (
        <Field index={5} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Meta>Prompt</Meta>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!canCopy}
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy prompt"}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="max-h-40 overflow-auto rounded-md bg-secondary/80 px-3 py-2 text-[12px] leading-5 whitespace-pre-wrap break-words text-ink-2">
            {prompt}
          </pre>
        </Field>
      )}
    </div>
  );
}
