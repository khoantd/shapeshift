import { describe, expect, test } from "bun:test";
import { toAiLanguage } from "./appLocale";

describe("toAiLanguage", () => {
  test("maps vi locale", () => {
    expect(toAiLanguage("vi")).toBe("vi");
  });

  test("defaults unknown locales to en", () => {
    expect(toAiLanguage("en")).toBe("en");
    expect(toAiLanguage("fr")).toBe("en");
    expect(toAiLanguage("")).toBe("en");
  });
});
