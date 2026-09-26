"use client";

import { useState } from "react";
import { ArrowUpRight, Newspaper, Pin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { collectNewsHighlightTerms, extractNewsHighlightSnippets, highlightNewsText } from "../lib/highlightNewsText";
import type { NewsFeedItem } from "./NewsFeedItemCard";

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

function NewsThumbnail({
  url,
  title,
  className,
}: {
  url?: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(url?.trim()) && !failed;

  return (
    <div
      className={
        className ??
        "relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-secondary"
      }
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
        <div className="flex size-full min-h-[10rem] items-center justify-center bg-gradient-to-br from-secondary to-background">
          <Newspaper className="size-10 text-muted-foreground opacity-50" aria-hidden />
          <span className="sr-only">{title}</span>
        </div>
      )}
    </div>
  );
}

export function NewsDetailCard({
  item,
  open,
  onOpenChange,
  highlightQuery,
  onTogglePin,
  onView,
  pinBusy,
}: {
  item: NewsFeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightQuery?: string;
  onTogglePin?: (item: NewsFeedItem) => void;
  /** When set, View opens the in-app reader instead of navigating away. */
  onView?: (item: NewsFeedItem) => void;
  pinBusy?: boolean;
}) {
  if (!item) return null;

  const when = relativeWhen(item.publishedAt);
  const source = item.sourceDisplayName?.trim() || null;
  const href = item.canonicalUrl?.trim() || null;
  const excerpt = item.excerpt.trim();
  const terms = collectNewsHighlightTerms(highlightQuery);
  const snippets = extractNewsHighlightSnippets(excerpt, terms);
  const canPin = typeof onTogglePin === "function";
  const canViewInApp = typeof onView === "function";
  const showView = canViewInApp || Boolean(href);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] gap-4 overflow-y-auto p-0 sm:max-w-lg">
        <NewsThumbnail
          url={item.thumbnailUrl}
          title={item.title}
          className="aspect-[16/9] w-full overflow-hidden rounded-t-xl border-0 border-b bg-secondary"
        />

        <div className="flex flex-col gap-4 px-6 pb-6">
          <DialogHeader className="gap-2 text-start">
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
            <DialogTitle className="text-[20px] leading-7 font-[550] text-balance">
              {item.title || "Untitled"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              News story detail from Inspired Canvas
            </DialogDescription>
          </DialogHeader>

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

          {snippets.length > 0 ? (
            <section className="flex flex-col gap-1.5" aria-label="Highlighted contents">
              <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                Highlights
              </h3>
              <div className="flex flex-col gap-2">
                {snippets.map((snippet, i) => (
                  <p
                    key={`hl-${i}`}
                    className="text-[15px] leading-[22px] text-pretty text-ink-2"
                  >
                    {highlightNewsText(snippet, terms)}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              {showView ? (
                canViewInApp ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onView(item)}
                  >
                    View
                  </Button>
                ) : (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={href!} target="_blank" rel="noopener noreferrer">
                      View
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </Button>
                )
              ) : null}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
