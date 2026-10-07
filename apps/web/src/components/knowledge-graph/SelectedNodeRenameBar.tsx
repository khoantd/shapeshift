"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";

type Props = {
  kind: string;
  value: string;
  busy?: boolean;
  deleteBusy?: boolean;
  onCommit: (next: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

/**
 * Always-visible rename field for the currently selected knowledge-graph node.
 */
export function SelectedNodeRenameBar({
  kind,
  value,
  busy = false,
  deleteBusy = false,
  onCommit,
  onDelete,
}: Props) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = busy || deleteBusy;

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
    const t = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [value]);

  const commit = () => {
    const next = draftRef.current.trim().replace(/\s+/g, " ");
    if (!next || next === value) {
      draftRef.current = value;
      setDraft(value);
      return;
    }
    void onCommit(next);
  };

  const handleDelete = () => {
    if (!onDelete || locked) return;
    const ok = window.confirm(
      `Delete “${value}”? Connected relationships will be removed too.`,
    );
    if (!ok) return;
    void onDelete();
  };

  return (
    <form
      className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        commit();
      }}
      aria-label={`Rename ${kind}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <Pencil className="size-3" aria-hidden />
          Rename {kind}
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={locked}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--caution)] transition-colors hover:bg-[var(--caution)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Delete ${kind} ${value}`}
          >
            {deleteBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3.5" aria-hidden />
            )}
            Delete
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={inputId}>
          Node label
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={draft}
          maxLength={120}
          disabled={locked}
          onChange={(e) => {
            draftRef.current = e.target.value;
            setDraft(e.target.value);
          }}
          className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={locked || !draft.trim() || draft.trim() === value}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[12px] font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}
