import type { PlaceDetails, PlaceHoursRow, PlacePrediction, PlaceReview } from "./types";

/** Search pages older than this skip SerpAPI and return Convex only. */
export const PLACE_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
/** Place details older than this are refreshed from SerpAPI. */
export const PLACE_DETAILS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PlaceCacheSource = "cache" | "live";

/** Convex `places` row shape used for mapping (subset of stored fields). */
export type CachedPlaceRow = {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  openState?: string;
  thumbnail?: string;
  formattedAddress?: string;
  types?: string[];
  mapsUri?: string;
  website?: string;
  phone?: string;
  reviews?: PlaceReview[];
  images?: string[];
  hours?: PlaceHoursRow[];
  hasDetails: boolean;
  fetchedAt: number;
  detailsFetchedAt?: number;
};

export type CachedSearchPage = {
  predictions: PlacePrediction[];
  nextStart: number | null;
  fetchedAt: number;
};

/** Normalize autocomplete lookup key: q|lat,lng|start (bias to 3 decimals). */
export function buildPlaceSearchCacheKey(
  input: string,
  bias: { lat: number; lng: number } | null | undefined,
  start: number,
): string {
  const q = input.trim().toLowerCase();
  const lat =
    bias && Number.isFinite(bias.lat) ? bias.lat.toFixed(3) : "";
  const lng =
    bias && Number.isFinite(bias.lng) ? bias.lng.toFixed(3) : "";
  const pageStart = Number.isFinite(start) && start > 0 ? Math.floor(start) : 0;
  return `${q}|${lat},${lng}|${pageStart}`;
}

export function isCacheFresh(fetchedAt: number, ttlMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;
  return now - fetchedAt < ttlMs;
}

export function predictionFromPlaceRow(row: CachedPlaceRow): PlacePrediction {
  return {
    placeId: row.placeId,
    mainText: row.mainText,
    ...(row.secondaryText ? { secondaryText: row.secondaryText } : {}),
    ...(typeof row.lat === "number" && Number.isFinite(row.lat) ? { lat: row.lat } : {}),
    ...(typeof row.lng === "number" && Number.isFinite(row.lng) ? { lng: row.lng } : {}),
    ...(typeof row.rating === "number" ? { rating: row.rating } : {}),
    ...(typeof row.reviewCount === "number" ? { reviewCount: row.reviewCount } : {}),
    ...(row.openState ? { openState: row.openState } : {}),
    ...(row.thumbnail ? { thumbnail: row.thumbnail } : {}),
  };
}

/** Map a details-capable cache row to PlaceDetails, or null if coords/name missing. */
export function placeDetailsFromPlaceRow(row: CachedPlaceRow): PlaceDetails | null {
  if (!row.hasDetails) return null;
  if (typeof row.lat !== "number" || !Number.isFinite(row.lat)) return null;
  if (typeof row.lng !== "number" || !Number.isFinite(row.lng)) return null;
  const name = row.mainText.trim();
  if (!name) return null;

  return {
    placeId: row.placeId,
    name,
    lat: row.lat,
    lng: row.lng,
    ...(row.formattedAddress || row.secondaryText
      ? { formattedAddress: (row.formattedAddress || row.secondaryText)!.trim() }
      : {}),
    ...(row.types?.length ? { types: row.types } : {}),
    ...(row.mapsUri ? { mapsUri: row.mapsUri } : {}),
    ...(row.website ? { website: row.website } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(typeof row.rating === "number" ? { rating: row.rating } : {}),
    ...(typeof row.reviewCount === "number" ? { reviewCount: row.reviewCount } : {}),
    ...(row.reviews?.length ? { reviews: row.reviews } : {}),
    ...(row.images?.length ? { images: row.images } : {}),
    ...(row.openState ? { openState: row.openState } : {}),
    ...(row.hours?.length ? { hours: row.hours } : {}),
  };
}

export function predictionToCacheFields(prediction: PlacePrediction) {
  return {
    placeId: prediction.placeId.trim(),
    mainText: prediction.mainText.trim(),
    secondaryText: prediction.secondaryText?.trim() || undefined,
    lat:
      typeof prediction.lat === "number" && Number.isFinite(prediction.lat)
        ? prediction.lat
        : undefined,
    lng:
      typeof prediction.lng === "number" && Number.isFinite(prediction.lng)
        ? prediction.lng
        : undefined,
    rating: typeof prediction.rating === "number" ? prediction.rating : undefined,
    reviewCount:
      typeof prediction.reviewCount === "number" ? prediction.reviewCount : undefined,
    openState: prediction.openState?.trim() || undefined,
    thumbnail: prediction.thumbnail,
  };
}
