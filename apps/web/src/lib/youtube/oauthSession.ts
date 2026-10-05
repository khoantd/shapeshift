import "server-only";

import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  refreshYouTubeAccessToken,
  youtubeOAuthClientConfigured,
  youtubeOAuthEnvConfigured,
  getYouTubeAccessToken,
  fetchGoogleUserIdentity,
} from "./oauth";

export const YT_COOKIE_ACCESS = "yt_oauth_at";
export const YT_COOKIE_REFRESH = "yt_oauth_rt";
export const YT_COOKIE_EXPIRES = "yt_oauth_exp";
export const YT_COOKIE_EMAIL = "yt_oauth_email";
export const YT_COOKIE_SUB = "yt_oauth_sub";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days for refresh

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function baseCookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge,
  };
}

export type YouTubeOAuthSession = {
  connected: boolean;
  email: string | null;
  sub: string | null;
  /** Access token ready to use (may refresh from cookie). */
  accessToken: string | null;
};

export function readSessionFromCookieStore(store: {
  get: (name: string) => { value: string } | undefined;
}): {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAtMs: number;
  email: string | null;
  sub: string | null;
} {
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

export function applyYouTubeOAuthCookies(
  res: NextResponse,
  input: {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    email?: string | null;
    sub?: string | null;
  },
): void {
  const expiresAtMs = Date.now() + input.expiresIn * 1000;
  res.cookies.set(YT_COOKIE_ACCESS, input.accessToken, baseCookieOpts(input.expiresIn));
  res.cookies.set(YT_COOKIE_EXPIRES, String(expiresAtMs), baseCookieOpts(COOKIE_MAX_AGE_SEC));
  if (input.refreshToken) {
    res.cookies.set(YT_COOKIE_REFRESH, input.refreshToken, baseCookieOpts(COOKIE_MAX_AGE_SEC));
  }
  if (input.email) {
    res.cookies.set(YT_COOKIE_EMAIL, input.email, baseCookieOpts(COOKIE_MAX_AGE_SEC));
  }
  if (input.sub) {
    res.cookies.set(YT_COOKIE_SUB, input.sub, baseCookieOpts(COOKIE_MAX_AGE_SEC));
  }
}

export function clearYouTubeOAuthCookies(res: NextResponse): void {
  for (const name of [
    YT_COOKIE_ACCESS,
    YT_COOKIE_REFRESH,
    YT_COOKIE_EXPIRES,
    YT_COOKIE_EMAIL,
    YT_COOKIE_SUB,
  ]) {
    res.cookies.set(name, "", { ...baseCookieOpts(0), maxAge: 0 });
  }
}

/**
 * Get a usable access token: user session cookies first, then env refresh token.
 * When refreshing from cookies, returns `setCookies` so the caller can attach them.
 */
export async function resolveYouTubeAccessToken(opts?: {
  request?: NextRequest;
  signal?: AbortSignal;
}): Promise<{
  accessToken: string | null;
  source: "session" | "env" | null;
  email: string | null;
  sub: string | null;
  /** Updated session cookies after a refresh — apply on the response. */
  refreshed?: {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    email: string | null;
    sub: string | null;
  };
}> {
  const cookieBag = opts?.request?.cookies;
  const fromReq = cookieBag ? readSessionFromCookieStore(cookieBag) : null;

  // Prefer Next cookies() when no request (RSC)
  let session = fromReq;
  if (!session) {
    try {
      const jar = await cookies();
      session = readSessionFromCookieStore(jar);
    } catch {
      session = {
        accessToken: null,
        refreshToken: null,
        expiresAtMs: 0,
        email: null,
        sub: null,
      };
    }
  }

  const now = Date.now();
  if (session.accessToken && session.expiresAtMs > now + 60_000) {
    return {
      accessToken: session.accessToken,
      source: "session",
      email: session.email,
      sub: session.sub,
    };
  }

  if (session.refreshToken) {
    try {
      const { accessToken, expiresIn } = await refreshYouTubeAccessToken(
        session.refreshToken,
        opts?.signal,
      );
      return {
        accessToken,
        source: "session",
        email: session.email,
        sub: session.sub,
        refreshed: {
          accessToken,
          refreshToken: session.refreshToken,
          expiresIn,
          email: session.email,
          sub: session.sub,
        },
      };
    } catch {
      // Fall through to env
    }
  }

  if (youtubeOAuthEnvConfigured()) {
    try {
      const accessToken = await getYouTubeAccessToken(opts?.signal);
      return { accessToken, source: "env", email: null, sub: null };
    } catch {
      return { accessToken: null, source: null, email: null, sub: null };
    }
  }

  return { accessToken: null, source: null, email: session.email, sub: session.sub };
}

/** Identity for history ownership — requires a user OAuth session with googleSub. */
export async function getYouTubeOAuthIdentity(request?: NextRequest): Promise<{
  sub: string;
  email: string | null;
} | null> {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  return ensured.identity;
}

export type EnsuredYouTubeIdentity = {
  identity: { sub: string; email: string | null } | null;
  /**
   * When present, apply with `applyYouTubeOAuthCookies` so missing `yt_oauth_sub`
   * (and optionally refreshed tokens) are persisted for subsequent requests.
   */
  cookiesToSet?: {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    email: string | null;
    sub: string;
  };
};

/**
 * Resolve Google identity for history. If the user is connected but missing
 * `yt_oauth_sub` (sessions created before that cookie existed), fetch userinfo
 * and return cookies to set on the response.
 */
export async function ensureYouTubeOAuthIdentity(
  request?: NextRequest,
): Promise<EnsuredYouTubeIdentity> {
  const resolved = await resolveYouTubeAccessToken({ request });
  if (resolved.source !== "session" || !resolved.accessToken) {
    return { identity: null };
  }

  if (resolved.sub) {
    const identity = { sub: resolved.sub, email: resolved.email };
    if (resolved.refreshed) {
      return {
        identity,
        cookiesToSet: {
          accessToken: resolved.refreshed.accessToken,
          refreshToken: resolved.refreshed.refreshToken,
          expiresIn: resolved.refreshed.expiresIn,
          email: resolved.refreshed.email,
          sub: resolved.sub,
        },
      };
    }
    return { identity };
  }

  // Connected but no sub cookie — heal from Google userinfo.
  const google = await fetchGoogleUserIdentity(resolved.accessToken);
  if (!google.sub) {
    return { identity: null };
  }

  const email = google.email ?? resolved.email;
  const cookieBag = request?.cookies;
  let refreshToken: string | null = null;
  let expiresIn = 3600;
  if (cookieBag) {
    const session = readSessionFromCookieStore(cookieBag);
    refreshToken = session.refreshToken;
    const remainingSec = Math.floor((session.expiresAtMs - Date.now()) / 1000);
    expiresIn = Number.isFinite(remainingSec) && remainingSec > 60 ? remainingSec : 3600;
  } else {
    try {
      const jar = await cookies();
      const session = readSessionFromCookieStore(jar);
      refreshToken = session.refreshToken;
      const remainingSec = Math.floor((session.expiresAtMs - Date.now()) / 1000);
      expiresIn = Number.isFinite(remainingSec) && remainingSec > 60 ? remainingSec : 3600;
    } catch {
      /* keep defaults */
    }
  }

  if (resolved.refreshed) {
    refreshToken = resolved.refreshed.refreshToken ?? refreshToken;
    expiresIn = resolved.refreshed.expiresIn;
  }

  return {
    identity: { sub: google.sub, email },
    cookiesToSet: {
      accessToken: resolved.refreshed?.accessToken ?? resolved.accessToken,
      refreshToken,
      expiresIn,
      email,
      sub: google.sub,
    },
  };
}

export async function getYouTubeOAuthSessionStatus(): Promise<{
  clientConfigured: boolean;
  connected: boolean;
  email: string | null;
  hasSub: boolean;
  envFallback: boolean;
}> {
  const clientConfigured = youtubeOAuthClientConfigured();
  let email: string | null = null;
  let hasSub = false;
  let connected = false;
  try {
    const jar = await cookies();
    const session = readSessionFromCookieStore(jar);
    email = session.email;
    hasSub = Boolean(session.sub);
    connected = Boolean(session.refreshToken || session.accessToken);
  } catch {
    connected = false;
  }
  return {
    clientConfigured,
    connected,
    email,
    hasSub,
    envFallback: youtubeOAuthEnvConfigured(),
  };
}
