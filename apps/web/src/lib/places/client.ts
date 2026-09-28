import "server-only";

import {
  getMapTilerServerKey,
  getSerpApiKey,
  hasGoogleMapsServerKey,
  missingPlacesConfigMessage,
  placesProviderConfigured,
  resolvePlacesProvider,
} from "./config";
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

export async function autocompletePlaces(
  input: string,
  signal?: AbortSignal,
  bias?: PlacesLocationBias | null,
): Promise<PlacePrediction[]> {
  const provider = resolvePlacesProvider();
  if (!provider) throw new PlacesConfigError(missingPlacesConfigMessage());

  if (provider === "maptiler") {
    const key = getMapTilerServerKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return maptilerAutocompletePlaces(input, key, signal);
  }

  if (provider === "serpapi") {
    const key = getSerpApiKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return serpapiAutocompletePlaces(input, key, signal, bias);
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
  return googleAutocompletePlaces(input, key, signal);
}

export async function getPlaceDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const provider = resolvePlacesProvider();
  if (!provider) throw new PlacesConfigError(missingPlacesConfigMessage());

  if (provider === "maptiler") {
    const key = getMapTilerServerKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return maptilerGetPlaceDetails(placeId, key, signal);
  }

  if (provider === "serpapi") {
    const key = getSerpApiKey();
    if (!key) throw new PlacesConfigError(missingPlacesConfigMessage());
    return serpapiGetPlaceDetails(placeId, key, signal);
  }

  if (!hasGoogleMapsServerKey()) {
    throw new PlacesConfigError(missingPlacesConfigMessage());
  }
  const key = process.env.GOOGLE_MAPS_API_KEY!.trim();
  return googleGetPlaceDetails(placeId, key, signal);
}

export function placesServerReady(): boolean {
  return placesProviderConfigured();
}
