import type { MapTilesProvider, PlacesProvider } from "./types";

export type { MapTilesProvider };

export function hasGoogleMapsServerKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export function hasMapTilerServerKey(): boolean {
  return Boolean(
    process.env.MAPTILER_API_KEY?.trim() || process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim(),
  );
}

export function hasSerpApiKey(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

export function getSerpApiKey(): string {
  return process.env.SERPAPI_API_KEY?.trim() ?? "";
}

/** Public key for MapTiler SDK map tiles (browser). Falls back to server key for local demos. */
export function getMapTilerPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ||
    process.env.MAPTILER_API_KEY?.trim() ||
    ""
  );
}

export function getMapTilerServerKey(): string {
  return (
    process.env.MAPTILER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ||
    ""
  );
}

export function getGoogleMapsPublicKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

/**
 * Map tile backend for the Places page.
 * Prefer provider-native tiles when keys exist; otherwise OpenStreetMap (no key).
 * Override with PLACES_MAP_TILES=osm|maptiler|google.
 */
export function resolveMapTilesProvider(searchProvider: PlacesProvider | null): MapTilesProvider | null {
  if (!searchProvider) return null;

  const raw = (process.env.PLACES_MAP_TILES ?? "").trim().toLowerCase();
  if (raw === "osm") return "osm";
  if (raw === "maptiler" && getMapTilerPublicKey()) return "maptiler";
  if (raw === "google" && getGoogleMapsPublicKey()) return "google";

  if (searchProvider === "maptiler" && getMapTilerPublicKey()) return "maptiler";
  if (searchProvider === "google" && getGoogleMapsPublicKey()) return "google";
  if (getMapTilerPublicKey()) return "maptiler";
  if (getGoogleMapsPublicKey()) return "google";
  return "osm";
}

/**
 * Resolve active places search provider.
 * `PLACES_PROVIDER=google|maptiler|serpapi` wins when set; otherwise prefer the first configured key.
 */
export function resolvePlacesProvider(): PlacesProvider | null {
  const raw = (process.env.PLACES_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "google") return hasGoogleMapsServerKey() ? "google" : null;
  if (raw === "maptiler") return hasMapTilerServerKey() ? "maptiler" : null;
  if (raw === "serpapi") return hasSerpApiKey() ? "serpapi" : null;

  if (hasSerpApiKey() && !hasGoogleMapsServerKey() && !hasMapTilerServerKey()) return "serpapi";
  if (hasMapTilerServerKey() && !hasGoogleMapsServerKey()) return "maptiler";
  if (hasGoogleMapsServerKey()) return "google";
  if (hasMapTilerServerKey()) return "maptiler";
  if (hasSerpApiKey()) return "serpapi";
  return null;
}

export function placesProviderConfigured(): boolean {
  return resolvePlacesProvider() !== null;
}

export function missingPlacesConfigMessage(): string {
  const raw = (process.env.PLACES_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "maptiler") {
    return "MAPTILER_API_KEY (or NEXT_PUBLIC_MAPTILER_API_KEY) is not set. Create a key at https://cloud.maptiler.com/account/keys/ and add it to apps/web/.env or the monorepo root .env.";
  }
  if (raw === "google") {
    return "GOOGLE_MAPS_API_KEY is not set. Create a key in Google Cloud (Places API New) and add it to apps/web/.env or the monorepo root .env.";
  }
  if (raw === "serpapi") {
    return "SERPAPI_API_KEY is not set. Create a key at https://serpapi.com/manage-api-key and add it to apps/web/.env or the monorepo root .env. Map tiles default to OpenStreetMap when no MapTiler/Google public key is set.";
  }
  return "No places provider configured. Set PLACES_PROVIDER to google, maptiler, or serpapi with the matching API key(s).";
}

export function providerLabel(provider: PlacesProvider): string {
  if (provider === "maptiler") return "MapTiler";
  if (provider === "serpapi") return "SerpAPI";
  return "Google";
}
