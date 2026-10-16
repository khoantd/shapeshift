/** Local Ask recent stack — searchable, page size 5. */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isRecentItem,
  type RecentItem,
  type RecentKind,
} from "./recentCore";

export {
  RECENT_PAGE_SIZE,
  filterRecentItems,
  pageRecentItems,
  type RecentItem,
  type RecentKind,
} from "./recentCore";

const STORAGE_KEY = "meanbox.recent";
const MAX_ITEMS = 40;

export async function loadRecent(): Promise<RecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecentItem)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export async function appendRecent(
  input: Omit<RecentItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): Promise<RecentItem[]> {
  const items = await loadRecent();
  const next: RecentItem = {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(input.title || "").trim().slice(0, 200) || "Untitled",
    meta: String(input.meta || "").trim().slice(0, 120),
    kind: input.kind,
    createdAt: input.createdAt ?? Date.now(),
    href: input.href,
  };
  const deduped = [
    next,
    ...items.filter(
      (i) => i.title.toLowerCase() !== next.title.toLowerCase(),
    ),
  ].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
  return deduped;
}

export type { RecentKind as Kind };
