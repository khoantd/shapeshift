import { describe, expect, test } from "bun:test";
import {
  clipString,
  normalizeDedupeKey,
  sanitizePayload,
  upsertLocalItem,
} from "./localHistory.js";

describe("localHistory helpers", () => {
  test("normalizeDedupeKey prefixes kind", () => {
    expect(normalizeDedupeKey("learning_pack", "abc123")).toBe(
      "learning_pack:abc123",
    );
    expect(normalizeDedupeKey("learning_pack", "")).toBe(
      "learning_pack:unknown",
    );
  });

  test("clipString trims and caps", () => {
    expect(clipString("  hi  ", 10)).toBe("hi");
    expect(clipString("x".repeat(20), 5)).toBe("xxxxx");
  });

  test("sanitizePayload caps learning pack fields", () => {
    const p = sanitizePayload(
      {
        videoId: "dQw4w9WgXcQ",
        title: "T",
        markdown: "m".repeat(200_000),
        transcript: "t".repeat(200_000),
      },
      "learning_pack",
    );
    expect(p.markdown.length).toBeLessThanOrEqual(120_000);
    expect(p.transcript.length).toBeLessThanOrEqual(100_000);
    expect(p.contentType).toBe("lecture");
  });

  test("upsertLocalItem dedupes by kind+dedupeKey and caps count", () => {
    const base = {
      id: "a",
      kind: "gadget",
      dedupeKey: "gadget:tip",
      createdAt: 1,
      syncedAt: null,
      apiBase: "https://meanbox.vercel.app",
      payload: { query: "tip 15%" },
    };
    let list = [base];
    list = upsertLocalItem(list, {
      ...base,
      id: "b",
      createdAt: 2,
      payload: { query: "tip 20%" },
    });
    expect(list).toHaveLength(1);
    expect(list[0].payload.query).toBe("tip 20%");
    expect(list[0].id).toBe("a");
  });
});
