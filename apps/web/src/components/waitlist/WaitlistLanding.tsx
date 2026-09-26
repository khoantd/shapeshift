"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { motion, MotionConfig } from "motion/react";
import { KeyRound, Sparkles, Type, WifiOff } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { isConvexConfigured } from "../ConvexClientProvider";
import { ProductPreview } from "./ProductPreview";
import { SignupForm } from "./SignupForm";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Morphs as you type",
    description:
      "One text box becomes the right UI — events, checklists, timers, splits, and more — without menus or mode switches.",
  },
  {
    icon: KeyRound,
    title: "Jev decides, code computes",
    description:
      "TypeSafe AI’s Jev classifies intent in parallel. Dates, amounts, and math stay in deterministic parsers.",
  },
  {
    icon: WifiOff,
    title: "Works offline by default",
    description:
      "A built-in keyword classifier keeps the demo useful with no API key. Plug in Jev when you want the full model.",
  },
  {
    icon: Type,
    title: "Calm, focused chrome",
    description:
      "Minimal surface, strong focus states, and motion that respects reduced-motion preferences.",
  },
] as const;

/** Stable across SSR/client — never branch on useReducedMotion (null on server). */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function WaitlistCount() {
  const configured = isConvexConfigured();
  const waitlistCount = useQuery(api.waitlist.waitlistCount);
  if (!configured) return null;
  if (typeof waitlistCount !== "number") return null;
  return <span>{waitlistCount.toLocaleString("en-US")} on the waitlist</span>;
}

function WaitlistCountSafe() {
  if (!isConvexConfigured()) return null;
  return <WaitlistCount />;
}

export function WaitlistLanding() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="visible"
        className="flex min-h-screen flex-col bg-background text-foreground"
      >
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background">
              <span className="size-2 rounded-sm bg-brand" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">Shapeshift</span>
          </div>
          <nav className="flex items-center gap-5">
            <a
              href="#features"
              className="nav-underline cursor-pointer text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Features
            </a>
            <Link
              href="/demo"
              className="cursor-pointer text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Try the demo
            </Link>
          </nav>
        </header>

        <main id="main">
          <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase"
            >
              Now in private beta
            </motion.p>
            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="mt-5 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl"
            >
              An input that becomes what you mean.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="mt-6 max-w-xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8"
            >
              Shapeshift morphs a single text box into the right UI as you type — events, checklists,
              timers, and more. Powered by TypeSafe AI&apos;s Jev. Join the waitlist for early access.
            </motion.p>
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.45, delay: 0.24 }}
              className="mt-10"
            >
              <SignupForm />
            </motion.div>
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            >
              <WaitlistCountSafe />
              <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
              <span>Invites sent weekly</span>
              <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
              <Link
                href="/demo"
                className="cursor-pointer underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Or try the live demo
              </Link>
            </motion.div>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="mt-14 sm:mt-16"
            >
              <ProductPreview />
            </motion.div>
          </section>

          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="h-px w-full bg-border/70" />
          </div>

          <section id="features" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20 sm:py-24">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Less chrome. More meaning.</h2>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
                Four principles, one morphing input. Everything else was deliberately left out.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2">
              {FEATURES.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  variants={fadeUp}
                  transition={{
                    duration: 0.45,
                    delay: 0.06 * index,
                  }}
                  className="flex flex-col gap-4 bg-background p-7 sm:p-8"
                >
                  <feature.icon className="size-5 text-foreground/70" strokeWidth={1.5} aria-hidden />
                  <div>
                    <h3 className="text-sm font-medium tracking-tight">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="h-px w-full bg-border/70" />
          </div>

          <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
            <div className="flex flex-col gap-6">
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
                Be first through the door.
              </h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                Invites go out weekly, in the order people joined. Save your place and we&apos;ll take
                it from there.
              </p>
              <div className="mt-2">
                <SignupForm />
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-auto border-t border-border/70">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Shapeshift. All rights reserved.</p>
            <p>
              <Link
                href="/demo"
                className="cursor-pointer underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Open the demo
              </Link>
            </p>
          </div>
        </footer>
      </motion.div>
    </MotionConfig>
  );
}
