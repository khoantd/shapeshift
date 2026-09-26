import { z } from "zod";
import { INTENT_KEYS } from "@shapeshift/core/jev/types";

/** Completed cards, persisted until the user deletes them. */
export const savedItemSchema = z.object({
  id: z.number(),
  intent: z.enum(INTENT_KEYS).exclude(["none"]),
  summary: z.string(),
  text: z.string(),
  createdAt: z.number(),
});
export type SavedItem = z.infer<typeof savedItemSchema>;

export type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Optional cross-tab sync; return unsubscribe. */
  subscribe?(key: string, onChange: () => void): () => void;
};

const memoryStore = new Map<string, string>();

/** In-memory adapter (SSR embeds / tests). */
export const memoryStorage: StorageAdapter = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
};

/** Browser localStorage adapter with StorageEvent cross-tab sync. */
export const localStorageAdapter: StorageAdapter = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked.
    }
  },
  subscribe: (key, onChange) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
};

const KEY = "shapeshift:saved:v1";
const EMPTY: SavedItem[] = [];
let items: SavedItem[] | null = null;
/** Demo mode records into memory only, so it never touches the user's saved list. */
let ephemeral = false;
let adapter: StorageAdapter = typeof window !== "undefined" ? localStorageAdapter : memoryStorage;
const listeners = new Set<() => void>();

function load(): SavedItem[] {
  try {
    const parsed = z.array(savedItemSchema).safeParse(JSON.parse(adapter.getItem(KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export const savedItems = {
  /** Swap persistence backend (call before first read when embedding). */
  setStorage(next: StorageAdapter) {
    adapter = next;
    items = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    const unsubStorage = !ephemeral && adapter.subscribe ? adapter.subscribe(KEY, () => {
      items = load();
      listener();
    }) : undefined;
    return () => {
      listeners.delete(listener);
      unsubStorage?.();
    };
  },
  getSnapshot(): SavedItem[] {
    if (items === null) items = load();
    return items;
  },
  getServerSnapshot(): SavedItem[] {
    return EMPTY;
  },
  update(fn: (prev: SavedItem[]) => SavedItem[]) {
    items = fn(savedItems.getSnapshot());
    if (!ephemeral) {
      adapter.setItem(KEY, JSON.stringify(items));
    }
    emit();
  },
  setEphemeral(on: boolean) {
    if (ephemeral === on) return;
    ephemeral = on;
    items = on ? [] : load();
    emit();
  },
};

let last = 0;
/** Unique, increasing ids that never collide with ones already saved. */
export function newId() {
  last = Math.max(Date.now(), last + 1);
  return last;
}
