"use client";

import { Newspaper } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";

export type NewsSourceOption = {
  name: string;
  /** Hint shown to the right of the source name (e.g. a recent headline). */
  example: string;
};

/**
 * Slash-command palette for news sources — same layout as IntentPalette,
 * but rows are feed sources instead of card types.
 */
export function NewsSourcePalette({
  open,
  onOpenChange,
  sources,
  filterQuery,
  onFilterQueryChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: NewsSourceOption[];
  filterQuery: string;
  onFilterQueryChange: (query: string) => void;
  onPick: (sourceName: string) => void;
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filter by source"
      description="Pick a feed source, then add topic keywords"
      className="shadow-[var(--shadow-float)] data-closed:animate-none data-open:animate-none sm:max-w-[480px]"
    >
      <Command>
        <CommandInput
          placeholder="Filter by source…"
          value={filterQuery}
          onValueChange={onFilterQueryChange}
          className="text-base sm:text-sm"
        />
        <CommandList className="max-h-[420px] overscroll-contain">
          <CommandEmpty>
            {sources.length === 0
              ? "No sources in this feed yet."
              : "No source matches. Try another name."}
          </CommandEmpty>
          <CommandGroup>
            {sources.map((source) => (
              <CommandItem
                key={source.name}
                value={`${source.name} ${source.example}`}
                onSelect={() => onPick(source.name)}
                className="min-h-12 gap-3"
              >
                <span className="bg-secondary text-foreground grid size-8 shrink-0 place-items-center rounded-sm">
                  <Newspaper className="size-[18px]" aria-hidden />
                </span>
                <span className="w-28 shrink-0 truncate text-[14px] font-medium">{source.name}</span>
                <span className="text-muted-foreground min-w-0 truncate text-[13px] text-pretty">
                  {source.example || "topic keywords…"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
