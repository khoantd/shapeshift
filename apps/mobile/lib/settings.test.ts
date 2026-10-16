import { describe, expect, test } from "bun:test";
import {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  deepDiveLanguage,
  meanboxHref,
  normalizeApiBase,
  normalizeLocale,
} from "./settingsCore";

describe("normalizeApiBase", () => {
  test("trims trailing slashes and returns origin", () => {
    expect(normalizeApiBase("https://meanbox.vercel.app/")).toBe(
      "https://meanbox.vercel.app",
    );
    expect(normalizeApiBase("http://localhost:3000/api")).toBe(
      "http://localhost:3000",
    );
  });

  test("rejects non-http(s)", () => {
    expect(normalizeApiBase("ftp://x.com")).toBe("");
    expect(normalizeApiBase("not a url")).toBe("");
    expect(normalizeApiBase(null)).toBe("");
  });
});

describe("normalizeLocale", () => {
  test("accepts en and vi", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("vi")).toBe("vi");
    expect(normalizeLocale("fr")).toBe(DEFAULT_LOCALE);
  });
});

describe("deepDiveLanguage", () => {
  test("maps locale to deep-dive language", () => {
    expect(deepDiveLanguage("vi")).toBe("vi");
    expect(deepDiveLanguage("en")).toBe("en");
  });
});

describe("meanboxHref", () => {
  test("prefixes non-en locale", () => {
    expect(
      meanboxHref("/news?story=1", {
        apiBase: DEFAULT_API_BASE,
        locale: "vi",
      }),
    ).toBe("https://meanbox.vercel.app/vi/news?story=1");
    expect(
      meanboxHref("/gadgets?q=tip", {
        apiBase: DEFAULT_API_BASE,
        locale: "en",
      }),
    ).toBe("https://meanbox.vercel.app/gadgets?q=tip");
  });
});
