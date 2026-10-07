/**
 * Padding-top matching the fixed SiteChrome header:
 * h-12 row + safe-area inset when the header grows on notched devices.
 */
export const SITE_CHROME_OFFSET_CLASS =
  "pt-[calc(3rem+env(safe-area-inset-top,0px))]";
