/** Pure recent-stack helpers (no AsyncStorage). */

export const RECENT_PAGE_SIZE = 5;

export type RecentKind =
  | "ask"
  | "link"
  | "split"
  | "translate"
  | "news"
  | "study"
  | "gadget";

export type RecentItem = {
  id: string;
  title: string;
  meta: string;
  kind: RecentKind;
  createdAt: number;
  href?: string;
};

export function filterRecentItems(
  items: RecentItem[],
  query: string,
): RecentItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    `${item.title} ${item.meta} ${item.kind}`.toLowerCase().includes(q),
  );
}

export function pageRecentItems(
  items: RecentItem[],
  page: number,
  pageSize: number = RECENT_PAGE_SIZE,
): RecentItem[] {
  const p = Math.max(1, Math.trunc(page));
  const size = Math.max(1, Math.trunc(pageSize));
  return items.slice(0, p * size);
}

export function isRecentItem(v: unknown): v is RecentItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.meta === "string" &&
    typeof o.kind === "string" &&
    typeof o.createdAt === "number"
  );
}
