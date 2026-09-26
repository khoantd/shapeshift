import {
  APIUserAbortError,
  briefNewsStoryWithJev,
  classifierMode,
  mockBriefNewsStory,
  newsBriefRequestSchema,
  warnMockOnce,
  type NewsBriefResult,
} from "@shapeshift/core/server";
import { resolveInspiredCanvasAuth } from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  getCxoFeedItemBrief,
  setCxoFeedItemBrief,
  type CxoFeedBrief,
} from "@/lib/inspired-canvas/client";

export const runtime = "nodejs";

function normalizeQuery(q: string | undefined): string {
  return (q ?? "").trim().toLowerCase();
}

function briefMatchesQuery(stored: CxoFeedBrief, query: string): boolean {
  return normalizeQuery(stored.query ?? undefined) === normalizeQuery(query);
}

function toView(result: NewsBriefResult | CxoFeedBrief): {
  urgency: number;
  relevance: number;
  tone: CxoFeedBrief["tone"];
  line: string;
  source: "jev" | "mock";
  model?: string | null;
} {
  return {
    urgency: result.urgency,
    relevance: result.relevance,
    tone: result.tone,
    line: result.line,
    source: result.source === "jev" || result.source === "mock" ? result.source : "mock",
    model: "model" in result ? (result.model ?? null) : null,
  };
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = newsBriefRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: "Expected { title, excerpt, query?, id?, force? }" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (!input.title && !input.excerpt) {
    return Response.json({ success: false, error: "title or excerpt required" }, { status: 400 });
  }

  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const itemId = typeof body.id === "string" ? body.id.trim().slice(0, 128) : "";
  const force = body.force === true;
  const query = (input.query ?? "").trim();

  let accessToken: string | null = null;
  if (itemId) {
    const auth = await resolveInspiredCanvasAuth(request.headers.get("authorization"));
    if (!auth.token) {
      return Response.json(
        {
          success: false,
          error: auth.error ?? "Inspired Canvas auth required to store Brief",
        },
        { status: 401 },
      );
    }
    accessToken = auth.token;
  }

  try {
    if (itemId && accessToken && !force) {
      try {
        const stored = await getCxoFeedItemBrief({ accessToken, id: itemId });
        if (stored && briefMatchesQuery(stored, query)) {
          const view = toView(stored);
          return Response.json({
            success: true,
            ...view,
            latencyMs: 0,
            cached: true,
            persisted: true,
          });
        }
      } catch (e) {
        if (e instanceof InspiredCanvasClientError && e.status === 503) {
          // Column missing — fall through to generate.
        } else if (!(e instanceof InspiredCanvasClientError)) {
          throw e;
        }
      }
    }

    const forceOffline = process.env.NEXT_PUBLIC_USE_MOCK === "true";
    const { mode, reason } = forceOffline
      ? { mode: "offline" as const, reason: "forceOffline" }
      : classifierMode();

    let result: NewsBriefResult;
    if (mode === "offline") {
      warnMockOnce(reason);
      result = mockBriefNewsStory(input);
    } else {
      try {
        result = await briefNewsStoryWithJev(input, request.signal);
        console.info(
          `[jev-brief] ${result.model} ${result.latencyMs}ms u=${result.urgency.toFixed(2)} r=${result.relevance.toFixed(2)} ${result.tone}`,
        );
      } catch (err) {
        if (err instanceof APIUserAbortError || request.signal.aborted) {
          return new Response(null, { status: 499 });
        }
        console.warn(`[jev-brief] failed: ${err instanceof Error ? err.message : String(err)}`);
        result = { ...mockBriefNewsStory(input), model: "error-fallback" };
      }
    }

    let persisted = false;
    if (itemId && accessToken) {
      try {
        await setCxoFeedItemBrief({
          accessToken,
          id: itemId,
          brief: {
            urgency: result.urgency,
            relevance: result.relevance,
            tone: result.tone,
            line: result.line,
            source: result.source,
            model: result.model,
            query,
            generatedAt: new Date().toISOString(),
          },
        });
        persisted = true;
      } catch (e) {
        if (e instanceof InspiredCanvasClientError) {
          console.warn(`[jev-brief] persist failed: ${e.message}`);
        } else {
          throw e;
        }
      }
    }

    return Response.json({
      success: true,
      ...toView(result),
      latencyMs: result.latencyMs,
      questionCount: result.questionCount,
      model: result.model,
      cached: false,
      persisted,
    });
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (err instanceof InspiredCanvasClientError) {
      const status =
        err.status === 401 || err.status === 403 || err.status === 404 || err.status === 400
          ? err.status
          : 502;
      return Response.json({ success: false, error: err.message }, { status });
    }
    console.warn(`[jev-brief] failed: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ success: false, error: "Could not generate brief" }, { status: 502 });
  }
}
