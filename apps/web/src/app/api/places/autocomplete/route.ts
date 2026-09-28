import {
  autocompletePlaces,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  PlacesApiError,
  PlacesConfigError,
} from "@/lib/places/client";
import { parseAutocompleteQuery } from "@/lib/places/types";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = parseAutocompleteQuery(url.searchParams.get("q"));
  const bias = parseBias(url);

  if (!q) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Query must be at least 2 characters" },
        predictions: [],
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
      },
      { status: 503 },
    );
  }

  try {
    const predictions = await autocompletePlaces(q, req.signal, bias);
    return Response.json({ success: true, predictions });
  } catch (e) {
    if (e instanceof PlacesConfigError) {
      return Response.json(
        { success: false, error: { code: e.code, message: e.message }, predictions: [] },
        { status: 503 },
      );
    }
    if (e instanceof PlacesApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return Response.json(
        { success: false, error: { code: e.code, message: e.message }, predictions: [] },
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
      },
      { status: 500 },
    );
  }
}
