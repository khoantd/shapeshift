import { describe, expect, test } from "bun:test";
import type { SavedItem } from "./savedItems";
import {
  SAVED_PAGE_SIZE,
  filterSavedItems,
  pageSavedItems,
} from "./filterSavedItems";

const labels: Record<string, string> = {
  tip: "Tip",
  timer: "Timer",
  split: "Split bill",
};

function item(
  partial: Pick<SavedItem, "id" | "intent" | "summary"> & Partial<SavedItem>,
): SavedItem {
  return {
    text: partial.text ?? partial.summary,
    createdAt: partial.createdAt ?? partial.id,
    ...partial,
  };
}

const sample: SavedItem[] = [
  item({ id: 1, intent: "tip", summary: "15% on dinner", text: "tip 15% of $80" }),
  item({ id: 2, intent: "timer", summary: "Focus block", text: "25 min focus" }),
  item({ id: 3, intent: "split", summary: "Lunch with 3", text: "split $45 three ways" }),
  item({ id: 4, intent: "tip", summary: "Coffee tip", text: "tip $2" }),
  item({ id: 5, intent: "timer", summary: "Pomodoro", text: "timer 25" }),
  item({ id: 6, intent: "split", summary: "Dinner bill", text: "split $120" }),
];

describe("filterSavedItems", () => {
  test("empty or whitespace query returns all items", () => {
    expect(filterSavedItems(sample, "", (i) => labels[i] ?? i)).toEqual(sample);
    expect(filterSavedItems(sample, "   ", (i) => labels[i] ?? i)).toEqual(sample);
  });

  test("matches summary case-insensitively", () => {
    const hits = filterSavedItems(sample, "FOCUS", (i) => labels[i] ?? i);
    expect(hits.map((x) => x.id)).toEqual([2]);
  });

  test("matches intent label", () => {
    const hits = filterSavedItems(sample, "split bill", (i) => labels[i] ?? i);
    expect(hits.map((x) => x.id)).toEqual([3, 6]);
  });

  test("matches body text", () => {
    const hits = filterSavedItems(sample, "$80", (i) => labels[i] ?? i);
    expect(hits.map((x) => x.id)).toEqual([1]);
  });

  test("returns empty when nothing matches", () => {
    expect(filterSavedItems(sample, "zzz-nope", (i) => labels[i] ?? i)).toEqual([]);
  });
});

describe("pageSavedItems", () => {
  test("SAVED_PAGE_SIZE is 5", () => {
    expect(SAVED_PAGE_SIZE).toBe(5);
  });

  test("slices to visibleCount and reports hasMore", () => {
    const page = pageSavedItems(sample, SAVED_PAGE_SIZE);
    expect(page.visible.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(6);
  });

  test("hasMore is false when all items are shown", () => {
    const page = pageSavedItems(sample, sample.length);
    expect(page.visible).toEqual(sample);
    expect(page.hasMore).toBe(false);
  });
});
