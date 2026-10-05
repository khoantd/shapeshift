import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export const YOUTUBE_OAUTH_SCOPE = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "openid",
  "email",
  "profile",
].join(" ");

/** Strip accidental surrounding quotes from .env values. */
function envValue(raw: string | undefined): string {
  let t = (raw ?? "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function getYouTubeOAuthClientId(): string {
  return envValue(process.env.YOUTUBE_OAUTH_CLIENT_ID);
}

export function getYouTubeOAuthClientSecret(): string {
  return envValue(process.env.YOUTUBE_OAUTH_CLIENT_SECRET);
}

export function getYouTubeOAuthRefreshToken(): string {
  return envValue(process.env.YOUTUBE_OAUTH_REFRESH_TOKEN);
}

export function getYouTubeOAuthSetupSecret(): string {
  return envValue(process.env.YOUTUBE_OAUTH_SETUP_SECRET);
}

/**
 * Canonical redirect URI for authorize + token exchange (must match exactly).
 * Override with YOUTUBE_OAUTH_REDIRECT_URI when origin differs (localhost vs 127.0.0.1).
 */
export function resolveYouTubeOAuthRedirectUri(requestOrigin: string): string {
  const override = envValue(process.env.YOUTUBE_OAUTH_REDIRECT_URI);
  if (override) return override.replace(/\/$/, "");
  return `${requestOrigin.replace(/\/$/, "")}/api/youtube/oauth/callback`;
}

/** Client ID + secret present — enough for “Sign in with Google”. */
export function youtubeOAuthClientConfigured(): boolean {
  return Boolean(getYouTubeOAuthClientId() && getYouTubeOAuthClientSecret());
}

/** Env refresh token present (server fallback for captions). */
export function youtubeOAuthEnvConfigured(): boolean {
  return Boolean(youtubeOAuthClientConfigured() && getYouTubeOAuthRefreshToken());
}

/** @deprecated Prefer youtubeOAuthClientConfigured / youtubeOAuthEnvConfigured */
export function youtubeOAuthConfigured(): boolean {
  return youtubeOAuthEnvConfigured();
}

export function missingYouTubeOAuthMessage(): string {
  return "YouTube OAuth client is not configured. Set YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET, then use Sign in with Google on /youtube.";
}

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
  key: string;
};

let cached: CachedToken | null = null;

export function clearYouTubeAccessTokenCache(): void {
  cached = null;
}

export async function refreshYouTubeAccessToken(
  refreshToken: string,
  signal?: AbortSignal,
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = getYouTubeOAuthClientId();
  const clientSecret = getYouTubeOAuthClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth client is not configured");
  }
  if (!refreshToken.trim()) {
    throw new Error("Missing refresh token");
  }

  const cacheKey = refreshToken.slice(0, 12);
  const now = Date.now();
  if (cached && cached.key === cacheKey && cached.expiresAtMs > now + 60_000) {
    return {
      accessToken: cached.accessToken,
      expiresIn: Math.max(60, Math.floor((cached.expiresAtMs - now) / 1000)),
    };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });

  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!res.ok || !json?.access_token) {
    const detail = json?.error_description || json?.error || `HTTP ${res.status}`;
    throw new Error(`YouTube OAuth token refresh failed: ${detail}`);
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cached = {
    accessToken: json.access_token,
    expiresAtMs: now + expiresIn * 1000,
    key: cacheKey,
  };
  return { accessToken: json.access_token, expiresIn };
}

/**
 * Env refresh token → access token (server fallback).
 */
export async function getYouTubeAccessToken(signal?: AbortSignal): Promise<string> {
  const refreshToken = getYouTubeOAuthRefreshToken();
  if (!refreshToken) {
    throw new Error("YouTube OAuth is not configured");
  }
  const { accessToken } = await refreshYouTubeAccessToken(refreshToken, signal);
  return accessToken;
}

export function isYouTubeOAuthSetupAllowed(setupSecretQuery: string | null): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const expected = getYouTubeOAuthSetupSecret();
  if (!expected) return false;
  return Boolean(setupSecretQuery && setupSecretQuery === expected);
}

export type OAuthFlowMode = "login" | "setup";

export type OAuthSetupState = {
  mode: OAuthFlowMode;
  setupSecret: string;
  redirectUri: string;
  codeVerifier: string;
  /** Safe relative path to return to after login (e.g. /youtube). */
  returnTo: string;
};

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPkceVerifier(): string {
  return base64Url(Buffer.from(crypto.getRandomValues(new Uint8Array(32))));
}

