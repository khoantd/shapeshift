import "server-only";

import {
  placeDetailsSchema,
  sanitizeHttpsUrl,
  type PlaceDetails,
} from "./types";
import { PlacesApiError } from "./errors";
import {
  extractImageUrls,
  normalizeHours,
  normalizeReviews,
  normalizeTypes,
} from "./serpapi-normalize";
import {
  buildSerpMapsSearchLocationParams,
  normalizeSerpStart,
  rankSerpPredictionsForAutocomplete,
  type SerpAutocompletePage,
} from "./serpapi-search";

export {
  extractImageUrls,
  normalizeHours,
  normalizeReviews,
  normalizeTypes,
} from "./serpapi-normalize";
export {
  buildSerpMapsSearchLocationParams,
  isAddressLikePlacesQuery,
  predictionsFromSerpMapsBody,
  rankSerpPredictionsForAutocomplete,
  shouldApplySerpLocationBias,
} from "./serpapi-search";
export type { SerpAutocompletePage } from "./serpapi-search";

const SEARCH_URL = "https://serpapi.com/search.json";

/** Short TTL avoids burning credits on Strict Mode double-fetch / identical retries. */
const AUTOCOMPLETE_CACHE_TTL_MS = 5 * 60 * 1000;
const autocompleteCache = new Map<
  string,
  { expires: number; page: SerpAutocompletePage }
>();

const RATE_LIMIT_HINT =
  "SerpAPI rate limit or search quota exceeded. Check https://serpapi.com/dashboard, wait for the hourly reset, or switch PLACES_PROVIDER to maptiler/google.";

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

function autocompleteCacheKey(
  input: string,
  bias: { lat: number; lng: number } | null | undefined,
  start: number,
): string {
  const lat = bias && Number.isFinite(bias.lat) ? bias.lat.toFixed(3) : "";
  const lng = bias && Number.isFinite(bias.lng) ? bias.lng.toFixed(3) : "";
  return `${input.trim().toLowerCase()}|${lat},${lng}|${start}`;
}

function throwSerpHttpError(
  status: number,
  body: SerpMapsBody | null,
  kind: "search" | "place",
): never {
  const apiMessage = typeof body?.error === "string" ? body.error.trim() : "";
  if (status === 429) {
    throw new PlacesApiError(apiMessage || RATE_LIMIT_HINT, 429);
  }
  const fallback =
    kind === "search"
      ? `SerpAPI maps search failed (${status})`
      : `SerpAPI place lookup failed (${status})`;
  throw new PlacesApiError(apiMessage || fallback, status);
}

async function readSerpBody(res: Response): Promise<SerpMapsBody | null> {
  try {
    return (await res.json()) as SerpMapsBody;
  } catch {
    return null;
  }
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
  start: number = 0,
): Promise<SerpAutocompletePage> {
  const pageStart = normalizeSerpStart(start);
  const cacheKey = autocompleteCacheKey(input, bias, pageStart);
  const cached = autocompleteCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.page;
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", input);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);
  const location = buildSerpMapsSearchLocationParams(input, bias);
  if (location) {
    url.searchParams.set("ll", location.ll);
    url.searchParams.set("nearby", location.nearby);
  }
  if (pageStart > 0) {
    url.searchParams.set("start", String(pageStart));
  }

  const res = await fetch(url, { method: "GET", signal });
  const body = await readSerpBody(res);
  if (!res.ok) {
    throwSerpHttpError(res.status, body, "search");
  }
  if (!body) {
    throw new PlacesApiError("SerpAPI maps search returned an empty body", 502);
  }
  if (body.error) {
    throw new PlacesApiError(body.error, 502);
  }

  const page = rankSerpPredictionsForAutocomplete(body, bias, pageStart);
  autocompleteCache.set(cacheKey, {
    expires: Date.now() + AUTOCOMPLETE_CACHE_TTL_MS,
    page,
  });
  return page;
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
  const body = await readSerpBody(res);
  if (!res.ok) {
    throwSerpHttpError(res.status, body, "place");
  }
  if (!body) {
    throw new PlacesApiError("SerpAPI place lookup returned an empty body", 502);
  }
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
