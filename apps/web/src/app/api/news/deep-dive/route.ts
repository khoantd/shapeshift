import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { resolveInspiredCanvasAuth } from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  getCxoFeedItemDeepDive,
  setCxoFeedItemDeepDive,
} from "@/lib/inspired-canvas/client";
import {
  DeepDiveConfigError,
  DeepDiveUpstreamError,
  parseDeepDiveRequest,
  runNewsDeepDive,
} from "@/lib/perplexity/deepDive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = parseDeepDiveRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ success: false, error: parsed.error }, { status: 400 });
  }

  const input = parsed.data;
  const itemId = input.id?.trim() || "";

  let accessToken: string | null = null;
  if (itemId) {
    const auth = await resolveInspiredCanvasAuth(request.headers.get("authorization"));
    if (!auth.token) {
      return Response.json(
        {
          success: false,
          error: auth.error ?? "Inspired Canvas auth required to store Deep Dive",
        },
        { status: 401 },
      );
    }
    accessToken = auth.token;
  }

  try {
    if (itemId && accessToken && !input.force) {
      try {
        const stored = await getCxoFeedItemDeepDive({ accessToken, id: itemId });
        if (stored?.text) {
          return Response.json({
            success: true,
            text: stored.text,
            sources: stored.sources,
            responseId: stored.responseId ?? null,
            model: stored.model ?? null,
            cached: true,
            persisted: true,
          });
        }
      } catch (e) {
        if (e instanceof InspiredCanvasClientError && e.status === 503) {
          // Column missing — fall through to generate without persist failure later.
        } else if (!(e instanceof InspiredCanvasClientError)) {
          throw e;
        }
      }
    }

    const result = await runNewsDeepDive(input, request.signal);

    let persisted = false;
    if (itemId && accessToken) {
      try {
        await setCxoFeedItemDeepDive({
          accessToken,
          id: itemId,
          deepDive: {
            text: result.text,
            sources: result.sources,
            model: result.model,
            responseId: result.responseId,
            generatedAt: new Date().toISOString(),
          },
        });
        persisted = true;
      } catch (e) {
        if (e instanceof InspiredCanvasClientError) {
          console.warn(`[news-deep-dive] persist failed: ${e.message}`);
          // Still return the generated answer; client can show a soft warning via persisted:false
        } else {
          throw e;
        }
      }
    }

    return Response.json({
      success: true,
      text: result.text,
      sources: result.sources,
      responseId: result.responseId,
      model: result.model,
      cached: result.cached,
      persisted,
    });
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (err instanceof DeepDiveConfigError || err instanceof DeepDiveUpstreamError) {
      return Response.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof InspiredCanvasClientError) {
      const status =
        err.status === 401 || err.status === 403 || err.status === 404 || err.status === 400
          ? err.status
          : 502;
      return Response.json({ success: false, error: err.message }, { status });
    }
    console.warn(`[news-deep-dive] failed: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json(
      { success: false, error: "Could not generate deep dive" },
      { status: 502 },
    );
  }
}
