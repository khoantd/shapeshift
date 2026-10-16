import { NextRequest, NextResponse } from "next/server";
import { saveLearningPackHistory } from "@/lib/youtube/learningPackHistory";
import { packToKnowledgeGraph } from "@/lib/youtube/packKnowledgeGraph";
import {
  applyYouTubeOAuthCookies,
  ensureYouTubeOAuthIdentity,
} from "@/lib/youtube/oauthSession";
import { parseLearningPackContentType } from "@/lib/youtube/learningPackParse";

export const runtime = "nodejs";

const VIDEO_ID_RE = /^[\w-]{11}$/;
const TITLE_MAX = 500;
const CHANNEL_MAX = 200;
const MARKDOWN_MAX = 120_000;
const TRANSCRIPT_MAX = 100_000;

function clip(raw: unknown, max: number): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function parseImportBody(body: unknown):
  | { ok: true; data: {
      videoId: string;
      title: string;
      channelTitle: string | null;
      contentType: string;
      markdown: string;
      transcript: string;
    } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;
  const videoId = clip(o.videoId, 20);
  if (!VIDEO_ID_RE.test(videoId)) {
    return { ok: false, error: "Invalid videoId" };
  }
  const title = clip(o.title, TITLE_MAX);
  const markdown = clip(o.markdown, MARKDOWN_MAX);
  const transcript = clip(o.transcript, TRANSCRIPT_MAX);
  if (!title) return { ok: false, error: "title is required" };
  if (!markdown) return { ok: false, error: "markdown is required" };
  if (!transcript) return { ok: false, error: "transcript is required" };
  const channelTitle = clip(o.channelTitle, CHANNEL_MAX) || null;
  const contentType =
    parseLearningPackContentType(o.contentType) ?? "lecture";
  return {
    ok: true,
    data: {
      videoId,
      title,
      channelTitle,
      contentType,
      markdown,
      transcript,
    },
  };
}

/** Persist a client-generated pack without re-running AI (extension local → cloud sync). */
export async function POST(request: NextRequest) {
  const parsed = parseImportBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const ensured = await ensureYouTubeOAuthIdentity(request);
  if (!ensured.identity) {
    return NextResponse.json(
      {
        success: false,
        error: "Sign in on Meanbox to import learning packs.",
        unauthorized: true,
      },
      { status: 401 },
    );
  }

  const { videoId, title, channelTitle, contentType, markdown, transcript } =
    parsed.data;

  const graphPayload = packToKnowledgeGraph({
    videoId,
    title,
    channelTitle: channelTitle ?? undefined,
    contentType,
    markdown,
  });

  const row = await saveLearningPackHistory({
    googleSub: ensured.identity.sub,
    email: ensured.identity.email,
    videoId,
    videoTitle: title,
    channelTitle,
    contentType,
    markdown,
    transcript,
    graphPayload,
  });

  if (!row.ok) {
    return NextResponse.json(
      {
        success: false,
        saved: false,
        error: row.message,
      },
      { status: row.reason === "not_configured" ? 503 : 502 },
    );
  }

  const res = NextResponse.json({
    success: true,
    saved: true,
    historyPackId: row.id,
  });

  if (ensured.cookiesToSet) {
    applyYouTubeOAuthCookies(res, ensured.cookiesToSet);
  }

  return res;
}
