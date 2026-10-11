import { resolveInspiredCanvasAuth } from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  ensureBrowserClipsSource,
  upsertCxoFeedClipAndGetId,
} from "@/lib/inspired-canvas/client";
import {
  newsClipContentHash,
  normalizeCanonicalUrl,
  parseNewsClipRequest,
} from "@/lib/news/newsClip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = parseNewsClipRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const auth = await resolveInspiredCanvasAuth(request.headers.get("authorization"));
  if (!auth.token) {
    return Response.json(
      {
        success: false,
        error: auth.error ?? "Inspired Canvas auth required to save clips",
      },
      { status: 401 },
    );
  }

  const { title, excerpt } = parsed.data;
  const canonicalUrl =
    normalizeCanonicalUrl(parsed.data.canonicalUrl) ||
    `https://meanbox.vercel.app/extension-clips#${newsClipContentHash({ title, excerpt })}`;

  const contentHash = newsClipContentHash({
    canonicalUrl: parsed.data.canonicalUrl ? canonicalUrl : undefined,
    title,
    excerpt,
  });

  try {
    const sourceId = await ensureBrowserClipsSource({ accessToken: auth.token });
    const id = await upsertCxoFeedClipAndGetId({
      accessToken: auth.token,
      sourceId,
      item: {
        title,
        excerpt,
        canonicalUrl,
        publishedAtIso: new Date().toISOString(),
        contentHash,
        ingestMethod: "scrape",
      },
    });

    return Response.json({
      success: true,
      id,
      title,
      excerpt,
      canonicalUrl,
      sourceId,
    });
  } catch (e) {
    if (e instanceof InspiredCanvasClientError) {
      const status =
        e.status === 401 || e.status === 403 || e.status === 503 ? e.status : 502;
      return Response.json({ success: false, error: e.message }, { status });
    }
    const message = e instanceof Error ? e.message : "Clip failed";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}
