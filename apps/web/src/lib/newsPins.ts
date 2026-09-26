/** Local pin overrides so “pin for later” survives refresh if IC write fails. */

const KEY = "shapeshift:news-pins:v1";

export type NewsPinMap = Record<string, boolean>;

export function readNewsPinOverrides(): NewsPinMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: NewsPinMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean" && id.trim()) out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeNewsPinOverride(id: string, pinned: boolean): void {
  if (typeof window === "undefined") return;
  const key = id.trim();
  if (!key) return;
  try {
    const next = { ...readNewsPinOverrides(), [key]: pinned };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked.
  }
}

export function applyNewsPinOverrides<T extends { id: string; isPinned: boolean }>(
  items: T[],
  overrides: NewsPinMap,
): T[] {
  if (Object.keys(overrides).length === 0) return items;
  return items.map((item) => {
    if (!(item.id in overrides)) return item;
    const pinned = overrides[item.id];
    return item.isPinned === pinned ? item : { ...item, isPinned: pinned };
  });
}
