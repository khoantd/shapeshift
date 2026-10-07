"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tween } from "../lib/motion";

/** Brand + tagline. Shown on an empty shell so the input stays primary while drafting. */
export function JevIntro({ show, brandSrc }: { show: boolean; brandSrc?: string }) {
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
          {brandSrc ? (
            <>
              <h1 className="sr-only">Meanbox</h1>
              <img
                src={brandSrc}
                alt=""
                className="mx-auto h-9 w-auto object-contain sm:h-10"
              />
            </>
          ) : (
            <h1 className="text-[28px] leading-8 font-[550] tracking-[-0.03em] text-balance text-foreground sm:text-[32px] sm:leading-9">
              Meanbox
            </h1>
          )}
          <p className="mt-2 text-[15px] leading-[22px] font-[450] tracking-[-0.01em] text-pretty text-ink-2">
            An input that becomes what you mean.
          </p>
        </motion.header>
      )}
    </AnimatePresence>
  );
}

