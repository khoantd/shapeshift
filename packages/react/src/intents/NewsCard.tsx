"use client";

import { ArrowUpRight, CircleAlert, Newspaper } from "lucide-react";
import type { NewsData } from "@shapeshift/core/parse/news";
import { Chip, Field, Meta, Missing } from "./shared";
import type { CardProps } from "./types";

export function newsFeedHref(data: NewsData): string {
  const params = new URLSearchParams();
  if (data.topic) params.set("q", data.topic);
  if (data.criticalOnly) params.set("critical", "1");
  if (data.sourceHint) params.set("source", data.sourceHint);
  const qs = params.toString();
  return qs ? `/news?${qs}` : "/news";
}

export function NewsCard({ data, signals, interactive }: CardProps<NewsData>) {
  const href = newsFeedHref(data);
  const urgent = Boolean(signals.urgent) || data.criticalOnly;

  return (
    <div className="flex flex-col gap-3">
      <Field index={0}>
        {data.topic ? (
          <h2 className="text-[17px] leading-6 font-[550] tracking-[-0.01em] text-balance">{data.topic}</h2>
        ) : (
          <Missing>Topic to follow</Missing>
        )}
      </Field>
      <Field index={1} className="flex flex-wrap items-center gap-2">
        {data.sourceHint ? (
          <Chip icon={Newspaper}>{data.sourceHint}</Chip>
        ) : (
          <Chip icon={Newspaper}>Any source</Chip>
        )}
        {urgent ? (
          <Chip icon={CircleAlert} className="text-[var(--caution)]">
            Critical
          </Chip>
        ) : data.criticalOnly ? (
          <Chip icon={CircleAlert}>Critical only</Chip>
        ) : null}
      </Field>
      <Field index={2}>
        <Meta>Scans your curated Inspired Canvas feed</Meta>
      </Field>
      {interactive && (
        <Field index={3}>
          <a
            href={href}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground shadow-xs transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]"
          >
            Open feed
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </Field>
      )}
    </div>
  );
}
