import { NextRequest, NextResponse } from "next/server";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
  getYouTubeOAuthSessionStatus,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/** Public session status for /youtube UI (no tokens). Heals missing yt_oauth_sub. */
export async function GET(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  const status = await getYouTubeOAuthSessionStatus();
  const hasSub = Boolean(ensured.identity?.sub) || status.hasSub;
  const email = ensured.identity?.email ?? status.email;

  const res = NextResponse.json({
    success: true,
    ...status,
    email,
    hasSub,
    connected: status.connected || Boolean(ensured.identity),
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}
