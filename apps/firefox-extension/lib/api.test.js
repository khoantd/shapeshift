import { describe, expect, mock, test } from "bun:test";
import {
  SESSION_COOKIE_PREFIX,
  buildSessionCookieHeader,
  formatUnsavedPackHint,
  generateNewsDeepDive,
  structureRtcfc,
} from "./api.js";

describe("buildSessionCookieHeader", () => {
  test("joins only yt_oauth_* cookies in Cookie header form", () => {
    const header = buildSessionCookieHeader([
      { name: "yt_oauth_at", value: "access" },
      { name: "other", value: "nope" },
      { name: "yt_oauth_sub", value: "sub123" },
      { name: "yt_oauth_rt", value: "refresh" },
    ]);
    expect(header).toBe(
      "yt_oauth_at=access; yt_oauth_sub=sub123; yt_oauth_rt=refresh",
    );
  });

  test("returns empty string when none match", () => {
    expect(buildSessionCookieHeader([{ name: "session", value: "x" }])).toBe(
      "",
    );
    expect(buildSessionCookieHeader([])).toBe("");
    expect(buildSessionCookieHeader(null)).toBe("");
  });

  test("skips cookies with empty name or value", () => {
    expect(
      buildSessionCookieHeader([
        { name: "yt_oauth_at", value: "" },
        { name: "", value: "x" },
        { name: "yt_oauth_email", value: "a@b.c" },
      ]),
    ).toBe("yt_oauth_email=a@b.c");
  });

  test("prefix matches Meanbox OAuth cookie names", () => {
    expect(SESSION_COOKIE_PREFIX).toBe("yt_oauth_");
  });
});

describe("formatUnsavedPackHint", () => {
  test("prefers server saveError", () => {
    expect(
      formatUnsavedPackHint({
        saveError: "Sign out and sign in again",
        sessionBridge: { header: "yt_oauth_at=x", reason: "ok" },
        apiBase: "https://meanbox.vercel.app",
      }),
    ).toBe("Sign out and sign in again");
  });

  test("explains empty local session cookies", () => {
    const hint = formatUnsavedPackHint({
      saveError: null,
      sessionBridge: { header: "", reason: "empty" },
      apiBase: "https://meanbox.vercel.app",
    });
    expect(hint).toContain("https://meanbox.vercel.app");
    expect(hint).toContain("session cookies");
  });

  test("explains missing cookies API", () => {
    expect(
      formatUnsavedPackHint({
        sessionBridge: { header: "", reason: "no_cookies_api" },
      }),
    ).toContain("Reload the add-on");
  });
});

describe("generateNewsDeepDive", () => {
  test("POSTs title/excerpt/canonicalUrl and optional feed id", async () => {
    const prevBrowser = globalThis.browser;
    const prevFetch = globalThis.fetch;
    globalThis.browser = {
      storage: {
        sync: {
          get: async () => ({
            apiBase: "https://meanbox.vercel.app",
            locale: "en",
          }),
        },
      },
      cookies: {
        getAll: async () => [],
      },
    };
    /** @type {RequestInit | undefined} */
    let init;
    /** @type {string | undefined} */
    let url;
    globalThis.fetch = mock(async (input, options) => {
      url = String(input);
      init = options;
      return new Response(
        JSON.stringify({
          success: true,
          text: "## Dive",
          sources: [],
          cached: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    try {
      const res = await generateNewsDeepDive({
        title: "Headline",
        excerpt: "Excerpt body",
        canonicalUrl: "https://news.example.com/a",
        id: "feed-uuid-1",
      });
      expect(res.success).toBe(true);
      expect(url).toContain("/api/news/deep-dive");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body).toEqual({
        title: "Headline",
        excerpt: "Excerpt body",
        language: "en",
        canonicalUrl: "https://news.example.com/a",
        id: "feed-uuid-1",
      });
    } finally {
      globalThis.browser = prevBrowser;
      globalThis.fetch = prevFetch;
    }
  });
});

describe("structureRtcfc", () => {
  test("POSTs freeform text to /api/rtcfc/structure", async () => {
    const prevBrowser = globalThis.browser;
    const prevFetch = globalThis.fetch;
    globalThis.browser = {
      storage: {
        sync: {
          get: async () => ({
            apiBase: "https://meanbox.vercel.app",
            locale: "en",
          }),
        },
      },
      cookies: {
        getAll: async () => [],
      },
    };
    /** @type {RequestInit | undefined} */
    let init;
    /** @type {string | undefined} */
    let url;
    globalThis.fetch = mock(async (input, options) => {
      url = String(input);
      init = options;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            role: "staff engineer",
            task: "review PR",
            context: "NestJS",
            format: "table",
            constraints: "skip nits",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    try {
      const res = await structureRtcfc({
        text: "rtcfc review this NestJS PR",
      });
      expect(res.success).toBe(true);
      expect(url).toContain("/api/rtcfc/structure");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.text).toBe("rtcfc review this NestJS PR");
    } finally {
      globalThis.browser = prevBrowser;
      globalThis.fetch = prevFetch;
    }
  });
});
