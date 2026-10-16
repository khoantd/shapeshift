/**
 * Pure helpers for Meanbox YouTube OAuth session cookies / Firefox bridge header.
 * Kept free of `server-only` so unit tests can import without Next server mocks.
 */

export const YT_COOKIE_ACCESS = "yt_oauth_at";
export const YT_COOKIE_REFRESH = "yt_oauth_rt";
export const YT_COOKIE_EXPIRES = "yt_oauth_exp";
export const YT_COOKIE_EMAIL = "yt_oauth_email";
export const YT_COOKIE_SUB = "yt_oauth_sub";

/**
 * Firefox / other clients that cannot send SameSite=Lax cookies on cross-origin
 * fetch may bridge session cookies via this header (Cookie-style, yt_oauth_* only).
 */
export const MEANBOX_SESSION_COOKIE_HEADER = "x-meanbox-cookie";

const SESSION_COOKIE_PREFIX = "yt_oauth_";

export type YouTubeOAuthCookieSession = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAtMs: number;
  email: string | null;
  sub: string | null;
};

export type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export function readSessionFromCookieStore(
  store: CookieReader,
): YouTubeOAuthCookieSession {
  const accessToken = store.get(YT_COOKIE_ACCESS)?.value?.trim() || null;
  const refreshToken = store.get(YT_COOKIE_REFRESH)?.value?.trim() || null;
  const expRaw = store.get(YT_COOKIE_EXPIRES)?.value?.trim() || "";
  const expiresAtMs = Number(expRaw);
  const email = store.get(YT_COOKIE_EMAIL)?.value?.trim() || null;
  const sub = store.get(YT_COOKIE_SUB)?.value?.trim() || null;
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
    email,
    sub,
  };
}

/** Parse a Cookie-style header, keeping only Meanbox OAuth session cookies. */
export function parseSessionCookieHeader(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name.startsWith(SESSION_COOKIE_PREFIX) || !value) continue;
    map.set(name, value);
  }
  return map;
}

function cookieStoreFromMap(map: Map<string, string>): CookieReader {
  return {
    get: (name: string) => {
      const value = map.get(name);
      return value !== undefined ? { value } : undefined;
    },
  };
}

/**
 * Merge native request cookies with optional `X-Meanbox-Cookie` bridge header.
 */
export function mergeSessionFromCookiesAndBridge(
  cookieStore: CookieReader,
  bridgeHeader: string | null | undefined,
): YouTubeOAuthCookieSession {
  const fromCookies = readSessionFromCookieStore(cookieStore);
  const bridgedRaw = bridgeHeader?.trim();
  if (!bridgedRaw) return fromCookies;

  const bridged = readSessionFromCookieStore(
    cookieStoreFromMap(parseSessionCookieHeader(bridgedRaw)),
  );

  if (fromCookies.accessToken || fromCookies.refreshToken) {
    return {
      ...fromCookies,
      email: fromCookies.email ?? bridged.email,
      sub: fromCookies.sub ?? bridged.sub,
    };
  }
  return bridged;
}

export function sessionHasOAuthTokens(session: YouTubeOAuthCookieSession): boolean {
  return Boolean(session.accessToken || session.refreshToken);
}

/**
 * Serialize a session into Cookie-style form for `X-Meanbox-Cookie` / mobile deep link.
 */
export function buildSessionCookieHeaderFromSession(
  session: YouTubeOAuthCookieSession,
): string {
  const parts: string[] = [];
  if (session.accessToken) {
    parts.push(`${YT_COOKIE_ACCESS}=${session.accessToken}`);
  }
  if (session.refreshToken) {
    parts.push(`${YT_COOKIE_REFRESH}=${session.refreshToken}`);
  }
  if (session.expiresAtMs > 0) {
    parts.push(`${YT_COOKIE_EXPIRES}=${session.expiresAtMs}`);
  }
  if (session.email) {
    parts.push(`${YT_COOKIE_EMAIL}=${session.email}`);
  }
  if (session.sub) {
    parts.push(`${YT_COOKIE_SUB}=${session.sub}`);
  }
  return parts.join("; ");
}

/** Deep link scheme target used by the Meanbox mobile auth session. */
export const MOBILE_OAUTH_REDIRECT = "meanbox://oauth";

/** `returnTo` path that mobile apps pass to `/api/youtube/oauth/start`. */
export const MOBILE_OAUTH_RETURN_TO = "/api/youtube/oauth/mobile-bridge";

export function isMobileOAuthReturnTo(returnTo: string): boolean {
  const path = returnTo.trim().split("?")[0] ?? "";
  return path === MOBILE_OAUTH_RETURN_TO;
}

/**
 * Build `meanbox://oauth?bridge=…` (or `?error=…`) from a session.
 * Prefer this from the OAuth callback so mobile does not depend on an HTTP
 * hop that can lose cookies across domain aliases.
 */
export function buildMobileOAuthDeepLink(
  session: YouTubeOAuthCookieSession,
): string {
  const dest = new URL(MOBILE_OAUTH_REDIRECT);
  if (!sessionHasOAuthTokens(session)) {
    dest.searchParams.set("error", "not_connected");
    return dest.toString();
  }
  const bridge = buildSessionCookieHeaderFromSession(session);
  if (!bridge) {
    dest.searchParams.set("error", "empty_session");
    return dest.toString();
  }
  dest.searchParams.set("bridge", bridge);
  if (session.email) {
    dest.searchParams.set("email", session.email);
  }
  return dest.toString();
}
