import {
  getPlaceDetails,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  PlacesApiError,
  PlacesConfigError,
} from "@/lib/places/client";
import { parsePlaceIdParam } from "@/lib/places/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = parsePlaceIdParam(url.searchParams.get("placeId"));

  if (!placeId) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "placeId is required" } },
      { status: 400 },
    );
  }

  if (!placesProviderConfigured()) {
    return Response.json(
      {
        success: false,
        error: { code: "PLACES_CONFIG", message: missingPlacesConfigMessage() },
      },
      { status: 503 },
    );
  }

  try {
    const place = await getPlaceDetails(placeId, req.signal);
    return Response.json({ success: true, place });
  } catch (e) {
    if (e instanceof PlacesConfigError) {
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status: 503 },
      );
    }
    if (e instanceof PlacesApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status },
      );
    }
    if (e instanceof Error && e.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Place details failed" } },
      { status: 500 },
    );
  }
}
