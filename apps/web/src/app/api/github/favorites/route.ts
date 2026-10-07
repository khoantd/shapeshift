import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getGithubFavorites,
  saveGithubFavorites,
} from "@/lib/github/favoritesHistory";
import { normalizeFavoriteTopics } from "@/lib/github/topics";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
} from "@/lib/youtube/oauthSession";

export const runtime = "nodejs";

const putBodySchema = z.object({
  topics: z.array(z.string().max(64)).max(24),
});

/** Load favorite topics for the signed-in Google user. */
export async function GET(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Sign in with Google to load favorites (or sign out and back in to refresh your session)",
      },
      { status: 401 },
    );
  }

  const result = await getGithubFavorites(ensured.identity.sub);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  const res = NextResponse.json({
    success: true,
    topics: result.data.topics,
    updatedAt: result.data.updatedAt,
  });
  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}

/** Replace favorite topics for the signed-in Google user. */
export async function PUT(request: NextRequest) {
  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Sign in with Google to save favorites (or sign out and back in to refresh your session)",
      },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = putBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Expected { topics: string[] }" },
      { status: 422 },
    );
  }

  const topics = normalizeFavoriteTopics(parsed.data.topics);
  const result = await saveGithubFavorites({
    googleSub: ensured.identity.sub,
    email: ensured.identity.email,
    topics,
  });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.message },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  const res = NextResponse.json({
    success: true,
    topics: result.data.topics,
    updatedAt: result.data.updatedAt,
  });
  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }
  return res;
}
