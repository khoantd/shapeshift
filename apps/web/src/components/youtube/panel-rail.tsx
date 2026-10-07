"use client";

import type { LucideIcon } from "lucide-react";

/** Shared icon button for collapsed sidebar rails. */
export function PanelRailButton({
  label,
  onClick,
  icon: Icon,
  pressed,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 lg:size-9 ${
        pressed
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
