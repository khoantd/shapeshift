import { describe, expect, test } from "bun:test";
import { resolveQuickGadget } from "./gadgets";

describe("resolveQuickGadget", () => {
  test("tip 18% on $70", () => {
    const g = resolveQuickGadget("tip 18% on $70", "tip");
    expect(g?.intent).toBe("tip");
    expect(g?.ready).toBe(true);
    expect(g?.badge).toBe("18%");
    expect(g?.amount).toContain("12.6");
  });

  test("split $40 for 3", () => {
    const g = resolveQuickGadget("split $40 for 3", "split");
    expect(g?.intent).toBe("split");
    expect(g?.ready).toBe(true);
    expect(g?.amount).toContain("13.33");
  });

  test("convert 10 km to mi", () => {
    const g = resolveQuickGadget("10 km to mi", "convert");
    expect(g?.intent).toBe("convert");
    expect(g?.ready).toBe(true);
    expect(g?.amount?.toLowerCase()).toContain("mi");
  });

  test("timer 25 min", () => {
    const g = resolveQuickGadget("25 min focus", "timer");
    expect(g?.intent).toBe("timer");
    expect(g?.ready).toBe(true);
    expect(g?.timerSeconds).toBe(25 * 60);
  });

  test("rtcfc labeled parse", () => {
    const g = resolveQuickGadget(
      "Role: coach. Task: brief. Context: SaaS. Format: 5 bullets. Constraints: No jargon.",
      "rtcfc",
    );
    expect(g?.intent).toBe("rtcfc");
    expect(g?.ready).toBe(true);
    expect(g?.rtcfc?.role).toContain("coach");
  });
});
