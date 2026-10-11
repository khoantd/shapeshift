"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { registry } from "../intents/registry";
import {
  SAVED_PAGE_SIZE,
  filterSavedItems,
  pageSavedItems,
} from "../lib/filterSavedItems";
import { spring, tween } from "../lib/motion";
import type { SavedItem } from "../lib/savedItems";
import { cn } from "../lib/utils";

/** Saved cards. They stay until deleted; each row reopens its card for editing. */
export function RecentStack({
  items,
  flyingId,
  onOpen,
  onDelete,
}: {
  items: SavedItem[];
  /** The row arriving from the shell via the shared layoutId; it flies instead of fading. */
  flyingId: number | null;
  onOpen: (item: SavedItem) => void;
  onDelete: (item: SavedItem) => void;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(SAVED_PAGE_SIZE);

  const filtered = filterSavedItems(items, query, (intent) => registry[intent].label);
  const { visible, hasMore, total } = pageSavedItems(filtered, visibleCount);
  const searching = query.trim().length > 0;

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          key="saved"
          aria-label="Saved"
          layout="position"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: tween.exit }}
          transition={reduce ? tween.fade : spring.settle}
          // Same surface as the input shell; rows inside sit 8px in, so their radius is 28 − 8 = 20.
          className="mt-4 flex flex-col gap-0.5 rounded-shell border border-border bg-card p-2 shadow-[var(--shadow-rest)]"
        >
          <label className="relative mb-1 flex items-center gap-2 rounded-xl border border-transparent bg-secondary/60 px-2.5 py-1.5 transition-[border-color,background-color] duration-150 focus-within:border-border focus-within:bg-card">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search saved cards</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(SAVED_PAGE_SIZE);
              }}
              placeholder="Search saved…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          {total > 0 && hasMore ? (
            <p className="px-1 pb-0.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
              Showing {visible.length} of {total}
            </p>
          ) : null}

          <AnimatePresence initial={false}>
            {visible.map((item, i) => {
              const def = registry[item.intent];
              const Icon = def.icon;
              return (
                <motion.div
                  key={item.id}
                  layoutId={reduce ? undefined : `item-${item.id}`}
                  layout="position"
                  // Rows restored by Undo fade in where they were; the completed card flies in instead.
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : item.id === flyingId
                        ? false
                        : { opacity: 0, y: -4, filter: "blur(4px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: -4,
                          filter: "blur(4px)",
                          transition: tween.exit,
                        }
                  }
                  transition={reduce ? tween.fade : spring.morph}
                  className="group relative flex items-center rounded-xl transition-[background-color] duration-150 ease-out hover:bg-secondary"
                >
                  <motion.button
                    type="button"
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    onClick={() => onOpen(item)}
                    aria-label={`Edit ${def.label.toLowerCase()}: ${item.summary}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 ps-2 pe-11 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {/* Age reads through the tile fading, never through the text. */}
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-foreground transition-[opacity,background-color] duration-150 group-hover:bg-card group-hover:opacity-100"
                      style={{ opacity: Math.max(0.45, 1 - i * 0.14) }}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[15px] leading-[22px] text-pretty break-words",
                        i === 0 ? "text-foreground" : "text-ink-2",
                      )}
                    >
                      {item.summary}
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
                      {def.label}
                    </span>
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    aria-label={`Delete ${def.label.toLowerCase()}: ${item.summary}`}
                    className="absolute end-1 grid size-10 place-items-center rounded-md text-muted-foreground transition-[opacity,color,scale] duration-150 ease-out hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {searching && total === 0 ? (
            <p className="px-2 py-3 text-[13px] leading-5 text-muted-foreground">
              No saved cards match.
            </p>
          ) : null}

          {hasMore ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + SAVED_PAGE_SIZE, total))
                }
                className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-2.5 text-[13px] font-medium text-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
              >
                Load more
              </button>
            </div>
          ) : null}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
