"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import type { PlaceData } from "@shapeshift/core/parse/place";
import { Field, Meta, Missing } from "./shared";
import type { CardProps } from "./types";

export function placesHref(data: PlaceData): string {
  const params = new URLSearchParams();
  const q = data.query.trim();
  if (q) params.set("q", q);
  if (data.category) params.set("category", data.category);
  const qs = params.toString();
  return qs ? `/places?${qs}` : "/places";
}

export function PlaceCard({ data, interactive }: CardProps<PlaceData>) {
  const href = placesHref(data);

  return (
    <div className="flex flex-col gap-3">
      <Field index={0} className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-ink-2">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {data.query ? (
            <h2 className="text-[17px] leading-6 font-[550] tracking-[-0.01em] text-balance">
              {data.query}
            </h2>
          ) : (
            <Missing>Address or place to find</Missing>
          )}
          <Meta className="mt-0.5">
            {data.category
              ? `Category: ${data.category} · Places search on map`
              : "Places search on map"}
          </Meta>
        </div>
      </Field>
      {interactive && (
        <Field index={1}>
          <a
            href={href}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground shadow-xs transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]"
          >
            Open map
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </Field>
      )}
    </div>
  );
}
