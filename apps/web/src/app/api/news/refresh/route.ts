import { resolveInspiredCanvasAuth } from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  getInspiredCanvasBaseUrl,
  listCxoFeed,
  pullNewCxoFeedArticles,
} from "@/lib/inspired-canvas/client";

export const runtime = "nodejs";
/** Multi-source RSS/scrape can take several minutes. */
export const maxDuration = 300;

function parseLimit(raw: string | null): number {
  if (raw == null || raw === "") return 50;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}

/**
 * Pull new articles from Inspired Canvas sources (fetch → upsert), then return
 * the updated feed list — same behavior as IC workspace Refresh.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "").trim().slice(0, 200);
  const limit = parseLimit(url.searchParams.get("limit"));

  let bodySource = "";
  try {
    const raw = (await req.json()) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const s = (raw as { source?: unknown }).source;
      if (typeof s === "string") bodySource = s.trim().slice(0, 200);
    }
  } catch {
    /* empty body is fine */
  }

  const sourceHint = bodySource || source;

  const { token, error: authError } = await resolveInspiredCanvasAuth(
    req.headers.get("authorization"),
  );
  if (!token) {
    return Response.json(
      {
        success: false,
        error: authError ?? "Unauthorized",
        items: [],
        sources: [],
        pull: null,
      },
      { status: 401 },
    );
  }

  try {
    const pull = await pullNewCxoFeedArticles({
      accessToken: token,
      baseUrl: getInspiredCanvasBaseUrl(),
      sourceHint: sourceHint || undefined,
    });

    const feed = await listCxoFeed({
      baseUrl: getInspiredCanvasBaseUrl(),
      accessToken: token,
      limit,
      source: sourceHint || undefined,
    });

    const sources = feed.sources.map((s) => ({
      id: s.id,
      name: s.displayName,
      enabled: s.enabled,
    }));

    return Response.json({
      success: true,
      items: feed.items,
      sources,
      pull: {
        targetCount: pull.targetCount,
        okCount: pull.okCount,
        failCount: pull.failCount,
        results: pull.results.map((r) => ({
          sourceId: r.sourceId,
          siteUrl: r.siteUrl,
          ok: r.ok,
          insertedAttempted: r.insertedAttempted,
          error: r.error ?? null,
          fetchMode: r.fetchMode ?? null,
        })),
      },
    });
  } catch (e) {
    if (e instanceof InspiredCanvasClientError) {
      const status = e.status === 401 || e.status === 403 ? e.status : 502;
      return Response.json(
        {
          success: false,
          error: e.message,
          items: [],
          sources: [],
          pull: null,
        },
        { status },
      );
    }
    const message = e instanceof Error ? e.message : "Inspired Canvas unreachable";
    return Response.json(
      {
        success: false,
        error: message,
        items: [],
        sources: [],
        pull: null,
      },
      { status: 502 },
    );
  }
}
