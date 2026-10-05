"use client";

import type { LearningPackConcept } from "@/lib/youtube/learningPackConcepts";

type Props = {
  concept: LearningPackConcept;
  upcoming?: boolean;
  onSeek: (startSec: number) => void;
};

export function ConceptOverlay({ concept, upcoming = false, onSeek }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-start p-3 sm:p-4"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => onSeek(concept.startSec)}
        className="pointer-events-auto flex max-w-[min(100%,24rem)] cursor-pointer items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-left shadow-lg transition-[transform,background-color,opacity] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] motion-reduce:transition-none"
        aria-label={`${upcoming ? "Up next" : "Now"}: ${concept.title} at ${concept.timestampLabel}. Seek to this moment.`}
      >
        <span className="mt-0.5 flex shrink-0 flex-col items-start gap-0.5">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {upcoming ? "Up next" : "Key concept"}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {concept.timestampLabel}
          </span>
        </span>
        <span className="min-w-0 text-[13px] font-medium leading-5 text-pretty text-foreground">
          {concept.title}
        </span>
      </button>
    </div>
  );
}
