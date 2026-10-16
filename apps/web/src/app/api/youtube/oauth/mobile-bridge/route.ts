import { NextRequest, NextResponse } from "next/server";
import {
  buildMobileOAuthDeepLink,
  sessionHasOAuthTokens,
} from "@/lib/youtube/oauthSessionCookies";
import { readSessionFromRequest } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/**
 * Fallback HTTP hop after Google OAuth when cookies are present on this host.
 * Prefer the OAuth callback's direct `meanbox://` redirect (same deep link).
 * Kept so older clients / bookmarks still work once this route is deployed.
 */
export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!sessionHasOAuthTokens(session)) {
    return NextResponse.redirect(
      buildMobileOAuthDeepLink({
        accessToken: null,
        refreshToken: null,
        expiresAtMs: 0,
        email: null,
        sub: null,
      }),
      302,
    );
  }
  return NextResponse.redirect(buildMobileOAuthDeepLink(session), 302);
}
