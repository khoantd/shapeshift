import "server-only";

import {
  placeDetailsSchema,
  placePredictionSchema,
  type PlaceDetails,
  type PlacePrediction,
} from "./types";
import { PlacesApiError } from "./errors";

const GEOCODE_URL = (query: string) =>
  `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`;

type MapTilerFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: { ref?: string };
};

type MapTilerGeocodeBody = {
  features?: MapTilerFeature[];
};

function featureCenter(f: MapTilerFeature): { lng: number; lat: number } | null {
  if (Array.isArray(f.center) && f.center.length >= 2) {
    const [lng, lat] = f.center;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
  }
  const coords = f.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
  }
  return null;
}

function mapFeatureToPrediction(f: MapTilerFeature): PlacePrediction | null {
  if (!f.id) return null;
  const placeName = f.place_name?.trim() || "";
  const text = f.text?.trim() || "";
  const mainText = text || placeName.split(",")[0]?.trim() || "";
  if (!mainText) return null;
  let secondaryText: string | undefined;
  if (placeName && placeName !== mainText) {
    secondaryText = placeName.startsWith(`${mainText},`)
      ? placeName.slice(mainText.length).replace(/^,\s*/, "").trim()
      : placeName;
  }
  const parsed = placePredictionSchema.safeParse({
    placeId: f.id,
    mainText,
    secondaryText: secondaryText || undefined,
  });
  return parsed.success ? parsed.data : null;
}

function mapFeatureToDetails(f: MapTilerFeature, fallbackId: string): PlaceDetails | null {
  const center = featureCenter(f);
  if (!center) return null;
  const placeName = f.place_name?.trim() || "";
  const text = f.text?.trim() || "";
  const name = text || placeName.split(",")[0]?.trim() || placeName;
  if (!name) return null;
  const parsed = placeDetailsSchema.safeParse({
    placeId: f.id ?? fallbackId,
    name,
    formattedAddress: placeName || undefined,
    lat: center.lat,
    lng: center.lng,
    types: f.place_type?.slice(0, 50),
    mapsUri: `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=16/${center.lat}/${center.lng}`,
  });
  return parsed.success ? parsed.data : null;
}

export async function maptilerAutocompletePlaces(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const url = new URL(GEOCODE_URL(input));
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", "8");
  url.searchParams.set("autocomplete", "true");

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    throw new PlacesApiError(`MapTiler geocoding failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as MapTilerGeocodeBody;
  const out: PlacePrediction[] = [];
  for (const feature of body.features ?? []) {
    const mapped = mapFeatureToPrediction(feature);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function maptilerGetPlaceDetails(
  placeId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const url = new URL(GEOCODE_URL(placeId));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    throw new PlacesApiError(`MapTiler place lookup failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as MapTilerGeocodeBody;
  const feature = body.features?.[0];
  if (!feature) {
    throw new PlacesApiError("MapTiler place not found", 404);
  }
  const details = mapFeatureToDetails(feature, placeId);
  if (!details) {
    throw new PlacesApiError("MapTiler place response was incomplete", 502);
  }
  return details;
}
