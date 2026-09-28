"use client";

import { MapPin, Users, type LucideIcon } from "lucide-react";
import { useMemo } from "react";

export type PlaceCategoryOption = {
  name: string;
  /** Hint shown to the right of the category name. */
  example: string;
  /** Optional row icon; defaults to MapPin. */
  icon?: LucideIcon;
};

/**
 * Inline slash-category suggestions for the places search field.
 * Filtering is driven by the parent input (`/shop coffee` → token `shop`) so
 * focus never leaves the search box — no modal, no backdrop blur.
 */
export function PlaceCategoryPalette({
  open,
  categories,
  filterQuery,
  activeIndex = -1,
  listboxId,
  onPick,
}: {
  open: boolean;
  categories: PlaceCategoryOption[];
  filterQuery: string;
  /** Highlighted row for keyboard nav from the search input. */
  activeIndex?: number;
  listboxId?: string;
  onPick: (categoryName: string) => void;
}) {
  const visible = useMemo(() => {
    const token = filterQuery.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!token) return categories;
    return categories.filter((c) => c.name.toLowerCase().startsWith(token));
  }, [categories, filterQuery]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
      role="presentation"
    >
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Place categories"
        className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain py-1"
      >
        {visible.length === 0 ? (
          <li className="px-3 py-4 text-center text-[13px] text-muted-foreground" role="status">
            No category matches. Try another name.
          </li>
        ) : (
          visible.map((category, i) => {
            const active = i === activeIndex;
            const Icon = category.icon ?? MapPin;
            return (
              <li key={category.name} role="presentation">
                <button
                  type="button"
                  id={listboxId ? `${listboxId}-option-${i}` : undefined}
                  role="option"
                  aria-selected={active}
                  // Keep focus on the search input; mousedown would steal it.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(category.name)}
                  className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
                    active ? "bg-muted" : "hover:bg-muted/70"
                  }`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-secondary text-foreground">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="w-24 shrink-0 truncate text-[14px] font-medium">
                    {category.name}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-pretty text-muted-foreground">
                    {category.example || "keywords…"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/** Categories visible for a given slash filter (first token). Exported for keyboard nav. */
export function filterPlaceCategories(
  categories: PlaceCategoryOption[],
  filterQuery: string,
): PlaceCategoryOption[] {
  const token = filterQuery.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!token) return categories;
  return categories.filter((c) => c.name.toLowerCase().startsWith(token));
}
