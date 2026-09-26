"use client";

import { useEffect } from "react";
import { useSpring } from "motion/react";
import type { NewsData } from "@shapeshift/core/parse/news";
import { neutralGated } from "@shapeshift/core/signals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { spring } from "../lib/motion";
import { CardView } from "./CardView";

/**
 * CardView confirmation for a `/source + keywords` news search intent.
 * Confirm applies filters; Esc / dismiss clears without applying.
 */
export function NewsIntentConfirm({
  open,
  data,
  onOpenChange,
  onConfirm,
  onClear,
}: {
  open: boolean;
  data: NewsData | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: NewsData) => void;
  onClear: () => void;
}) {
  const readiness = useSpring(1, spring.number);

  useEffect(() => {
    if (open) readiness.set(1);
  }, [open, readiness]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClear();
        onOpenChange(false);
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && data) {
        const t = e.target as HTMLElement | null;
        if (t?.closest("textarea, input, [contenteditable=true]")) return;
        e.preventDefault();
        onConfirm(data);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, data, onClear, onConfirm, onOpenChange]);

  return (
    <Dialog
      open={open && data != null}
      onOpenChange={(next) => {
        if (!next) onClear();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl p-0 shadow-[var(--shadow-float)] sm:max-w-[420px]"
        onEscapeKeyDown={(e: { preventDefault: () => void }) => {
          e.preventDefault();
          onClear();
          onOpenChange(false);
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Confirm news search</DialogTitle>
          <DialogDescription>Review source and topic, then add to filter the feed</DialogDescription>
        </DialogHeader>
        {data && (
          <CardView
            intent="news"
            data={data}
            signals={neutralGated}
            readiness={readiness}
            ghost={false}
            interactive={false}
            onConfirm={() => onConfirm(data)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
