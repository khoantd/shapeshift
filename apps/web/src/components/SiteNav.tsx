"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/news", label: "News" },
  { href: "/places", label: "Places" },
  { href: "/youtube", label: "YouTube" },
] as const;

const LINK_BASE =
  "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md px-2.5 text-[13px] font-medium transition-[color,background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? `${LINK_BASE} bg-muted text-foreground`
                : `${LINK_BASE} text-muted-foreground hover:bg-muted/60 hover:text-foreground`
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
