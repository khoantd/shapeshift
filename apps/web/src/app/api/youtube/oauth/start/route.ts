import { NextRequest, NextResponse } from "next/server";
import {
  createPkceVerifier,
  encodeOAuthSetupState,
  getYouTubeOAuthClientId,
  isYouTubeOAuthSetupAllowed,
  pkceChallengeS256,
  resolveYouTubeOAuthRedirectUri,
  sanitizeReturnTo,
  youtubeOAuthClientConfigured,
  YOUTUBE_OAUTH_SCOPE,
} from "@/lib/youtube/oauth";

export const runtime = "nodejs";

function htmlPage(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
code,pre{background:#f4f4f5;padding:.2em .4em;border-radius:4px;word-break:break-all}
pre{padding:1rem;overflow:auto}</style></head><body>${body}</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Start Google OAuth.
 * - Default: user login (session cookies) → return to /youtube
 * - ?mode=setup: one-shot refresh token mint (dev / setup secret)
 */
export async function GET(request: NextRequest) {
  const setupSecret = request.nextUrl.searchParams.get("setupSecret");
  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode = modeParam === "setup" ? "setup" : "login";

  if (mode === "setup" && !isYouTubeOAuthSetupAllowed(setupSecret)) {
    return htmlPage(
      "Forbidden",
      "<h1>Forbidden</h1><p>Setup mode is only allowed in development or with a valid setup secret.</p>",
      403,
    );
  }

  if (!youtubeOAuthClientConfigured()) {
    return htmlPage(
      "Missing OAuth client",
      `<h1>Missing OAuth client</h1>
       <p>Set <code>YOUTUBE_OAUTH_CLIENT_ID</code> and <code>YOUTUBE_OAUTH_CLIENT_SECRET</code> in <code>apps/web/.env</code>, then restart the dev server.</p>
       <p>Use a Google Cloud <strong>Web application</strong> OAuth client.</p>`,
      503,
    );
  }

  const redirectUri = resolveYouTubeOAuthRedirectUri(request.nextUrl.origin);
  const codeVerifier = createPkceVerifier();
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const state = encodeOAuthSetupState({
    mode,
    setupSecret: mode === "setup" ? setupSecret : null,
    redirectUri,
    codeVerifier,
    returnTo,
  });

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", getYouTubeOAuthClientId());
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", YOUTUBE_OAUTH_SCOPE);
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge", pkceChallengeS256(codeVerifier));
  auth.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(auth.toString(), 302);
}
