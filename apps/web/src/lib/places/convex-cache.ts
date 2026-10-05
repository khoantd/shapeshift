import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import {
  buildPlaceSearchCacheKey,
  isCacheFresh,
  PLACE_DETAILS_TTL_MS,
  PLACE_SEARCH_TTL_MS,
  placeDetailsFromPlaceRow,
  predictionFromPlaceRow,
  type CachedPlaceRow,
  type CachedSearchPage,
  type PlaceCacheSource,
} from "./places-cache";
import type { PlaceDetails, PlacePrediction } from "./types";

export {
  buildPlaceSearchCacheKey,
  isCacheFresh,
  PLACE_DETAILS_TTL_MS,
  PLACE_SEARCH_TTL_MS,
} from "./places-cache";
export type { PlaceCacheSource } from "./places-cache";

function convexUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  return url || null;
}

function client(): ConvexHttpClient | null {
  const url = convexUrl();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function stripUndefinedPrediction(p: {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  openState?: string;
  thumbnail?: string;
}): PlacePrediction {
  return predictionFromPlaceRow({
    ...p,
    hasDetails: false,
    fetchedAt: 0,
  });
}

/** Read a cached search page when Convex is configured. */
export async function readCachedSearch(
  input: string,
  bias: { lat: number; lng: number } | null | undefined,
  start: number,
): Promise<CachedSearchPage | null> {
  const convex = client();
  if (!convex) return null;

  const queryKey = buildPlaceSearchCacheKey(input, bias, start);
  try {
    const row = await convex.query(api.placesCache.getSearch, { queryKey });
    if (!row) return null;
    return {
      predictions: (row.predictions ?? []).map(stripUndefinedPrediction),
      nextStart: typeof row.nextStart === "number" ? row.nextStart : null,
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

/** Persist autocomplete results (best-effort; never throws to caller). */
export async function writeCachedSearch(args: {
  input: string;
  bias: { lat: number; lng: number } | null | undefined;
  start: number;
  predictions: PlacePrediction[];
  nextStart: number | null;
}): Promise<void> {
  const convex = client();
  if (!convex) return;

  const queryKey = buildPlaceSearchCacheKey(args.input, args.bias, args.start);
  try {
    await convex.mutation(api.placesCache.upsertSearch, {
      queryKey,
      query: args.input.trim(),
      lat: args.bias?.lat,
      lng: args.bias?.lng,
      start: args.start,
      nextStart: args.nextStart ?? undefined,
      predictions: args.predictions.map((p) => ({
        placeId: p.placeId,
        mainText: p.mainText,
        secondaryText: p.secondaryText,
        lat: p.lat,
        lng: p.lng,
        rating: p.rating,
        reviewCount: p.reviewCount,
        openState: p.openState,
        thumbnail: p.thumbnail,
      })),
    });
  } catch {
    // Cache write failures must not break search.
  }
}

export async function readCachedPlaceDetails(
  placeId: string,
): Promise<{ place: PlaceDetails; fetchedAt: number } | null> {
  const convex = client();
  if (!convex) return null;

  try {
    const row = await convex.query(api.placesCache.getPlace, {
      placeId: placeId.trim(),
    });
    if (!row) return null;
    const mapped = placeDetailsFromPlaceRow(row as CachedPlaceRow);
    if (!mapped) return null;
    const fetchedAt = row.detailsFetchedAt ?? row.fetchedAt;
    return { place: mapped, fetchedAt };
  } catch {
    return null;
  }
}

export async function writeCachedPlaceDetails(place: PlaceDetails): Promise<void> {
  const convex = client();
  if (!convex) return;

  try {
    await convex.mutation(api.placesCache.upsertPlaceDetails, {
      placeId: place.placeId,
      mainText: place.name,
      secondaryText: place.formattedAddress,
      formattedAddress: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      types: place.types,
      mapsUri: place.mapsUri,
      website: place.website,
      phone: place.phone,
      rating: place.rating,
      reviewCount: place.reviewCount,
      reviews: place.reviews,
      images: place.images,
      openState: place.openState,
      hours: place.hours,
    });
  } catch {
    // Cache write failures must not break details.
  }
}

export function searchCacheIsFresh(fetchedAt: number, now = Date.now()): boolean {
  return isCacheFresh(fetchedAt, PLACE_SEARCH_TTL_MS, now);
}

export function detailsCacheIsFresh(fetchedAt: number, now = Date.now()): boolean {
  return isCacheFresh(fetchedAt, PLACE_DETAILS_TTL_MS, now);
}

export type CachedAutocompleteResult = {
  predictions: PlacePrediction[];
  nextStart: number | null;
  source: PlaceCacheSource;
  stale?: boolean;
};

export type CachedDetailsResult = {
  place: PlaceDetails;
  source: PlaceCacheSource;
  stale?: boolean;
};
