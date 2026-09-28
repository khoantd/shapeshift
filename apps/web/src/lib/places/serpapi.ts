import "server-only";

import {
  placeDetailsSchema,
  placePredictionSchema,
  sanitizeHttpsUrl,
  type PlaceDetails,
  type PlacePrediction,
} from "./types";
import { PlacesApiError } from "./errors";
import {
  extractImageUrls,
  normalizeHours,
  normalizeReviews,
  normalizeTypes,
} from "./serpapi-normalize";

export {
  extractImageUrls,
  normalizeHours,
  normalizeReviews,
  normalizeTypes,
} from "./serpapi-normalize";

const SEARCH_URL = "https://serpapi.com/search.json";

type SerpGps = { latitude?: number; longitude?: number };

type SerpImage =
  | string
  | {
      thumbnail?: string;
      original?: string;
      photo_uri?: string;
    };

type SerpUserReview = {
  username?: string;
  rating?: number;
  description?: string;
  snippet?: string;
  date?: string;
  iso_date?: string;
};

type SerpHoursRow =
  | { day?: string; hours?: string }
  | Record<string, string>;

type SerpLocalResult = {
  place_id?: string;
  title?: string;
  address?: string;
  type?: string | string[];
  types?: string[];
  gps_coordinates?: SerpGps;
  links?: { directions?: string; website?: string };
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  open_state?: string;
  hours?: SerpHoursRow[] | string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
};

type SerpPlaceResult = {
  place_id?: string;
  title?: string;
  address?: string;
  type?: string | string[];
  types?: string[];
  gps_coordinates?: SerpGps;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  open_state?: string;
  hours?: SerpHoursRow[] | string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  images?: SerpImage[];
  user_reviews?:
    | SerpUserReview[]
    | { most_relevant?: SerpUserReview[]; summary?: SerpUserReview[] };
};

type SerpMapsBody = {
  local_results?: SerpLocalResult[];
  place_results?: SerpPlaceResult;
  error?: string;
};

function mapsUriFor(lat: number, lng: number, placeId?: string): string {
  if (placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function mapLocalToPrediction(r: SerpLocalResult): PlacePrediction | null {
  if (!r.place_id || !r.title?.trim()) return null;
  const lat = r.gps_coordinates?.latitude;
  const lng = r.gps_coordinates?.longitude;
  const thumbnail =
    sanitizeHttpsUrl(r.thumbnail) || sanitizeHttpsUrl(r.serpapi_thumbnail);
  const parsed = placePredictionSchema.safeParse({
    placeId: r.place_id,
    mainText: r.title.trim(),
    secondaryText: r.address?.trim() || undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    rating: Number.isFinite(r.rating) ? r.rating : undefined,
    reviewCount: Number.isFinite(r.reviews) ? Math.trunc(r.reviews!) : undefined,
    openState: r.open_state?.trim().slice(0, 200) || undefined,
    thumbnail,
  });
  return parsed.success ? parsed.data : null;
}

function mapToDetails(place: SerpPlaceResult | SerpLocalResult, fallbackPlaceId: string): PlaceDetails | null {
  const lat = place.gps_coordinates?.latitude;
  const lng = place.gps_coordinates?.longitude;
  const title = place.title ?? "Place";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !title.trim()) return null;

  const placeId = place.place_id ?? fallbackPlaceId;
  const website =
    sanitizeHttpsUrl(place.website) ||
    sanitizeHttpsUrl((place as SerpLocalResult).links?.website);
  const images =
    "images" in place
      ? extractImageUrls(place.images, [place.thumbnail, place.serpapi_thumbnail])
      : extractImageUrls(undefined, [place.thumbnail, place.serpapi_thumbnail]);
  const reviews =
    "user_reviews" in place ? normalizeReviews(place.user_reviews) : undefined;

  const parsed = placeDetailsSchema.safeParse({
    placeId,
    name: title.trim(),
    formattedAddress: place.address?.trim() || undefined,
    lat,
    lng,
    types: normalizeTypes(place.types, place.type),
    mapsUri: mapsUriFor(lat!, lng!, placeId),
    website,
    phone: place.phone?.trim().slice(0, 40) || undefined,
    rating: Number.isFinite(place.rating) ? place.rating : undefined,
    reviewCount: Number.isFinite(place.reviews) ? Math.trunc(place.reviews!) : undefined,
    reviews,
    images: images.length ? images : undefined,
    openState: place.open_state?.trim().slice(0, 200) || undefined,
    hours: normalizeHours(place.hours),
  });
  return parsed.success ? parsed.data : null;
}

export async function serpapiAutocompletePlaces(
  input: string,
  apiKey: string,
  signal?: AbortSignal,
  bias?: { lat: number; lng: number } | null,
): Promise<PlacePrediction[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", input);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);
  if (
    bias &&
    Number.isFinite(bias.lat) &&
    Number.isFinite(bias.lng) &&
    Math.abs(bias.lat) <= 90 &&
    Math.abs(bias.lng) <= 180
  ) {
    url.searchParams.set("ll", `@${bias.lat},${bias.lng},14z`);
  }

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    throw new PlacesApiError(`SerpAPI maps search failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as SerpMapsBody;
  if (body.error) {
    throw new PlacesApiError(body.error, 502);
  }

  const out: PlacePrediction[] = [];
  for (const row of body.local_results ?? []) {
    const mapped = mapLocalToPrediction(row);
    if (mapped) out.push(mapped);
    if (out.length >= 8) break;
  }
  return out;
}

export async function serpapiGetPlaceDetails(
  placeId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "place");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    throw new PlacesApiError(`SerpAPI place lookup failed (${res.status})`, res.status);
  }

  const body = (await res.json()) as SerpMapsBody;
  if (body.error) {
    throw new PlacesApiError(body.error, 502);
  }

  const place = body.place_results;
  if (!place) {
    const first = body.local_results?.[0];
    if (first?.place_id) {
      const details = mapToDetails(first, placeId);
      if (details) return details;
    }
    throw new PlacesApiError("SerpAPI place not found", 404);
  }

  const details = mapToDetails(place, placeId);
  if (!details) {
    throw new PlacesApiError("SerpAPI place response was incomplete", 502);
  }
  return details;
}
