/** Pure API helpers (no fetch / AsyncStorage). */

import type { MeanboxLocale } from "./settingsCore";

export type NewsFeedItem = {
  id: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string;
  isRead: boolean;
  isPinned: boolean;
  sourceDisplayName?: string;
  thumbnailUrl?: string | null;
};

export type IntentResult = {
  topIntent?: string;
  intent?: string;
  confidence?: number;
  error?: string;
  [key: string]: unknown;
};

export function formatRelativeTime(
  iso: string,
  nowMs: number = Date.now(),
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function newsCategoryMatch(item: NewsFeedItem, cat: string): boolean {
  if (!cat || cat === "Top") return true;
  const hay =
    `${item.sourceDisplayName ?? ""} ${item.title} ${item.excerpt}`.toLowerCase();
  const needles: Record<string, string[]> = {
    Tech: ["tech", "ai", "software", "apple", "google", "chip", "rust", "code"],
    World: ["world", "market", "bank", "policy", "nation", "global"],
    Science: ["science", "nature", "space", "battery", "research", "climate"],
  };
  const list = needles[cat] ?? [cat.toLowerCase()];
  return list.some((n) => hay.includes(n));
}

export function intentTopKey(result: IntentResult | null | undefined): string {
  if (!result) return "none";
  const top =
    typeof result.topIntent === "string"
      ? result.topIntent
      : typeof result.intent === "string"
        ? result.intent
        : "none";
  return top.trim().toLowerCase() || "none";
}

export function oauthStartUrl(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, "")}/api/youtube/oauth/start`;
}

export function languageFromLocale(locale: MeanboxLocale): "en" | "vi" {
  return locale === "vi" ? "vi" : "en";
}
