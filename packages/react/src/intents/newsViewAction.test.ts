import { describe, expect, test } from "bun:test";

/**
 * Mirrors NewsDetailCard View button branching (in-app callback vs external link).
 */
function resolveNewsViewAction(opts: {
  onView?: (item: unknown) => void;
  href?: string | null;
}): "in-app" | "external" | "none" {
  if (typeof opts.onView === "function") return "in-app";
  if (opts.href?.trim()) return "external";
  return "none";
}

describe("resolveNewsViewAction", () => {
  test("prefers in-app when onView is provided", () => {
    expect(
      resolveNewsViewAction({
        onView: () => {},
        href: "https://example.com",
      }),
    ).toBe("in-app");
  });

  test("falls back to external when only href exists", () => {
    expect(resolveNewsViewAction({ href: "https://example.com" })).toBe("external");
  });

  test("hides View when neither onView nor href", () => {
    expect(resolveNewsViewAction({})).toBe("none");
    expect(resolveNewsViewAction({ href: "  " })).toBe("none");
  });
});
