import {
  autocompletePlaces,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  PlacesApiError,
  PlacesConfigError,
} from "@/lib/places/client";
import { parseAutocompleteQuery } from "@/lib/places/types";
import { normalizeSerpStart } from "@/lib/places/serpapi-search";

export const runtime = "nodejs";

function parseBias(url: URL): { lat: number; lng: number } | null {
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function parseStart(url: URL): number {
  const raw = url.searchParams.get("start");
  if (raw == null || raw === "") return 0;
  return normalizeSerpStart(Number(raw));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = parseAutocompleteQuery(url.searchParams.get("q"));
  const bias = parseBias(url);
  const start = parseStart(url);

  if (!q) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Query must be at least 2 characters" },
        predictions: [],
        nextStart: null,
      },
      { status: 400 },
    );
  }

  if (!placesProviderConfigured()) {
    return Response.json(
      {
        success: false,
        error: { code: "PLACES_CONFIG", message: missingPlacesConfigMessage() },
        predictions: [],
        nextStart: null,
      },
      { status: 503 },
    );
  }

  try {
    const page = await autocompletePlaces(q, req.signal, bias, start);
    return Response.json({
      success: true,
      predictions: page.predictions,
      nextStart: page.nextStart,
      source: page.source ?? "live",
      ...(page.stale ? { stale: true } : {}),
    });
  } catch (e) {
    if (e instanceof PlacesConfigError) {
      return Response.json(
        {
          success: false,
          error: { code: e.code, message: e.message },
          predictions: [],
          nextStart: null,
        },
        { status: 503 },
      );
    }
    if (e instanceof PlacesApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return Response.json(
        {
          success: false,
          error: { code: e.code, message: e.message },
          predictions: [],
          nextStart: null,
        },
        { status },
      );
    }
    if (e instanceof Error && e.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return Response.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Autocomplete failed" },
        predictions: [],
        nextStart: null,
      },
      { status: 500 },
    );
  }
}
