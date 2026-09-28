import {
  placePredictionSchema,
  sanitizeHttpsUrl,
  type PlacePrediction,
} from "./types";

const ADDRESS_LIKE_MIN_LENGTH = 40;
/** Ingest / return up to one SerpAPI page after distance ranking. */
export const MAX_PREDICTIONS = 20;
const MAX_INGEST = MAX_PREDICTIONS;
/** SerpAPI `start` page size. */
export const SERP_PAGE_SIZE = 20;
/** Initial visible rows in the results list (Load More reveals more). */
export const RESULTS_PAGE_SIZE = 8;
/** Map viewport height when GPS bias applies (~5 km neighborhood). */
export const SERP_NEARBY_MAP_HEIGHT_M = 5000;

type SerpGps = { latitude?: number; longitude?: number };

/** Minimal SerpAPI local/place row fields needed for list predictions. */
export type SerpPredictionSource = {
  place_id?: string;
  title?: string;
  address?: string;
  gps_coordinates?: SerpGps;
  rating?: number;
  reviews?: number;
  open_state?: string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
};

export type SerpMapsSearchBody = {
  local_results?: SerpPredictionSource[];
  place_results?: SerpPredictionSource;
};

export type SerpAutocompletePage = {
  predictions: PlacePrediction[];
  /** Offset for the next SerpAPI page, or null when no further page is expected. */
  nextStart: number | null;
};

/**
 * Heuristic: comma-separated or long free text is likely an address/place name,
 * where SerpAPI location bias (`ll`) often hurts more than it helps.
 */
export function isAddressLikePlacesQuery(input: string): boolean {
  const q = input.trim();
  if (!q) return false;
  if (q.includes(",")) return true;
  return q.length >= ADDRESS_LIKE_MIN_LENGTH;
}

export function shouldApplySerpLocationBias(
  input: string,
  bias?: { lat: number; lng: number } | null,
): boolean {
  if (!bias) return false;
  if (
    !Number.isFinite(bias.lat) ||
    !Number.isFinite(bias.lng) ||
    Math.abs(bias.lat) > 90 ||
    Math.abs(bias.lng) > 180
  ) {
    return false;
  }
  if (isAddressLikePlacesQuery(input)) return false;
  return true;
}

/**
 * SerpAPI `ll` + `nearby` when GPS bias applies.
 * Meter map height prefers a neighborhood viewport over soft zoom.
 */
export function buildSerpMapsSearchLocationParams(
  input: string,
  bias?: { lat: number; lng: number } | null,
): { ll: string; nearby: "true" } | null {
  if (!shouldApplySerpLocationBias(input, bias) || !bias) return null;
  return {
    ll: `@${bias.lat},${bias.lng},${SERP_NEARBY_MAP_HEIGHT_M}m`,
    nearby: "true",
  };
}

/** Normalize SerpAPI `start` offset (multiples of SERP_PAGE_SIZE). */
export function normalizeSerpStart(start: number | null | undefined): number {
  if (start == null || !Number.isFinite(start) || start < 0) return 0;
  return Math.floor(start / SERP_PAGE_SIZE) * SERP_PAGE_SIZE;
}

export function nextSerpStart(
  currentStart: number,
  predictionCount: number,
): number | null {
  if (predictionCount < MAX_INGEST) return null;
  return normalizeSerpStart(currentStart) + SERP_PAGE_SIZE;
}

export function mapSerpRowToPrediction(
  r: SerpPredictionSource,
): PlacePrediction | null {
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

/**
 * Build autocomplete predictions from a SerpAPI Google Maps `type=search` body.
 * Address / unique-place hits often arrive only as `place_results` (not `local_results`).
 * Ingests up to one page; callers should distance-rank for the client.
 */
export function predictionsFromSerpMapsBody(
  body: SerpMapsSearchBody,
): PlacePrediction[] {
  const out: PlacePrediction[] = [];
  const seen = new Set<string>();

  const placePred = body.place_results
    ? mapSerpRowToPrediction(body.place_results)
    : null;
  if (placePred) {
    out.push(placePred);
    seen.add(placePred.placeId);
  }

  for (const row of body.local_results ?? []) {
    if (out.length >= MAX_INGEST) break;
    const mapped = mapSerpRowToPrediction(row);
    if (!mapped || seen.has(mapped.placeId)) continue;
    out.push(mapped);
    seen.add(mapped.placeId);
  }

  return out;
}

/** Approximate great-circle distance in meters (haversine). */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Prefer nearer hits when GPS bias is available.
 * Predictions without coordinates stay at the end (stable among themselves).
 */
export function sortPredictionsByDistance(
  predictions: PlacePrediction[],
  bias?: { lat: number; lng: number } | null,
): PlacePrediction[] {
  if (!bias || !Number.isFinite(bias.lat) || !Number.isFinite(bias.lng)) {
    return predictions;
  }
  return [...predictions].sort((a, b) => {
    const aOk = Number.isFinite(a.lat) && Number.isFinite(a.lng);
    const bOk = Number.isFinite(b.lat) && Number.isFinite(b.lng);
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (!aOk && !bOk) return 0;
    return (
      haversineMeters(bias, { lat: a.lat!, lng: a.lng! }) -
      haversineMeters(bias, { lat: b.lat!, lng: b.lng! })
    );
  });
}

/**
 * Rank ingested SerpAPI predictions by distance (when bias present).
 * Returns up to one page plus `nextStart` for Load More.
 */
export function rankSerpPredictionsForAutocomplete(
  body: SerpMapsSearchBody,
  bias?: { lat: number; lng: number } | null,
  start: number = 0,
): SerpAutocompletePage {
  const predictions = sortPredictionsByDistance(
    predictionsFromSerpMapsBody(body),
    bias,
  ).slice(0, MAX_PREDICTIONS);
  const pageStart = normalizeSerpStart(start);
  return {
    predictions,
    nextStart: nextSerpStart(pageStart, predictions.length),
  };
}
