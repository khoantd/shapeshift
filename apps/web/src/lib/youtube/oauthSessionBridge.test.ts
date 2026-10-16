import { describe, expect, it } from "vitest";
import {
  MEANBOX_SESSION_COOKIE_HEADER,
  MOBILE_OAUTH_REDIRECT,
  MOBILE_OAUTH_RETURN_TO,
  buildMobileOAuthDeepLink,
  buildSessionCookieHeaderFromSession,
  isMobileOAuthReturnTo,
  mergeSessionFromCookiesAndBridge,
  parseSessionCookieHeader,
  sessionHasOAuthTokens,
  type CookieReader,
} from "./oauthSessionCookies";

function jar(cookies: Record<string, string>): CookieReader {
  return {
    get: (name: string) =>
      cookies[name] !== undefined ? { value: cookies[name] } : undefined,
  };
}

describe("parseSessionCookieHeader", () => {
  it("keeps only yt_oauth_* pairs", () => {
    const map = parseSessionCookieHeader(
      "yt_oauth_at=access; other=nope; yt_oauth_sub=sub1",
    );
    expect(map.get("yt_oauth_at")).toBe("access");
    expect(map.get("yt_oauth_sub")).toBe("sub1");
    expect(map.has("other")).toBe(false);
  });
});

describe("mergeSessionFromCookiesAndBridge", () => {
  it("uses bridge header when request cookies are empty", () => {
    const session = mergeSessionFromCookiesAndBridge(
      jar({}),
      "yt_oauth_at=tok; yt_oauth_rt=ref; yt_oauth_sub=gs; yt_oauth_email=a@b.c; yt_oauth_exp=9999999999999",
    );
    expect(session.accessToken).toBe("tok");
    expect(session.refreshToken).toBe("ref");
    expect(session.sub).toBe("gs");
    expect(session.email).toBe("a@b.c");
  });

  it("prefers native cookies over bridge tokens", () => {
    const session = mergeSessionFromCookiesAndBridge(
      jar({
        yt_oauth_at: "native",
        yt_oauth_exp: "9999999999999",
      }),
      "yt_oauth_at=bridged; yt_oauth_sub=from-bridge",
    );
    expect(session.accessToken).toBe("native");
    expect(session.sub).toBe("from-bridge");
  });

  it("exposes the bridge header name used by the Firefox extension", () => {
    expect(MEANBOX_SESSION_COOKIE_HEADER).toBe("x-meanbox-cookie");
  });
});

describe("sessionHasOAuthTokens", () => {
  it("detects bridged refresh token", () => {
    expect(
      sessionHasOAuthTokens(
        mergeSessionFromCookiesAndBridge(jar({}), "yt_oauth_rt=refresh-only"),
      ),
    ).toBe(true);
    expect(sessionHasOAuthTokens(mergeSessionFromCookiesAndBridge(jar({}), ""))).toBe(
      false,
    );
  });
});

describe("buildSessionCookieHeaderFromSession", () => {
  it("round-trips through parseSessionCookieHeader", () => {
    const header = buildSessionCookieHeaderFromSession({
      accessToken: "at",
      refreshToken: "rt",
      expiresAtMs: 123,
      email: "a@b.c",
      sub: "sub1",
    });
    expect(header).toContain("yt_oauth_at=at");
    expect(header).toContain("yt_oauth_rt=rt");
    const map = parseSessionCookieHeader(header);
    expect(map.get("yt_oauth_sub")).toBe("sub1");
    expect(MOBILE_OAUTH_REDIRECT).toBe("meanbox://oauth");
  });
});

describe("mobile OAuth deep link", () => {
  it("recognizes the mobile returnTo path", () => {
    expect(isMobileOAuthReturnTo(MOBILE_OAUTH_RETURN_TO)).toBe(true);
    expect(isMobileOAuthReturnTo(`${MOBILE_OAUTH_RETURN_TO}?x=1`)).toBe(true);
    expect(isMobileOAuthReturnTo("/youtube")).toBe(false);
  });

  it("builds meanbox://oauth with bridge + email", () => {
    const link = buildMobileOAuthDeepLink({
      accessToken: "at",
      refreshToken: "rt",
      expiresAtMs: 999,
      email: "me@ex.com",
      sub: "sub1",
    });
    expect(link.startsWith("meanbox://oauth?")).toBe(true);
    const u = new URL(link);
    expect(u.searchParams.get("bridge")).toContain("yt_oauth_at=at");
    expect(u.searchParams.get("email")).toBe("me@ex.com");
  });

  it("sets error when session has no tokens", () => {
    const link = buildMobileOAuthDeepLink({
      accessToken: null,
      refreshToken: null,
      expiresAtMs: 0,
      email: null,
      sub: null,
    });
    expect(new URL(link).searchParams.get("error")).toBe("not_connected");
  });
});
