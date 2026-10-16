import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { color, radius, spacing, tabs, tokens } from "./tokens";

const jsonPath = join(
  import.meta.dir,
  "../../../design-system/mobile/tokens.json",
);

describe("Meanbox mobile tokens", () => {
  test("matches design-system/mobile/tokens.json colors and radius", () => {
    const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      color: Record<string, string>;
      radius: Record<string, number>;
      spacing: Record<string, number>;
    };

    // Widen literals so expect() accepts JSON-parsed string/number values.
    expect(color.background as string).toBe(json.color.background);
    expect(color.foreground as string).toBe(json.color.foreground);
    expect(color.brand as string).toBe(json.color.brand);
    expect(color.brandSoft as string).toBe(json.color.brandSoft);
    expect(color.mutedForeground as string).toBe(json.color.mutedForeground);
    expect(color.ring as string).toBe(json.color.ring);
    expect(radius.sm as number).toBe(json.radius.sm);
    expect(radius.md as number).toBe(json.radius.md);
    expect(radius.shell as number).toBe(json.radius.shell);
    expect(radius.pill as number).toBe(json.radius.pill);
    expect(spacing.gutterPhone as number).toBe(json.spacing.gutterPhone);
    expect(spacing.tabBarHeight as number).toBe(json.spacing.tabBarHeight);
  });

  test("exports five bottom tabs", () => {
    expect(tabs).toEqual(["Ask", "News", "Study", "Tools", "More"]);
  });

  test("tokens bag is frozen shape", () => {
    expect(tokens.color.brand).toBe("#0f766e");
    expect(tokens.motion.pressScale).toBe(0.96);
    expect(tokens.icon.strokeWidth).toBe(1.75);
  });
});
