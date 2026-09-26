"use client";

import { useState } from "react";
import { ArrowUpRight, Newspaper, Pin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { spring, tween } from "../lib/motion";
import { cn } from "../lib/utils";
import { Meta } from "./shared";

export type NewsFeedItem = {
  id: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string;
  isRead: boolean;
  isPinned: boolean;
  sourceDisplayName?: string;
  thumbnailUrl?: string | null;
  deepDive?: {
    text: string;
    sources: Array<{ title: string; url: string }>;
  } | null;
  brief?: {
    urgency: number;
    relevance: number;
    tone: "neutral" | "caution" | "opportunity";
    line: string;
    source?: "jev" | "mock";
    query?: string | null;
  } | null;
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

function ListThumb({ url, title }: { url?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(url?.trim()) && !failed;

  return (
    <div
      className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-secondary"
      aria-hidden
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
        <div className="flex size-full items-center justify-center">
          <Newspaper className="size-4 text-muted-foreground opacity-50" aria-hidden />
          <span className="sr-only">{title}</span>
        </div>
      )}
    </div>
  );
}

export function NewsFeedItemCard({
  item,
  index = 0,
  className,
  onSelect,
  onTogglePin,
  pinBusy,
  briefBadge,
}: {
  item: NewsFeedItem;
  index?: number;
  className?: string;
  onSelect?: (item: NewsFeedItem) => void;
  onTogglePin?: (item: NewsFeedItem) => void;
  pinBusy?: boolean;
  /** Optional Jev brief hint shown under the excerpt. */
  briefBadge?: string;
}) {
  const reduce = useReducedMotion();
  const when = relativeWhen(item.publishedAt);
  const source = item.sourceDisplayName?.trim() || null;
  const takeaway = item.excerpt.trim();
  const selectable = typeof onSelect === "function";
  const canPin = typeof onTogglePin === "function";

  const main = (
    <motion.article
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduce ? tween.fade : { ...spring.settle, delay: Math.min(0.24, 0.03 + index * 0.03) }}
      className={cn(
        "group flex min-w-0 flex-1 gap-2.5 py-3",
        !item.isRead && "ps-3 border-s-2 border-s-[var(--brand)]",
        className,
      )}
    >
      <ListThumb url={item.thumbnailUrl} title={item.title} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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
        <h2
          className={cn(
            "text-[15px] leading-5 font-[550] text-pretty",
            selectable && "group-hover:underline group-focus-within:underline",
          )}
        >
          {item.title || "Untitled"}
          {selectable && (
            <ArrowUpRight
              className="ms-1 inline size-3.5 align-baseline text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              aria-hidden
            />
          )}
        </h2>
        {takeaway ? (
          <p className="line-clamp-1 text-[13px] leading-5 text-pretty text-ink-2">{takeaway}</p>
        ) : (
          <Meta>No takeaway available</Meta>
        )}
        {briefBadge ? (
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {briefBadge}
          </p>
        ) : null}
      </div>
    </motion.article>
  );

  return (
    <div className="flex items-start gap-1 border-b border-border/70 last:border-b-0">
      {selectable ? (
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="min-w-0 flex-1 cursor-pointer rounded-sm text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {main}
        </button>
      ) : (
        main
      )}
      {canPin ? (
        <button
          type="button"
          onClick={() => onTogglePin(item)}
          disabled={pinBusy}
          aria-pressed={item.isPinned}
          aria-label={item.isPinned ? "Unpin for later" : "Pin for later"}
          title={item.isPinned ? "Unpin" : "Pin for later"}
          className={cn(
            "mt-2.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50",
            item.isPinned && "text-[var(--brand)]",
          )}
        >
          <Pin className={cn("size-3.5", item.isPinned && "fill-current")} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
