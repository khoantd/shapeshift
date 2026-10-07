import type { ReactNode } from "react";
import { BrandBackdrop } from "./BrandBackdrop";

export type BrandSurfaceTone = "sidebar" | "main" | "header" | "rail";

const TONE: Record<
  BrandSurfaceTone,
  { src: string; scrub: "light" | "medium" | "heavy"; position: string }
> = {
  sidebar: { src: "/brand/main.jpg", scrub: "medium", position: "left center" },
  main: { src: "/brand/main.jpg", scrub: "light", position: "center top" },
  header: { src: "/brand/header.jpg", scrub: "medium", position: "center bottom" },
  rail: { src: "/brand/header.jpg", scrub: "medium", position: "left top" },
};

type Props = {
  tone?: BrandSurfaceTone;
  className?: string;
  children: ReactNode;
};

/**
 * Feature chrome shell: brand atmosphere under translucent panel content.
 * Use for left sidebars, study panels, and main columns (not video/map pixels).
 */
export function BrandSurface({ tone = "sidebar", className = "", children }: Props) {
  const cfg = TONE[tone];
  return (
    <div className={`relative flex min-h-0 flex-col overflow-hidden bg-background/50 ${className}`}>
      <BrandBackdrop src={cfg.src} scrub={cfg.scrub} position={cfg.position} />
      <div className="relative z-[1] flex h-full min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
