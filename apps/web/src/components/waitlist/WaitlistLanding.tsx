"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { motion, MotionConfig } from "motion/react";
import { KeyRound, MapPinned, Menu, Sparkles, WifiOff, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api } from "../../../convex/_generated/api";
import { LanguageSelector } from "../LanguageSelector";
import { isConvexConfigured } from "../ConvexClientProvider";
import { BrandBackdrop } from "../brand/BrandBackdrop";
import { MeanboxLogo } from "../brand/MeanboxLogo";
import { ProductPreview } from "./ProductPreview";
import { SignupForm } from "./SignupForm";

const FEATURES = [
  {
    icon: Sparkles,
    titleKey: "featureMorphTitle",
    descriptionKey: "featureMorphDesc",
  },
  {
    icon: KeyRound,
    titleKey: "featureJevTitle",
    descriptionKey: "featureJevDesc",
  },
  {
    icon: MapPinned,
    titleKey: "featurePlacesTitle",
    descriptionKey: "featurePlacesDesc",
  },
  {
    icon: WifiOff,
    titleKey: "featureOfflineTitle",
    descriptionKey: "featureOfflineDesc",
  },
] as const;

/** Stable across SSR/client — never branch on useReducedMotion (null on server). */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function WaitlistCount() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const configured = isConvexConfigured();
  const waitlistCount = useQuery(api.waitlist.waitlistCount);
  if (!configured) return null;
  if (typeof waitlistCount !== "number") return null;
  return (
    <span>
      {t("waitlistCount", {
        count: waitlistCount.toLocaleString(locale === "vi" ? "vi-VN" : "en-US"),
      })}
    </span>
  );
}

function WaitlistCountSafe() {
  if (!isConvexConfigured()) return null;
  return <WaitlistCount />;
}

export function WaitlistLanding() {
  const t = useTranslations("Landing");
  const tNav = useTranslations("Nav");
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="visible"
        className="relative flex min-h-screen flex-col bg-background text-foreground"
      >
        <header className="relative z-10 overflow-hidden border-b border-border/50">
          <BrandBackdrop src="/brand/header.jpg" scrub="heavy" position="center bottom" />
          <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6 py-5">
            <Link
              href="/"
              className="inline-flex min-w-0 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <MeanboxLogo
                variant="lockup"
                className="h-7 w-auto max-w-[10rem] object-contain object-left sm:h-8 sm:max-w-none"
                priority
              />
            </Link>
            <nav className="flex items-center gap-2 sm:gap-5">
              <LanguageSelector />
              <a
                href="#features"
                className="nav-underline hidden cursor-pointer text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline"
              >
                {tNav("features")}
              </a>
              <Link
                href="/gadgets"
                className="hidden cursor-pointer text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline"
              >
                {tNav("openGadgets")}
              </Link>
              <button
                type="button"
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:hidden"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-label={menuOpen ? tNav("closeMenu") : tNav("openMenu")}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
              </button>
            </nav>
          </div>
          {menuOpen ? (
            <div
              id={menuId}
              role="dialog"
              aria-label={tNav("menu")}
              className="relative border-t border-border/50 bg-background/95 px-6 py-3 sm:hidden"
            >
              <nav className="flex flex-col gap-1">
                <a
                  href="#features"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {tNav("features")}
                </a>
                <Link
                  href="/gadgets"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {tNav("openGadgets")}
                </Link>
              </nav>
            </div>
          ) : null}
        </header>

        <main id="main" className="relative z-10">
          <section className="relative overflow-hidden">
            <BrandBackdrop src="/brand/hero.jpg" scrub="light" position="center" />
            <div className="relative mx-auto w-full max-w-5xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase"
              >
                {t("beta")}
              </motion.p>
              <motion.h1
                variants={fadeUp}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="mt-5 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl"
              >
                {t("headline")}
              </motion.h1>
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.45, delay: 0.16 }}
                className="mt-6 max-w-xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8"
              >
                {t("subhead")}
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
                <span>{t("invitesWeekly")}</span>
                <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
                <Link
                  href="/gadgets"
                  className="cursor-pointer underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("orTryGadgets")}
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.5, delay: 0.38 }}
                className="mt-14 sm:mt-16"
              >
                <ProductPreview />
              </motion.div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="h-px w-full bg-border/70" />
          </div>

          <section id="features" className="relative scroll-mt-8 overflow-hidden">
            <BrandBackdrop src="/brand/features.jpg" scrub="medium" position="center" />
            <div className="relative mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
              <div className="flex flex-col gap-3">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t("featuresTitle")}
                </h2>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
                  {t("featuresSub")}
                </p>
              </div>
              <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature.titleKey}
                    variants={fadeUp}
                    transition={{
                      duration: 0.45,
                      delay: 0.06 * index,
                    }}
                    className="flex flex-col gap-4 bg-background/90 p-7 backdrop-blur-sm sm:p-8"
                  >
                    <feature.icon className="size-5 text-foreground/70" strokeWidth={1.5} aria-hidden />
                    <div>
                      <h3 className="text-sm font-medium tracking-tight">{t(feature.titleKey)}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {t(feature.descriptionKey)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="h-px w-full bg-border/70" />
          </div>

          <section className="relative overflow-hidden">
            <BrandBackdrop src="/brand/main.jpg" scrub="heavy" position="center bottom" />
            <div className="relative mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
              <div className="flex flex-col gap-6">
                <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t("ctaTitle")}
                </h2>
                <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                  {t("ctaBody")}
                </p>
                <div className="mt-2">
                  <SignupForm />
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 mt-auto overflow-hidden border-t border-border/70">
          <BrandBackdrop src="/brand/header.jpg" scrub="heavy" position="center top" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>{t("footerRights", { year: new Date().getFullYear() })}</p>
            <p>
              <Link
                href="/gadgets"
                className="cursor-pointer underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {tNav("openGadgets")}
              </Link>
            </p>
          </div>
        </footer>
      </motion.div>
    </MotionConfig>
  );
}
