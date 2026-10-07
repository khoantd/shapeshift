import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  applyGoogleOAuthCookies,
  ensureGoogleOAuthIdentity,
} from "@/lib/auth/googleIdentity";
import {
  createNewsKnowledgeLink,
  removeNewsKnowledgeLink,
} from "@/lib/news/newsKnowledgeHistory";

export const runtime = "nodejs";

const postSchema = z.object({
  sourceNodeKey: z.string().trim().min(1).max(128),
  targetNodeKey: z.string().trim().min(1).max(128),
  type: z.enum(["RELATED_TO", "SUPPORTS", "CONTRASTS_WITH"]),
  note: z.string().trim().max(500).optional(),
});

const deleteSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const ensured = await ensureGoogleOAuthIdentity(request);
  if (!ensured.identity) {
    const res = NextResponse.json(
      { success: false, error: "Sign in with Google to save links", signedIn: false },
      { status: 401 },
    );
    if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    return res;
  }

  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid body: sourceNodeKey, targetNodeKey, type" },
      { status: 400 },
    );
  }

  const result = await createNewsKnowledgeLink({
    googleSub: ensured.identity.sub,
    sourceNodeKey: parsed.data.sourceNodeKey,
    targetNodeKey: parsed.data.targetNodeKey,
    type: parsed.data.type,
    note: parsed.data.note,
  });

  const res = NextResponse.json(
    result.ok
      ? { success: true, id: result.data.id, signedIn: true }
      : { success: false, error: result.message, signedIn: true },
    { status: result.ok ? 200 : 502 },
  );
  if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  return res;
}

export async function DELETE(request: NextRequest) {
  const ensured = await ensureGoogleOAuthIdentity(request);
  if (!ensured.identity) {
    const res = NextResponse.json(
      { success: false, error: "Sign in with Google to remove links", signedIn: false },
      { status: 401 },
    );
    if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    return res;
  }

  const raw = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid body: id required" },
      { status: 400 },
    );
  }

  const result = await removeNewsKnowledgeLink({
    id: parsed.data.id,
    googleSub: ensured.identity.sub,
  });

  const res = NextResponse.json(
    result.ok
      ? { success: true, signedIn: true }
      : { success: false, error: result.message, signedIn: true },
    { status: result.ok ? 200 : 502 },
  );
  if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  return res;
}
