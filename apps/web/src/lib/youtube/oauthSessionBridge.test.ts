import { describe, expect, it } from "vitest";
import {
  MEANBOX_SESSION_COOKIE_HEADER,
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
