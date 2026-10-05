import "server-only";

import {
  getMapTilerServerKey,
  getSerpApiKey,
  hasGoogleMapsServerKey,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  resolvePlacesProvider,
} from "./config";
import {
  detailsCacheIsFresh,
  readCachedPlaceDetails,
  readCachedSearch,
  searchCacheIsFresh,
  writeCachedPlaceDetails,
  writeCachedSearch,
  type PlaceCacheSource,
} from "./convex-cache";
import { PlacesApiError, PlacesConfigError } from "./errors";
import { googleAutocompletePlaces, googleGetPlaceDetails } from "./google";
import { maptilerAutocompletePlaces, maptilerGetPlaceDetails } from "./maptiler";
import { serpapiAutocompletePlaces, serpapiGetPlaceDetails } from "./serpapi";
import type { PlaceDetails, PlacePrediction } from "./types";

export {
  getGoogleMapsPublicKey,
  getMapTilerPublicKey,
  getMapTilerServerKey,
  getSerpApiKey,
  hasGoogleMapsServerKey,
  hasMapTilerServerKey,
  hasSerpApiKey,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  providerLabel,
  resolveMapTilesProvider,
  resolvePlacesProvider,
} from "./config";
export type { MapTilesProvider } from "./config";
export { PlacesApiError, PlacesConfigError } from "./errors";

/** @deprecated Prefer missingPlacesConfigMessage() */
export const MISSING_SERVER_KEY_MESSAGE = missingPlacesConfigMessage();

export type PlacesLocationBias = { lat: number; lng: number };

export type AutocompletePage = {
  predictions: PlacePrediction[];
  nextStart: number | null;
  source?: PlaceCacheSource;
  stale?: boolean;
};

export type PlaceDetailsResult = {
  place: PlaceDetails;
  source?: PlaceCacheSource;
  stale?: boolean;
};

async function serpapiAutocompleteWithCache(
  input: string,
  apiKey: string,
  signal: AbortSignal | undefined,
  bias: PlacesLocationBias | null | undefined,
  start: number,
): Promise<AutocompletePage> {
  const cached = await readCachedSearch(input, bias, start);
  if (cached && searchCacheIsFresh(cached.fetchedAt)) {
    return {
      predictions: cached.predictions,
      nextStart: cached.nextStart,
      source: "cache",
    };
  }

  try {
    const page = await serpapiAutocompletePlaces(input, apiKey, signal, bias, start);
    await writeCachedSearch({
      input,
      bias,
      start,
      predictions: page.predictions,
      nextStart: page.nextStart,
    });
    return {
      predictions: page.predictions,
      nextStart: page.nextStart,
      source: "live",
    };
  } catch (e) {
    if (cached && cached.predictions.length > 0) {
      return {
        predictions: cached.predictions,
        nextStart: cached.nextStart,
        source: "cache",
        stale: true,
      };
    }
    throw e;
  }
}

async function serpapiDetailsWithCache(
  placeId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlaceDetailsResult> {
  const cached = await readCachedPlaceDetails(placeId);
  if (cached && detailsCacheIsFresh(cached.fetchedAt)) {
    return { place: cached.place, source: "cache" };
  }

  try {
    const place = await serpapiGetPlaceDetails(placeId, apiKey, signal);
    await writeCachedPlaceDetails(place);
    return { place, source: "live" };
  } catch (e) {
    if (cached) {
      return { place: cached.place, source: "cache", stale: true };
    }
    throw e;
  }
}

export async function autocompletePlaces(
  input: string,
  signal?: AbortSignal,
  bias?: PlacesLocationBias | null,
  start: number = 0,
): Promise<AutocompletePage> {
  const provider = resolvePlacesProvider();
  if (!provider) throw new PlacesConfigError(missingPlacesConfigMessage());

  if (provider === "maptiler") {
    const key = getMapTilerServerKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    const predictions = await maptilerAutocompletePlaces(input, key, signal);
    return { predictions, nextStart: null, source: "live" };
  }

  if (provider === "serpapi") {
    const key = getSerpApiKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return serpapiAutocompleteWithCache(input, key, signal, bias, start);
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
  const predictions = await googleAutocompletePlaces(input, key, signal);
  return { predictions, nextStart: null, source: "live" };
}

export async function getPlaceDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const result = await getPlaceDetailsResult(placeId, signal);
  return result.place;
}

/** Like getPlaceDetails but includes cache source metadata for API responses. */
export async function getPlaceDetailsResult(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceDetailsResult> {
  const provider = resolvePlacesProvider();
  if (!provider) throw new PlacesConfigError(missingPlacesConfigMessage());

  if (provider === "maptiler") {
    const key = getMapTilerServerKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    const place = await maptilerGetPlaceDetails(placeId, key, signal);
    return { place, source: "live" };
  }

  if (provider === "serpapi") {
    const key = getSerpApiKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return serpapiDetailsWithCache(placeId, key, signal);
  }

  if (!hasGoogleMapsServerKey()) {
    throw new PlacesConfigError(missingPlacesConfigMessage());
  }
  const key = process.env.GOOGLE_MAPS_API_KEY!.trim();
  const place = await googleGetPlaceDetails(placeId, key, signal);
  return { place, source: "live" };
}

export function placesServerReady(): boolean {
  return placesProviderConfigured();
}
