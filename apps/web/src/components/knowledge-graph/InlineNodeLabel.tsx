"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LoaderCircle, Pencil } from "lucide-react";

type Props = {
  value: string;
  onCommit: (next: string) => void | Promise<void>;
  onEditStart?: () => void;
  /** When true, enter edit mode (e.g. after selecting a node on the canvas). */
  startEditing?: boolean;
  onStartEditingConsumed?: () => void;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * Click-to-edit node display name. Enter / blur saves; Escape cancels.
 * Closes the editor as soon as commit starts (save continues in background).
 */
export function InlineNodeLabel({
  value,
  onCommit,
  onEditStart,
  startEditing = false,
  onStartEditingConsumed,
  disabled = false,
  busy = false,
  className = "",
  ariaLabel,
}: Props) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(value);
  const editingRef = useRef(false);
  const committingRef = useRef(false);
  const ignoreBlurUntilRef = useRef(0);

  useEffect(() => {
    if (!editing) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(() => {
    if (!startEditing || disabled || busy) return;
    onEditStart?.();
    draftRef.current = value;
    setDraft(value);
    editingRef.current = true;
    setEditing(true);
    onStartEditingConsumed?.();
  }, [
    startEditing,
    disabled,
    busy,
    value,
    onEditStart,
    onStartEditingConsumed,
  ]);

  useEffect(() => {
    if (!editing) return;
    ignoreBlurUntilRef.current = Date.now() + 250;
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, [editing]);

  const setEditingState = (next: boolean) => {
    editingRef.current = next;
    setEditing(next);
  };

  const startEdit = (
    e: ReactMouseEvent | ReactPointerEvent | ReactMouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || busy || editingRef.current) return;
    onEditStart?.();
    draftRef.current = value;
    setDraft(value);
    setEditingState(true);
  };

  const cancel = () => {
    draftRef.current = value;
    setDraft(value);
    setEditingState(false);
  };

  const commit = () => {
    if (committingRef.current) return;
    const next = draftRef.current.trim().replace(/\s+/g, " ");
    if (!next || next === value) {
      cancel();
      return;
    }
    committingRef.current = true;
    setEditingState(false);
    void Promise.resolve(onCommit(next)).finally(() => {
      committingRef.current = false;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <form
        className={`inline-flex min-w-0 flex-1 items-center gap-1 ${className}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label className="sr-only" htmlFor={inputId}>
          {ariaLabel ?? "Node label"}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={draft}
          maxLength={120}
          onChange={(e) => {
            draftRef.current = e.target.value;
            setDraft(e.target.value);
          }}
          onBlur={() => {
            if (Date.now() < ignoreBlurUntilRef.current) {
              requestAnimationFrame(() => {
                if (editingRef.current && inputRef.current) {
                  inputRef.current.focus({ preventScroll: true });
                }
              });
              return;
            }
            commit();
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-md border bg-background px-1.5 py-0.5 text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-busy={busy}
        />
        {busy ? (
          <LoaderCircle
            className="size-3.5 shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      onPointerDown={(e) => {
        // Pointer down + preventDefault avoids focus theft on touch/pen.
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          startEdit(e);
        }
      }}
      disabled={disabled || busy}
      title="Click to rename"
      aria-label={ariaLabel ?? `Rename ${value}`}
      className={`inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-sm text-left text-[13px] font-medium text-foreground underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline ${className}`}
    >
      <Pencil className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="line-clamp-2 break-words">{value}</span>
    </button>
  );
}
