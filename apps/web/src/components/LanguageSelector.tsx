"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

const SELECT =
  "min-h-11 cursor-pointer rounded-md border border-border/80 bg-background/90 px-2.5 text-[12px] font-medium text-foreground shadow-xs transition-[color,background-color] duration-150 ease-out hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-8 md:min-h-0 md:px-2";

export function LanguageSelector() {
  const t = useTranslations("Language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (next: string) => {
    if (!routing.locales.includes(next as AppLocale)) return;
    router.replace(pathname, { locale: next as AppLocale });
  };

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{t("label")}</span>
      <select
        className={SELECT}
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("label")}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
