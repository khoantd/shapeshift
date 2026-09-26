"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tween } from "../lib/motion";

const LINK =
  "text-foreground underline decoration-border underline-offset-2 transition-colors duration-150 ease-out hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Brand + how Jev powers Shapeshift. Shown on an empty shell so the input stays primary while drafting. */
export function JevIntro({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.header
          key="jev-intro"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: tween.exit }}
          transition={tween.crossfade}
          className="mb-6 px-1 text-center sm:mb-8"
        >
          <h1 className="text-[28px] leading-8 font-[550] tracking-[-0.03em] text-balance text-foreground sm:text-[32px] sm:leading-9">
            Shapeshift
          </h1>
          <p className="mt-2 text-[15px] leading-[22px] font-[450] tracking-[-0.01em] text-pretty text-ink-2">
            An input that becomes what you mean.
          </p>
          <p className="mx-auto mt-3 max-w-[34rem] text-[13px] leading-[18px] font-medium text-pretty text-muted-foreground">
            Intent is classified by{" "}
            <a href="https://typesafe.ai" target="_blank" rel="noopener noreferrer" className={LINK}>
              TypeSafe AI
            </a>
            ’s <span className="text-foreground">Jev</span>—one call answers typed questions in parallel (which card,
            urgency, and more). Dates, amounts, and math stay in deterministic code:{" "}
            <span className="text-foreground">Jev decides, code computes</span>. Works offline by default.
          </p>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
