import { resolveInspiredCanvasAuth } from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  getInspiredCanvasBaseUrl,
  listCxoFeed,
  setCxoFeedItemPinned,
  setCxoFeedItemRead,
} from "@/lib/inspired-canvas/client";
import { parseNewsPatchBody } from "@/lib/newsPatch";

export const runtime = "nodejs";

function parseLimit(raw: string | null): number {
  if (raw == null || raw === "") return 50;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const source = (url.searchParams.get("source") ?? "").trim().slice(0, 200);
  const limit = parseLimit(url.searchParams.get("limit"));

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
      },
      { status: 401 },
    );
  }

  try {
    const feed = await listCxoFeed({
      baseUrl: getInspiredCanvasBaseUrl(),
      accessToken: token,
      limit,
      source: source || undefined,
    });
    let items = feed.items;
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((item) =>
        `${item.title} ${item.excerpt} ${item.sourceDisplayName ?? ""}`.toLowerCase().includes(needle),
      );
    }
    const sources = feed.sources.map((s) => ({
      id: s.id,
      name: s.displayName,
      enabled: s.enabled,
    }));
    return Response.json({ success: true, items, sources });
  } catch (e) {
    if (e instanceof InspiredCanvasClientError) {
      const status = e.status === 401 || e.status === 403 ? e.status : 502;
      return Response.json(
        { success: false, error: e.message, items: [], sources: [] },
        { status },
      );
    }
    const message = e instanceof Error ? e.message : "Inspired Canvas unreachable";
    return Response.json(
      { success: false, error: message, items: [], sources: [] },
      { status: 502 },
    );
  }
}

/** Pin / unpin or mark read / unread a feed item. */
export async function PATCH(req: Request) {
  const { token, error: authError } = await resolveInspiredCanvasAuth(
    req.headers.get("authorization"),
  );
  if (!token) {
    return Response.json(
      { success: false, error: authError ?? "Unauthorized" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseNewsPatchBody(raw);
  if (!parsed) {
    return Response.json(
      { success: false, error: "Expected { id, pinned } or { id, read }" },
      { status: 400 },
    );
  }

  try {
    if (parsed.kind === "pin") {
      await setCxoFeedItemPinned({
        accessToken: token,
        id: parsed.id,
        pinned: parsed.pinned,
      });
      return Response.json({ success: true, id: parsed.id, pinned: parsed.pinned });
    }

    await setCxoFeedItemRead({
      accessToken: token,
      id: parsed.id,
      isRead: parsed.read,
    });
    return Response.json({ success: true, id: parsed.id, read: parsed.read });
  } catch (e) {
    if (e instanceof InspiredCanvasClientError) {
      const status =
        e.status === 401 || e.status === 403 || e.status === 404 || e.status === 400
          ? e.status
          : 502;
      return Response.json({ success: false, error: e.message }, { status });
    }
    const message = e instanceof Error ? e.message : "Inspired Canvas unreachable";
    return Response.json({ success: false, error: message }, { status: 502 });
  }
}
