import { describe, expect, test } from "bun:test";
import {
  QUICK_GADGET_INTENTS,
  composeRtcfc,
  exampleSeed,
  formatClock,
  needsRtcfcStructure,
  resolveQuickGadget,
  rollRtcfc,
} from "./gadgets.js";

describe("QUICK_GADGET_INTENTS", () => {
  test("covers daily loops plus rtcfc", () => {
    expect([...QUICK_GADGET_INTENTS].sort()).toEqual([
      "convert",
      "rtcfc",
      "split",
      "timer",
      "tip",
    ]);
  });
});

describe("resolveQuickGadget", () => {
  test("resolves tip with percent and total", () => {
    const g = resolveQuickGadget("18% tip on $90");
    expect(g?.intent).toBe("tip");
    expect(g?.ready).toBe(true);
    expect(g?.lines.some((l) => /tip/i.test(l))).toBe(true);
    expect(g?.lines.some((l) => /\$16\.2|\$16\.20/.test(l))).toBe(true);
  });

  test("bare amount defaults to tip at 15%", () => {
    const g = resolveQuickGadget("248000");
    expect(g?.intent).toBe("tip");
    expect(g?.ready).toBe(true);
    expect(g?.assumedTipPercent).toBe(true);
  });

  test("resolves split bill", () => {
    const g = resolveQuickGadget("split $40 for 3");
    expect(g?.intent).toBe("split");
    expect(g?.ready).toBe(true);
    expect(g?.lines.some((l) => /each/i.test(l))).toBe(true);
  });

  test("resolves timer focus phrase", () => {
    const g = resolveQuickGadget("25 min focus");
    expect(g?.intent).toBe("timer");
    expect(g?.ready).toBe(true);
    expect(g?.timerSeconds).toBe(25 * 60);
  });

  test("resolves unit convert", () => {
    const g = resolveQuickGadget("10 km to mi");
    expect(g?.intent).toBe("convert");
    expect(g?.ready).toBe(true);
    expect(g?.lines[0]).toMatch(/6\.21/);
  });

  test("honors preferred intent for ambiguous text", () => {
    const g = resolveQuickGadget("90", "tip");
    expect(g?.intent).toBe("tip");
  });

  test("returns null for unrelated text", () => {
    expect(resolveQuickGadget("Cafe Lomi Paris")).toBeNull();
    expect(resolveQuickGadget("AI semiconductor headlines")).toBeNull();
    expect(resolveQuickGadget("")).toBeNull();
  });

  test("preferred intent with empty text uses example seed", () => {
    const g = resolveQuickGadget("", "timer");
    expect(g?.intent).toBe("timer");
    expect(g?.query).toBe(exampleSeed("timer"));
    expect(g?.ready).toBe(true);
  });

  test("resolves labeled RTCFC prompt", () => {
    const g = resolveQuickGadget(
      "Role: staff engineer. Task: review this PR. Context: NestJS. Format: severity table. Constraints: skip style nits",
    );
    expect(g?.intent).toBe("rtcfc");
    expect(g?.ready).toBe(true);
    expect(g?.needsStructure).toBe(false);
    expect(g?.lines.some((l) => /^Role:/i.test(l))).toBe(true);
    expect(g?.rtcfc?.task).toMatch(/review/i);
  });

  test("rtcfc keyword with freeform needs structure", () => {
    const g = resolveQuickGadget("rtcfc review this NestJS PR for security");
    expect(g?.intent).toBe("rtcfc");
    expect(g?.needsStructure).toBe(true);
    expect(g?.ready).toBe(false);
  });

  test("preferred rtcfc with empty text uses labeled seed", () => {
    const g = resolveQuickGadget("", "rtcfc");
    expect(g?.intent).toBe("rtcfc");
    expect(g?.ready).toBe(true);
    expect(g?.lines.join("\n")).toContain("Role:");
  });
});

describe("composeRtcfc / rollRtcfc", () => {
  test("compose joins labeled fields", () => {
    const text = composeRtcfc({
      role: "coach",
      task: "summarize",
      context: "notes",
      format: "5 bullets",
      constraints: "no jargon",
    });
    expect(text).toContain("Role: coach");
    expect(text).toContain("Constraints: no jargon");
  });

  test("roll returns a complete sample", () => {
    const sample = rollRtcfc();
    expect(sample.role.length).toBeGreaterThan(0);
    expect(needsRtcfcStructure(composeRtcfc(sample), sample)).toBe(false);
  });
});

describe("formatClock", () => {
  test("formats mm:ss and h:mm:ss", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3661)).toBe("1:01:01");
  });
});

describe("exampleSeed", () => {
  test("returns a seed per quick intent", () => {
    for (const intent of QUICK_GADGET_INTENTS) {
      expect(exampleSeed(intent).length).toBeGreaterThan(3);
    }
  });
});
