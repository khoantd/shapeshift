"use client";

import { Check, Copy, Shuffle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { spring, tween } from "@/lib/motion";
import { composeRtcfc, RTCFC_FIELDS, rollRtcfc, type RtcfcData, type RtcfcField } from "@/lib/parse/rtcfc";
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

function isEmpty(d: RtcfcData) {
  return RTCFC_FIELDS.every((k) => !d[k].trim());
}

export function RtcfcCard({ data, interactive, onApplyText }: CardProps<RtcfcData>) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [rolls, setRolls] = useState(0);
  const filled = RTCFC_FIELDS.filter((k) => data[k].trim()).length;
  const prompt = composeRtcfc(data);
  const canCopy = filled > 0 && interactive;
  const empty = isEmpty(data);

  useEffect(() => {
    if (!interactive || !empty || !onApplyText) return;
    onApplyText(composeRtcfc(rollRtcfc()));
  }, [interactive, empty, onApplyText]);

  function roll() {
    if (!interactive || !onApplyText) return;
    onApplyText(composeRtcfc(rollRtcfc(Math.random, data)));
    setRolls((n) => n + 1);
  }

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
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canCopy}
          onClick={copy}
          className="gap-1.5 px-3.5"
          aria-label={copied ? "Copied" : "Copy prompt"}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={roll}
          disabled={!interactive || !onApplyText}
          className="gap-1.5 px-3.5"
          aria-label="Roll again"
        >
          <Shuffle />
          Roll again
        </Button>
      </div>
      <div className="flex flex-col gap-2" aria-live="polite">
        {RTCFC_FIELDS.map((key, i) => (
          <Field key={key} index={i} className="flex flex-col gap-0.5">
            <Meta>{LABELS[key]}</Meta>
            <AnimatePresence mode="popLayout" initial={false}>
              {data[key].trim() ? (
                <motion.p
                  key={`${rolls}-${key}-${data[key]}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(4px)", transition: tween.exit }}
                  transition={reduce ? tween.fade : { ...spring.snappy, delay: i * 0.03 }}
                  className="text-[15px] leading-[22px] text-pretty break-words"
                >
                  {data[key]}
                </motion.p>
              ) : (
                <Missing key={`${rolls}-${key}-missing`}>{HINTS[key]}</Missing>
              )}
            </AnimatePresence>
          </Field>
        ))}
      </div>
    </div>
  );
}
