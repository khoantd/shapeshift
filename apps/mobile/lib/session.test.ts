import { describe, expect, test } from "bun:test";
import { MOBILE_OAUTH_REDIRECT, parseMobileOAuthRedirect } from "./session";

describe("parseMobileOAuthRedirect", () => {
  test("extracts bridge and email", () => {
    const bridge = "yt_oauth_at=tok; yt_oauth_rt=ref; yt_oauth_email=a%40b.c";
    // URLSearchParams encodes; simulate what the BFF redirect produces
    const u = new URL(MOBILE_OAUTH_REDIRECT);
    u.searchParams.set("bridge", "yt_oauth_at=tok; yt_oauth_rt=ref; yt_oauth_email=a@b.c");
    u.searchParams.set("email", "a@b.c");
    const result = parseMobileOAuthRedirect(u.toString());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.email).toBe("a@b.c");
    expect(result.session.bridge).toContain("yt_oauth_at=tok");
    expect(bridge).toContain("yt_oauth");
  });

  test("maps error query", () => {
    const result = parseMobileOAuthRedirect("meanbox://oauth?error=not_connected");
    expect(result).toEqual({ ok: false, error: "not_connected" });
  });

  test("rejects missing bridge", () => {
    const result = parseMobileOAuthRedirect("meanbox://oauth");
    expect(result.ok).toBe(false);
  });
});
