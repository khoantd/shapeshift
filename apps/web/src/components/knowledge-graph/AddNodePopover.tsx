"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { GraphNodeKind } from "@/lib/neo4j/mutateGraph";

export type AddNodeKindOption = {
  value: GraphNodeKind;
  label: string;
};

type Props = {
  x: number;
  y: number;
  kinds: AddNodeKindOption[];
  defaultKind: GraphNodeKind;
  busy?: boolean;
  onCommit: (input: { kind: GraphNodeKind; label: string }) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Floating popover anchored near a canvas click for adding a knowledge-graph node.
 */
export function AddNodePopover({
  x,
  y,
  kinds,
  defaultKind,
  busy = false,
  onCommit,
  onCancel,
}: Props) {
  const labelId = useId();
  const kindId = useId();
  const [kind, setKind] = useState<GraphNodeKind>(defaultKind);
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const left = Math.min(Math.max(12, x), typeof window !== "undefined" ? window.innerWidth - 280 : x);
  const top = Math.min(Math.max(12, y), typeof window !== "undefined" ? window.innerHeight - 200 : y);

  return (
    <div
      className="fixed z-50 w-[min(17.5rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-background p-2.5 shadow-lg"
      style={{ left, top }}
      role="dialog"
      aria-label="Add node"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <Plus className="size-3" aria-hidden />
          Add node
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Cancel add node"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = label.trim().replace(/\s+/g, " ");
          if (!trimmed || busy) return;
          void onCommit({ kind, label: trimmed });
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div>
          <label htmlFor={kindId} className="sr-only">
            Node kind
          </label>
          <select
            id={kindId}
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(e.target.value as GraphNodeKind)}
            className="h-8 w-full cursor-pointer rounded-md border bg-background px-2 text-[12px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={labelId} className="sr-only">
            Node label
          </label>
          <input
            ref={inputRef}
            id={labelId}
            type="text"
            value={label}
            maxLength={120}
            disabled={busy}
            placeholder="Label"
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2.5 text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border bg-foreground px-2.5 text-[12px] font-medium text-background transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
