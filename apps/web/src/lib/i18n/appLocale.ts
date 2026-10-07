import type { AppLocale } from "@/i18n/routing";

/** Map next-intl locale → AI output language (`en` | `vi`). */
export function toAiLanguage(locale: string): AppLocale {
  return locale === "vi" ? "vi" : "en";
}
