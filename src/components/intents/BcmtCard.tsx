"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BCMT_CORE, BCMT_FIELDS, composeBcmt, type BcmtData, type BcmtField } from "@/lib/parse/bcmt";
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

export function BcmtCard({ data, interactive }: CardProps<BcmtData>) {
  const [copied, setCopied] = useState(false);
  const coreFilled = BCMT_CORE.filter((k) => data[k].trim()).length;
  const showInput = Boolean(data.input.trim()) || coreFilled > 0;
  const fields = showInput ? BCMT_FIELDS : BCMT_CORE;
  const prompt = composeBcmt(data);
  const canCopy = coreFilled > 0 && interactive;

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
        {fields.map((key, i) => (
          <Field key={key} index={i} className="flex flex-col gap-0.5">
            <Meta>{LABELS[key]}</Meta>
            {data[key].trim() ? (
              <p className="text-[15px] leading-[22px] text-pretty break-words whitespace-pre-wrap">{data[key]}</p>
            ) : (
              <Missing>{HINTS[key]}</Missing>
            )}
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