export function pkceChallengeS256(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function sanitizeReturnTo(raw: string | null | undefined): string {
  const t = (raw ?? "/youtube").trim();
  if (t.startsWith("/") && !t.startsWith("//") && !t.includes("://")) {
    return t.slice(0, 200) || "/youtube";
  }
  return "/youtube";
}

export function encodeOAuthSetupState(input: {
  mode: OAuthFlowMode;
  setupSecret: string | null;
  redirectUri: string;
  codeVerifier: string;
  returnTo?: string;
}): string {
  const payload = JSON.stringify({
    m: input.mode,
    s: input.setupSecret ?? "dev",
    n: crypto.randomUUID(),
    r: input.redirectUri,
    v: input.codeVerifier,
    t: sanitizeReturnTo(input.returnTo),
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function parseOAuthSetupState(raw: string | null): OAuthSetupState | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      m?: unknown;
      s?: unknown;
      r?: unknown;
      v?: unknown;
      t?: unknown;
    };
    if (typeof json.s !== "string") return null;
    if (typeof json.r !== "string" || !json.r.startsWith("http")) return null;
    if (typeof json.v !== "string" || json.v.length < 43) return null;
    const mode: OAuthFlowMode = json.m === "setup" ? "setup" : "login";
    return {
      mode,
      setupSecret: json.s === "dev" ? "" : json.s,
      redirectUri: json.r.replace(/\/$/, ""),
      codeVerifier: json.v,
      returnTo: sanitizeReturnTo(typeof json.t === "string" ? json.t : "/youtube"),
    };
  } catch {
    return null;
  }
}

type ExchangeOk = {
  ok: true;
  refreshToken: string | null;
  accessToken: string;
  expiresIn: number;
  redirectUri: string;
};

type ExchangeFail = {
  ok: false;
  status: number;
  error?: string;
  detail: string;
  redirectUri: string;
};

export type ExchangeResult = ExchangeOk | ExchangeFail;

const exchangeInflight = new Map<string, Promise<ExchangeResult>>();
const exchangeDone = new Map<string, ExchangeResult>();

export async function exchangeYouTubeAuthCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ExchangeResult> {
  const key = input.code;
  const cachedResult = exchangeDone.get(key);
  if (cachedResult) return cachedResult;

  const inflight = exchangeInflight.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<ExchangeResult> => {
    const clientId = getYouTubeOAuthClientId();
    const clientSecret = getYouTubeOAuthClientSecret();
    const body = new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const rawText = await tokenRes.text();
    type TokenResponse = {
      refresh_token?: string;
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    let json: TokenResponse | null = null;
    try {
      json = JSON.parse(rawText) as TokenResponse;
    } catch {
      json = null;
    }

    if (!tokenRes.ok || !json?.access_token) {
      const result: ExchangeFail = {
        ok: false,
        status: tokenRes.status,
        error: json?.error,
        detail:
          json?.error_description ||
          json?.error ||
          (rawText.trim().slice(0, 200) || `HTTP ${tokenRes.status}`),
        redirectUri: input.redirectUri,
      };
      exchangeDone.set(key, result);
      return result;
    }

    const result: ExchangeOk = {
      ok: true,
      refreshToken: json.refresh_token ?? null,
      accessToken: json.access_token,
      expiresIn: typeof json.expires_in === "number" ? json.expires_in : 3600,
      redirectUri: input.redirectUri,
    };
    exchangeDone.set(key, result);
    return result;
  })().finally(() => {
    exchangeInflight.delete(key);
  });

  exchangeInflight.set(key, promise);
  return promise;
}

export type GoogleUserIdentity = {
  email: string | null;
  /** Stable Google account id (`sub` / userinfo `id`). */
  sub: string | null;
};

export async function fetchGoogleUserIdentity(accessToken: string): Promise<GoogleUserIdentity> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { email: null, sub: null };
    const json = (await res.json()) as { email?: string; id?: string };
    const email = typeof json.email === "string" ? json.email.slice(0, 200) : null;
    const sub = typeof json.id === "string" && json.id.trim() ? json.id.trim().slice(0, 128) : null;
    return { email, sub };
  } catch {
    return { email: null, sub: null };
  }
}

/** @deprecated Prefer fetchGoogleUserIdentity — kept for call-site compatibility. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const id = await fetchGoogleUserIdentity(accessToken);
  return id.email;
}

/** Resolve whether this request can use Data API captions (user session or env). */
export function canUseYouTubeDataApiCaptions(request?: NextRequest): boolean {
  if (youtubeOAuthEnvConfigured()) return true;
  if (!request) return false;
  // Cookie presence checked in session module to avoid circular imports — callers use session helpers.
  return youtubeOAuthClientConfigured();
}
