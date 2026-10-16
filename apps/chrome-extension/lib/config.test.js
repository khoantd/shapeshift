import { describe, expect, test } from "bun:test";
import { normalizeApiBase } from "./config.js";

describe("normalizeApiBase", () => {
  test("strips trailing slash and keeps origin", () => {
    expect(normalizeApiBase("https://meanbox.vercel.app/")).toBe(
      "https://meanbox.vercel.app",
    );
    expect(normalizeApiBase("http://localhost:3000/en")).toBe(
      "http://localhost:3000",
    );
  });

  test("rejects junk", () => {
    expect(normalizeApiBase("not a url")).toBe("");
    expect(normalizeApiBase("ftp://x")).toBe("");
  });
});
