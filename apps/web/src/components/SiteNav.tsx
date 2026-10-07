"use client";

import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const NAV_ITEMS = [
  { href: "/gadgets" as const, key: "gadgets" as const },
  { href: "/news" as const, key: "news" as const },
  { href: "/places" as const, key: "places" as const },
  { href: "/youtube" as const, key: "youtube" as const },
  { href: "/github" as const, key: "github" as const },
];

const LINK_BASE =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium transition-[color,background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96] md:h-8 md:min-h-0 md:px-2.5";

const MENU_LINK_BASE =
  "flex min-h-11 w-full cursor-pointer items-center rounded-md px-3 text-[15px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function SiteNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const linkClass = (active: boolean, mobile = false) => {
    const base = mobile ? MENU_LINK_BASE : LINK_BASE;
    return active
      ? `${base} bg-muted text-foreground`
      : `${base} text-muted-foreground hover:bg-muted/60 hover:text-foreground`;
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <nav
        aria-label={t("primary")}
        className="hidden min-w-0 items-center gap-0.5 md:flex"
      >
        {NAV_ITEMS.map(({ href, key }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={linkClass(active)}
            >
              {t(key)}
            </Link>
          );
        })}
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-background/60 backdrop-blur-sm"
            aria-label={t("closeMenu")}
            onClick={() => setMenuOpen(false)}
          />
          <div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
            className="absolute inset-x-0 top-[calc(3rem+env(safe-area-inset-top,0px))] border-b border-border bg-background/95 px-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] py-3 shadow-lg backdrop-blur-md"
          >
            <nav aria-label={t("primary")} className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, key }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active, true)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(key)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
