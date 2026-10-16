import { NextRequest, NextResponse } from "next/server";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
  getYouTubeOAuthSessionStatus,
  readSessionFromRequest,
} from "@/lib/youtube/oauthSession";
import { sessionHasOAuthTokens } from "@/lib/youtube/oauthSessionCookies";

export const runtime = "nodejs";

/** Public session status for /youtube UI + mobile bridge (no tokens). Heals missing yt_oauth_sub. */
export async function GET(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  const status = await getYouTubeOAuthSessionStatus();
  const fromRequest = readSessionFromRequest(request);
  const bridged = sessionHasOAuthTokens(fromRequest);

  const hasSub =
    Boolean(ensured.identity?.sub) || status.hasSub || Boolean(fromRequest.sub);
  const email =
    ensured.identity?.email ?? fromRequest.email ?? status.email;
  const connected =
    status.connected || bridged || Boolean(ensured.identity);

  const res = NextResponse.json({
    success: true,
    ...status,
    email,
    hasSub,
    connected,
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}
