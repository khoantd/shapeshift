"use client";

import { Check, Copy, Shuffle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { spring, tween } from "../lib/motion";
import { BCMT_CORE, BCMT_FIELDS, composeBcmt, rollBcmt, type BcmtData, type BcmtField } from "@shapeshift/core/parse/bcmt";
import { Field, Meta, Missing } from "./shared";
import type { CardProps } from "./types";

const LABELS: Record<BcmtField, string> = {
  context: "Bối cảnh",
  people: "Con người",
  goal: "Mục tiêu",
  standards: "Tiêu chuẩn",
  input: "Đầu vào",
};

const HINTS: Record<BcmtField, string> = {
  context: "Ngành, sản phẩm, ràng buộc, dữ liệu nền",
  people: "Bạn là [vai]. Người đọc là [đối tượng]",
  goal: "Hành động + deliverable duy nhất, đo được",
  standards: "Định dạng · độ dài · ngôn ngữ · bắt buộc / cấm",
  input: "Dữ liệu đầu vào (tuỳ chọn)",
};

function isEmpty(d: BcmtData) {
  return BCMT_CORE.every((k) => !d[k].trim());
}

export function BcmtCard({ data, interactive, onApplyText }: CardProps<BcmtData>) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [rolls, setRolls] = useState(0);
  const coreFilled = BCMT_CORE.filter((k) => data[k].trim()).length;
  const showInput = Boolean(data.input.trim()) || coreFilled > 0;
  const fields = showInput ? BCMT_FIELDS : BCMT_CORE;
  const prompt = composeBcmt(data);
  const canCopy = coreFilled > 0 && interactive;
  const empty = isEmpty(data);

  useEffect(() => {
    if (!interactive || !empty || !onApplyText) return;
    onApplyText(composeBcmt(rollBcmt()));
  }, [interactive, empty, onApplyText]);

  function roll() {
    if (!interactive || !onApplyText) return;
    onApplyText(composeBcmt(rollBcmt(Math.random, data)));
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
      <div className="flex justify-end">
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
        {fields.map((key, i) => (
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
                  className="text-[15px] leading-[22px] text-pretty break-words whitespace-pre-wrap"
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
      {coreFilled > 0 && (
        <Field index={fields.length} className="flex flex-col gap-2">
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
