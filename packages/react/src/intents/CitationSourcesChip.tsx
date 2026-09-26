"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../lib/utils";
import {
  faviconUrlFor,
  sourcesLabel,
  type CiteSource,
} from "../lib/webCitations";

const MAX_VISIBLE_ICONS = 3;
function FaviconCircle({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrlFor(url);

  return (
    <span
      className={cn(
        "relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-background",
        className,
      )}
      aria-hidden
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={16}
          height={16}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe className="size-2.5 text-muted-foreground" />
      )}
    </span>
  );
}

/**
 * Inline citation chip: overlapping favicons + "N sources", popover lists links.
 */
export function CitationSourcesChip({
  sources,
  className,
}: {
  sources: CiteSource[];
  className?: string;
}) {
  if (sources.length === 0) return null;

  const visible = sources.slice(0, MAX_VISIBLE_ICONS);
  const label = sourcesLabel(sources.length);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "ms-0.5 me-0.5 inline-flex max-w-full items-center gap-1.5 align-middle rounded-md px-0.5 py-0.5 text-[13px] leading-4 text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className,
          )}
          aria-label={label}
        >
          <span className="inline-flex items-center ps-0.5">
            {visible.map((src, i) => (
              <FaviconCircle
                key={src.url}
                url={src.url}
                className={i === 0 ? undefined : "-ms-1.5"}
              />
            ))}
          </span>
          <span className="whitespace-nowrap">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 gap-0 p-2"
      >
        <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {sources.map((src) => (
            <li key={src.url}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 font-medium text-ink-2 no-underline transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <FaviconCircle url={src.url} className="mt-0.5" />
                <span className="min-w-0 flex-1 break-words">{src.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
