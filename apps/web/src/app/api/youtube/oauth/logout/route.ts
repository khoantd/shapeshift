import { NextResponse } from "next/server";
import { clearYouTubeOAuthCookies } from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

/** Clear YouTube OAuth session cookies. */
export async function POST() {
  const res = NextResponse.json({ success: true });
  clearYouTubeOAuthCookies(res);
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dest = new URL("/youtube?oauth=signed_out", url.origin);
  const out = NextResponse.redirect(dest, 302);
  clearYouTubeOAuthCookies(out);
  return out;
}
