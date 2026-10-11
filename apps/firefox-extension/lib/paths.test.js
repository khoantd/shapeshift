import { describe, expect, test } from "bun:test";
import {
  gadgetsPath,
  newsPath,
  placesPath,
  resolveOmniboxPath,
} from "./paths.js";

describe("gadgetsPath", () => {
  test("opens shelf without query", () => {
    expect(gadgetsPath("")).toBe("/gadgets");
    expect(gadgetsPath("  ")).toBe("/gadgets");
  });

  test("seeds shell text via q", () => {
    expect(gadgetsPath("split $40 tip 18%")).toBe(
      "/gadgets?q=split%20%2440%20tip%2018%25",
    );
  });

  test("caps long seeds", () => {
    const long = "x".repeat(600);
    const path = gadgetsPath(long);
    expect(path.startsWith("/gadgets?q=")).toBe(true);
    expect(decodeURIComponent(path.slice("/gadgets?q=".length)).length).toBe(500);
  });
});

describe("newsPath", () => {
  test("opens feed without filters", () => {
    expect(newsPath()).toBe("/news");
    expect(newsPath({})).toBe("/news");
  });

  test("clips selection as topic query", () => {
    expect(newsPath({ q: "AI regulation" })).toBe("/news?q=AI+regulation");
  });

  test("includes optional source hint", () => {
    expect(newsPath({ q: "chips", source: "Reuters" })).toBe(
      "/news?q=chips&source=Reuters",
    );
  });
});

describe("placesPath", () => {
  test("opens map without query", () => {
    expect(placesPath("")).toBe("/places");
  });

  test("searches selection", () => {
    expect(placesPath("Cafe Lomi Paris")).toBe(
      "/places?q=Cafe%20Lomi%20Paris",
    );
  });
});

describe("resolveOmniboxPath", () => {
  test("keeps github / youtube prefixes", () => {
    expect(resolveOmniboxPath("gh:vercel/next.js")).toBe(
      "/github?q=vercel%2Fnext.js",
    );
    expect(resolveOmniboxPath("yt:react tutorial")).toBe(
      "/youtube?q=react%20tutorial",
    );
  });

  test("routes gadget / news / places prefixes", () => {
    expect(resolveOmniboxPath("g:tip 20%")).toBe("/gadgets?q=tip%2020%25");
    expect(resolveOmniboxPath("gadget:")).toBe("/gadgets");
    expect(resolveOmniboxPath("news:AI chips")).toBe("/news?q=AI+chips");
    expect(resolveOmniboxPath("places:Hanoi")).toBe("/places?q=Hanoi");
  });

  test("detects repo and video urls", () => {
    expect(resolveOmniboxPath("https://github.com/a/b")).toBe(
      "/github?repo=a%2Fb",
    );
    expect(
      resolveOmniboxPath("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("/youtube?videoId=dQw4w9WgXcQ");
  });

  test("defaults free text to github search", () => {
    expect(resolveOmniboxPath("typescript")).toBe("/github?q=typescript");
  });
});
