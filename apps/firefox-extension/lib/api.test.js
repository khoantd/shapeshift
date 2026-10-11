import { describe, expect, test } from "bun:test";
import { SESSION_COOKIE_PREFIX, buildSessionCookieHeader } from "./api.js";

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
