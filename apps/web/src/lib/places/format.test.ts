import { describe, expect, test } from "bun:test";
import { shortenOpenState } from "./format";

describe("shortenOpenState", () => {
  test("shortens Open with closing time", () => {
    expect(shortenOpenState("Open ⋅ Closes 10 PM")).toBe("Open");
    expect(shortenOpenState("Open - Closes 10 PM")).toBe("Open");
    expect(shortenOpenState("Open")).toBe("Open");
  });

  test("shortens Closed with opening time", () => {
    expect(shortenOpenState("Closed ⋅ Opens 8 AM")).toBe("Closed");
    expect(shortenOpenState("Closed")).toBe("Closed");
  });

  test("leaves unknown strings intact", () => {
    expect(shortenOpenState("Hours unavailable")).toBe("Hours unavailable");
  });

  test("handles empty and nullish", () => {
    expect(shortenOpenState("")).toBeUndefined();
    expect(shortenOpenState("   ")).toBeUndefined();
    expect(shortenOpenState(null)).toBeUndefined();
    expect(shortenOpenState(undefined)).toBeUndefined();
  });
});
