"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CardIntent } from "@shapeshift/core/jev/types";
import { registry } from "../intents/registry";
import { spring, tween } from "../lib/motion";
import { Kbd } from "../ui/kbd";
import { cn } from "../lib/utils";

/** Curated shelf — sparse, not a calculator-farm index. */
const SHELF_GROUPS: ReadonlyArray<{
  category: string;
  intents: readonly CardIntent[];
}> = [
  { category: "Money", intents: ["split", "tip", "emi", "convert", "calc"] },
  { category: "Time", intents: ["timer", "countdown"] },
  { category: "Plan", intents: ["event", "todo"] },
  { category: "Lifestyle", intents: ["color", "recipe", "workout"] },
];

export function GadgetShelf({
  show,
  onPick,
  onBrowseAll,
}: {
  show: boolean;
  onPick: (intent: CardIntent) => void;
  onBrowseAll: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="gadget-shelf"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, transition: tween.exit }}
          transition={reduce ? tween.fade : tween.crossfade}
          className="mt-3"
        >
          <p className="mb-3 px-1 text-center text-[13px] leading-[18px] font-medium text-muted-foreground">
            Type anything — or open a gadget.
            <span className="ms-1.5 inline-flex items-center gap-1">
              Press <Kbd>/</Kbd> for all.
            </span>
          </p>

          <div
            className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="Gadgets"
          >
            {SHELF_GROUPS.map((group, groupIdx) => (
              <div key={group.category} className="flex shrink-0 flex-col gap-1.5" role="group" aria-label={group.category}>
                <span className="px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                  {group.category}
                </span>
                <div className="flex gap-1.5">
                  {group.intents.map((intent, i) => {
                    const def = registry[intent];
                    const Icon = def.icon;
                    return (
                      <motion.button
                        key={intent}
                        type="button"
                        role="listitem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPick(intent)}
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduce
                            ? tween.fade
                            : { ...spring.snappy, delay: 0.02 * (groupIdx * 2 + i) }
                        }
                        whileTap={reduce ? undefined : { scale: 0.96 }}
                        className={cn(
                          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 text-[13px] font-medium text-foreground shadow-[var(--shadow-rest)] transition-[border-color,background-color,color] duration-150 ease-out",
                          "hover:border-line-strong hover:bg-muted/40",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {def.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex shrink-0 flex-col gap-1.5" role="group" aria-label="More">
              <span className="px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                More
              </span>
              <motion.button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onBrowseAll}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border bg-transparent px-2.5 text-[13px] font-medium text-muted-foreground transition-[border-color,color,background-color] duration-150 ease-out",
                  "hover:border-line-strong hover:bg-muted/30 hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                Browse all
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
