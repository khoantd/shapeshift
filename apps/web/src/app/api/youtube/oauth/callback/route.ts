import { NextRequest, NextResponse } from "next/server";
import {
  exchangeYouTubeAuthCode,
  fetchGoogleUserIdentity,
  getYouTubeOAuthClientId,
  getYouTubeOAuthClientSecret,
  isYouTubeOAuthSetupAllowed,
  parseOAuthSetupState,
  resolveYouTubeOAuthRedirectUri,
  sanitizeReturnTo,
} from "@/lib/youtube/oauth";
import { applyYouTubeOAuthCookies } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

function htmlPage(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
code,pre{background:#f4f4f5;padding:.2em .4em;border-radius:4px;word-break:break-all}
pre{padding:1rem;overflow:auto;user-select:all}
ul{padding-left:1.2rem}li{margin:.35rem 0}</style></head><body>${body}</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * OAuth callback — login mode sets session cookies and redirects to /youtube;
 * setup mode shows refresh token once for .env.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const err = url.searchParams.get("error");
  if (err) {
    return htmlPage(
      "OAuth error",
      `<h1>OAuth error</h1><p>${escapeHtml(err)}</p>
       <p>${escapeHtml(url.searchParams.get("error_description") ?? "")}</p>
       <p><a href="/youtube">Back to YouTube</a></p>`,
      400,
    );
  }

  const state = parseOAuthSetupState(url.searchParams.get("state"));
  if (!state) {
    return htmlPage(
      "Forbidden",
      `<h1>Forbidden</h1>
       <p>Invalid OAuth state. Start again from
       <a href="/api/youtube/oauth/start?returnTo=/youtube">Sign in with Google</a>.</p>`,
      403,
    );
  }

  if (state.mode === "setup" && !isYouTubeOAuthSetupAllowed(state.setupSecret || null)) {
    return htmlPage("Forbidden", "<h1>Forbidden</h1><p>Invalid setup state.</p>", 403);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return htmlPage("Missing code", "<h1>Missing authorization code</h1>", 400);
  }

  if (!getYouTubeOAuthClientId() || !getYouTubeOAuthClientSecret()) {
    return htmlPage("Missing client", "<h1>OAuth client not configured</h1>", 503);
  }

  const redirectUri = state.redirectUri || resolveYouTubeOAuthRedirectUri(url.origin);

  const result = await exchangeYouTubeAuthCode({
    code,
    redirectUri,
    codeVerifier: state.codeVerifier,
  });

  if (!result.ok) {
    const isInvalidGrant = result.error === "invalid_grant";
    return htmlPage(
      "Token exchange failed",
      `<h1>Token exchange failed</h1>
       <p><strong>${escapeHtml(result.detail)}</strong></p>
       <p>Google status: <code>${result.status}</code>${
         result.error ? ` · error=<code>${escapeHtml(result.error)}</code>` : ""
       }</p>
       <p>Redirect URI:</p><pre>${escapeHtml(result.redirectUri)}</pre>
       ${
         isInvalidGrant
           ? `<p>Start a <strong>fresh</strong> login from
              <a href="/api/youtube/oauth/start?returnTo=/youtube">/api/youtube/oauth/start</a>
              — do not refresh this page.</p>`
           : ""
       }
       <p><a href="/youtube">Back to YouTube</a></p>`,
      502,
    );
  }

  // --- Login: session cookies + redirect ---
  if (state.mode === "login") {
    const identity = await fetchGoogleUserIdentity(result.accessToken);
    const returnTo = sanitizeReturnTo(state.returnTo);
    const dest = new URL(returnTo, url.origin);
    dest.searchParams.set("oauth", "connected");
    const res = NextResponse.redirect(dest.toString(), 302);
    applyYouTubeOAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      email: identity.email,
      sub: identity.sub,
    });
    if (!result.refreshToken) {
      // Still connected with access token only; warn via query
      dest.searchParams.set("oauth", "connected_no_refresh");
      const warn = NextResponse.redirect(dest.toString(), 302);
      applyYouTubeOAuthCookies(warn, {
        accessToken: result.accessToken,
        refreshToken: null,
        expiresIn: result.expiresIn,
        email: identity.email,
        sub: identity.sub,
      });
      return warn;
    }
    return res;
  }

  // --- Setup: show refresh token for .env ---
  if (!result.refreshToken) {
    return htmlPage(
      "No refresh token",
      `<h1>No refresh token returned</h1>
       <p>Revoke access at <a href="https://myaccount.google.com/permissions">Google Account permissions</a>
       and retry with <code>?mode=setup</code>.</p>`,
      502,
    );
  }

  return htmlPage(
    "YouTube OAuth refresh token",
    `<h1>Refresh token ready</h1>
     <p>Add this to <code>apps/web/.env</code> (optional server fallback). Prefer Sign in with Google for users.</p>
     <pre>YOUTUBE_OAUTH_REFRESH_TOKEN=${escapeHtml(result.refreshToken)}</pre>
     <p><a href="/youtube">Back to YouTube</a></p>`,
  );
}
