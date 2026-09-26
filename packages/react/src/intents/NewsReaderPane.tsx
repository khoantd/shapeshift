"use client";

import { forwardRef, useEffect, useState } from "react";
import {
  ArrowUpRight,
  LoaderCircle,
  Maximize2,
  Newspaper,
  Pin,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../ui/button";
import { spring, tween } from "../lib/motion";
import { cn } from "../lib/utils";
import {
  collectNewsHighlightTerms,
  extractNewsHighlightSnippets,
  highlightNewsText,
} from "../lib/highlightNewsText";
import type { NewsFeedItem } from "./NewsFeedItemCard";
import { MarkdownBody } from "./MarkdownBody";

export type NewsBriefView = {
  urgency: number;
  relevance: number;
  tone: "neutral" | "caution" | "opportunity";
  line: string;
  source?: "jev" | "mock";
};

export type NewsDeepDiveSource = {
  title: string;
  url: string;
};

export type NewsDeepDiveView = {
  text: string;
  sources: NewsDeepDiveSource[];
};

function relativeWhen(iso: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ReaderThumbnail({
  url,
  title,
}: {
  url?: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(url?.trim()) && !failed;

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border bg-secondary"
      aria-hidden={!show}
    >
      {show ? (
        <img
          src={url!}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full min-h-[12rem] items-center justify-center bg-gradient-to-br from-secondary to-background">
          <Newspaper className="size-12 text-muted-foreground opacity-50" aria-hidden />
          <span className="sr-only">{title}</span>
        </div>
      )}
    </div>
  );
}

function scoreChip(label: string, score: number): string {
  if (score >= 0.67) return label;
  if (score >= 0.34) return `${label} · mid`;
  return `${label} · low`;
}

const ReaderBody = forwardRef<
  HTMLDivElement,
  {
    item: NewsFeedItem;
    highlightQuery?: string;
    brief?: NewsBriefView | null;
    briefLoading?: boolean;
    briefError?: string | null;
    deepDive?: NewsDeepDiveView | null;
    deepDiveLoading?: boolean;
    deepDiveError?: string | null;
    onGenerateDeepDive?: () => void;
    onRegenerateDeepDive?: () => void;
    reduce: boolean | null;
  }
>(function ReaderBody(
  {
    item,
    highlightQuery,
    brief,
    briefLoading,
    briefError,
    deepDive,
    deepDiveLoading,
    deepDiveError,
    onGenerateDeepDive,
    onRegenerateDeepDive,
    reduce,
  },
  ref,
) {
  const when = relativeWhen(item.publishedAt);
  const source = item.sourceDisplayName?.trim() || null;
  const href = item.canonicalUrl?.trim() || null;
  const excerpt = item.excerpt.trim();
  const terms = collectNewsHighlightTerms(highlightQuery);
  const snippets = extractNewsHighlightSnippets(excerpt, terms);

  return (
    <motion.div
      ref={ref}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: tween.exit }}
      transition={reduce ? tween.fade : spring.settle}
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
    >
      <ReaderThumbnail url={item.thumbnailUrl} title={item.title} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px] leading-4 text-muted-foreground">
          {item.isPinned && (
            <span className="inline-flex items-center gap-1 font-medium text-ink-2">
              <Pin className="size-3" aria-hidden />
              Pinned
            </span>
          )}
          {source && <span>{source}</span>}
          {when && (
            <>
              {(source || item.isPinned) && <span aria-hidden>·</span>}
              <time dateTime={item.publishedAt}>{when}</time>
            </>
          )}
          {!item.isRead && <span className="font-medium text-[var(--brand)]">Unread</span>}
        </div>
        <h2 className="text-[24px] leading-8 font-[550] tracking-tight text-balance">
          {item.title || "Untitled"}
        </h2>
      </div>

      <section className="flex flex-col gap-2" aria-label="Jev brief" aria-busy={briefLoading}>
        <h3 className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Brief
        </h3>
        {briefLoading && !brief ? (
          <p className="flex items-center gap-2 text-[14px] leading-5 text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Scoring with Jev…
          </p>
        ) : briefError && !brief ? (
          <p className="text-[14px] leading-5 text-[var(--caution)]">{briefError}</p>
        ) : (
          <AnimatePresence initial={false}>
            {brief ? (
              <motion.div
                key="brief"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: tween.exit }}
                transition={reduce ? tween.fade : tween.crossfade}
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-1 text-[12px] font-medium text-ink-2">
                    {scoreChip("Urgency", brief.urgency)}
                  </span>
                  <span className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-1 text-[12px] font-medium text-ink-2">
                    {scoreChip("Relevance", brief.relevance)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-1 text-[12px] font-medium capitalize",
                      brief.tone === "caution" && "border-[var(--caution)]/40 text-[var(--caution)]",
                      brief.tone === "opportunity" && "text-[var(--brand)]",
                      brief.tone === "neutral" && "bg-muted/40 text-ink-2",
                    )}
                  >
                    {brief.tone}
                  </span>
                </div>
                <p className="text-[15px] leading-[22px] text-pretty text-ink-2">{brief.line}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}
      </section>

      <section className="flex flex-col gap-1.5" aria-label="Summary">
        <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Summary
        </h3>
        {excerpt ? (
          <p className="text-[15px] leading-[22px] text-pretty text-ink-2">{excerpt}</p>
        ) : (
          <p className="text-[15px] leading-[22px] text-muted-foreground">No summary available.</p>
        )}
      </section>

      <section className="flex flex-col gap-1.5" aria-label="Deep dive" aria-busy={deepDiveLoading}>
        <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Deep Dive
        </h3>
        {deepDiveLoading && !deepDive ? (
          <p className="flex items-center gap-2 text-[14px] leading-5 text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Researching with Perplexity…
          </p>
        ) : deepDiveError && !deepDive ? (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] leading-5 text-[var(--caution)]">{deepDiveError}</p>
            {onGenerateDeepDive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={onGenerateDeepDive}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : deepDive ? (
          <AnimatePresence initial={false}>
            <motion.div
              key="deep-dive"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: tween.exit }}
              transition={reduce ? tween.fade : tween.crossfade}
              className="flex flex-col gap-3"
            >
              <MarkdownBody sources={deepDive.sources}>{deepDive.text}</MarkdownBody>
              {deepDive.sources.length > 0 ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Sources
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {deepDive.sources.map((src) => (
                      <li key={src.url} className="text-[13px] leading-5">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-2 underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {src.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {onRegenerateDeepDive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={deepDiveLoading}
                  onClick={onRegenerateDeepDive}
                >
                  {deepDiveLoading ? "Regenerating…" : "Regenerate"}
                </Button>
              ) : null}
            </motion.div>
          </AnimatePresence>
        ) : onGenerateDeepDive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={onGenerateDeepDive}
          >
            Generate Deep Dive
          </Button>
        ) : null}
      </section>

      {snippets.length > 0 ? (
        <section className="flex flex-col gap-1.5" aria-label="Highlighted contents">
          <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Highlights
          </h3>
          <div className="flex flex-col gap-2">
            {snippets.map((snippet, i) => (
              <p key={`hl-${i}`} className="text-[15px] leading-[22px] text-pretty text-ink-2">
                {highlightNewsText(snippet, terms)}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {href ? (
        <div className="pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button asChild className="w-full gap-1.5 sm:w-auto">
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open original
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
});

export function NewsReaderPane({
  item,
  onClose,
  onExitComplete,
  highlightQuery,
  onTogglePin,
  pinBusy,
  onToggleRead,
  readBusy,
  className,
  brief,
  briefLoading,
  briefError,
  deepDive,
  deepDiveLoading,
  deepDiveError,
  onGenerateDeepDive,
  onRegenerateDeepDive,
}: {
  item: NewsFeedItem | null;
  onClose: () => void;
  /** Fires after the close exit animation finishes (for host layout). */
  onExitComplete?: () => void;
  highlightQuery?: string;
  onTogglePin?: (item: NewsFeedItem) => void;
  pinBusy?: boolean;
  onToggleRead?: (item: NewsFeedItem) => void;
  readBusy?: boolean;
  className?: string;
  brief?: NewsBriefView | null;
  briefLoading?: boolean;
  briefError?: string | null;
  deepDive?: NewsDeepDiveView | null;
  deepDiveLoading?: boolean;
  deepDiveError?: string | null;
  onGenerateDeepDive?: () => void;
  /** When a deep dive already exists, optional regenerate handler */
  onRegenerateDeepDive?: () => void;
}) {
  const reduce = useReducedMotion();
  const canPin = typeof onTogglePin === "function";
  const canToggleRead = typeof onToggleRead === "function";
  const href = item?.canonicalUrl?.trim() || null;

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  return (
    <AnimatePresence initial={false} onExitComplete={onExitComplete}>
      {item ? (
        <motion.aside
          key="reader"
          className={cn("flex h-full min-h-0 flex-col bg-background", className)}
          aria-label="Story reader"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={
            reduce
              ? { opacity: 0, transition: tween.exit }
              : { opacity: 0, x: 12, transition: tween.exit }
          }
          transition={reduce ? tween.fade : spring.settle}
        >
          <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border bg-background text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]"
              aria-label="Close reader"
            >
              <X className="size-4" aria-hidden />
            </button>
            <div className="flex items-center gap-2">
              {canToggleRead ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={readBusy}
                  aria-pressed={item.isRead}
                  onClick={() => onToggleRead(item)}
                >
                  {item.isRead ? "Mark unread" : "Mark read"}
                </Button>
              ) : null}
              {canPin ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pinBusy}
                  aria-pressed={item.isPinned}
                  onClick={() => onTogglePin(item)}
                >
                  <Pin className={`size-3.5 ${item.isPinned ? "fill-current" : ""}`} aria-hidden />
                  {item.isPinned ? "Unpin" : "Pin"}
                </Button>
              ) : null}
              {href ? (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open original in new tab"
                  >
                    <Maximize2 className="size-3.5" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Open</span>
                  </a>
                </Button>
              ) : null}
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <ReaderBody
                key={item.id}
                item={item}
                highlightQuery={highlightQuery}
                brief={brief}
                briefLoading={briefLoading}
                briefError={briefError}
                deepDive={deepDive}
                deepDiveLoading={deepDiveLoading}
                deepDiveError={deepDiveError}
                onGenerateDeepDive={onGenerateDeepDive}
                onRegenerateDeepDive={onRegenerateDeepDive}
                reduce={reduce}
              />
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
