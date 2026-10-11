"use client";

import { Check, Copy, Loader2, Shuffle, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { spring, tween } from "../lib/motion";
import {
  BCMT_CORE,
  BCMT_FIELDS,
  bcmtSourceBody,
  composeBcmt,
  rollBcmt,
  type BcmtData,
  type BcmtField,
} from "@shapeshift/core/parse/bcmt";
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

export function BcmtCard({
  data,
  interactive,
  onApplyText,
  sourceText = "",
  structureBcmt,
}: CardProps<BcmtData>) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [rolls, setRolls] = useState(0);
  const [structuring, setStructuring] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coreFilled = BCMT_CORE.filter((k) => data[k].trim()).length;
  const showInput = Boolean(data.input.trim()) || coreFilled > 0;
  const fields = showInput ? BCMT_FIELDS : BCMT_CORE;
  const prompt = composeBcmt(data);
  const canCopy = coreFilled > 0 && interactive;
  const empty = isEmpty(data);
  const body = bcmtSourceBody(sourceText);
  const canStructure = Boolean(interactive && structureBcmt && onApplyText && body);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!interactive || !empty || !onApplyText || body) return;
    onApplyText(composeBcmt(rollBcmt()));
  }, [interactive, empty, onApplyText, body]);

  function roll() {
    if (!interactive || !onApplyText) return;
    onApplyText(composeBcmt(rollBcmt(Math.random, data)));
    setRolls((n) => n + 1);
    setStructureError(null);
  }

  async function structure() {
    if (!canStructure || !structureBcmt || !onApplyText) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStructuring(true);
    setStructureError(null);
    try {
      const next = await structureBcmt(sourceText, ac.signal);
      if (ac.signal.aborted) return;
      onApplyText(composeBcmt(next));
      setRolls((n) => n + 1);
    } catch (err) {
      if (ac.signal.aborted) return;
      setStructureError(err instanceof Error ? err.message : "Could not structure prompt");
    } finally {
      if (!ac.signal.aborted) setStructuring(false);
    }
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
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canStructure || structuring}
          onClick={structure}
          className="gap-1.5 px-3.5"
          aria-label={structuring ? "Structuring" : "Structure prompt"}
        >
          {structuring ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {structuring ? "Structuring…" : "Structure"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={roll}
          disabled={!interactive || !onApplyText || structuring}
          className="gap-1.5 px-3.5"
          aria-label="Roll again"
        >
          <Shuffle />
          Roll again
        </Button>
      </div>
      {structureError ? (
        <p className="text-[13px] leading-5 text-destructive text-end" role="alert">
          {structureError}
        </p>
      ) : null}
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
