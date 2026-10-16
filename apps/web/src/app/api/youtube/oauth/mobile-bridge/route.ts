import { NextRequest, NextResponse } from "next/server";
import {
  MOBILE_OAUTH_REDIRECT,
  buildSessionCookieHeaderFromSession,
  sessionHasOAuthTokens,
} from "@/lib/youtube/oauthSessionCookies";
import { readSessionFromRequest } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/**
 * After Google OAuth, `returnTo` lands here with session cookies on the request.
 * Redirect into the Meanbox app with a Cookie-style bridge (same as Firefox
 * `X-Meanbox-Cookie`) so RN fetch can authenticate — Safari cookies are not
 * shared with the native app.
 */
export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  const dest = new URL(MOBILE_OAUTH_REDIRECT);

  if (!sessionHasOAuthTokens(session)) {
    dest.searchParams.set("error", "not_connected");
    return NextResponse.redirect(dest.toString(), 302);
  }

  const bridge = buildSessionCookieHeaderFromSession(session);
  if (!bridge) {
    dest.searchParams.set("error", "empty_session");
    return NextResponse.redirect(dest.toString(), 302);
  }

  dest.searchParams.set("bridge", bridge);
  if (session.email) {
    dest.searchParams.set("email", session.email);
  }
  return NextResponse.redirect(dest.toString(), 302);
}
