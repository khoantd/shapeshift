import { describe, expect, test } from "bun:test";
import {
  hasGoogleMapsServerKey,
  hasMapTilerServerKey,
  hasSerpApiKey,
  resolveMapTilesProvider,
  resolvePlacesProvider,
} from "./config";

function withEnv(
  patch: Record<string, string | undefined>,
  run: () => void,
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next == null) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("resolvePlacesProvider", () => {
  test("returns null when no keys and no provider env", () => {
    withEnv(
      {
        PLACES_PROVIDER: undefined,
        GOOGLE_MAPS_API_KEY: undefined,
        MAPTILER_API_KEY: undefined,
        NEXT_PUBLIC_MAPTILER_API_KEY: undefined,
        SERPAPI_API_KEY: undefined,
      },
      () => {
        expect(resolvePlacesProvider()).toBeNull();
        expect(hasGoogleMapsServerKey()).toBe(false);
        expect(hasMapTilerServerKey()).toBe(false);
        expect(hasSerpApiKey()).toBe(false);
      },
    );
  });

  test("honors PLACES_PROVIDER=maptiler when key present", () => {
    withEnv(
      {
        PLACES_PROVIDER: "maptiler",
        MAPTILER_API_KEY: "mt_test_key",
        GOOGLE_MAPS_API_KEY: undefined,
        SERPAPI_API_KEY: undefined,
      },
      () => expect(resolvePlacesProvider()).toBe("maptiler"),
    );
  });

  test("honors PLACES_PROVIDER=google when key present", () => {
    withEnv(
      {
        PLACES_PROVIDER: "google",
        GOOGLE_MAPS_API_KEY: "g_test_key",
        MAPTILER_API_KEY: undefined,
        SERPAPI_API_KEY: undefined,
      },
      () => expect(resolvePlacesProvider()).toBe("google"),
    );
  });

  test("honors PLACES_PROVIDER=serpapi when key present", () => {
    withEnv(
      {
        PLACES_PROVIDER: "serpapi",
        SERPAPI_API_KEY: "serp_test_key",
        GOOGLE_MAPS_API_KEY: undefined,
        MAPTILER_API_KEY: undefined,
      },
      () => expect(resolvePlacesProvider()).toBe("serpapi"),
    );
  });

  test("auto-selects serpapi when only SERPAPI_API_KEY is set", () => {
    withEnv(
      {
        PLACES_PROVIDER: undefined,
        SERPAPI_API_KEY: "serp_only",
        GOOGLE_MAPS_API_KEY: undefined,
        MAPTILER_API_KEY: undefined,
        NEXT_PUBLIC_MAPTILER_API_KEY: undefined,
      },
      () => expect(resolvePlacesProvider()).toBe("serpapi"),
    );
  });
});

describe("resolveMapTilesProvider", () => {
  test("falls back to osm when no tile keys", () => {
    withEnv(
      {
        PLACES_MAP_TILES: undefined,
        NEXT_PUBLIC_MAPTILER_API_KEY: undefined,
        MAPTILER_API_KEY: undefined,
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: undefined,
      },
      () => expect(resolveMapTilesProvider("serpapi")).toBe("osm"),
    );
  });

  test("honors PLACES_MAP_TILES=osm", () => {
    withEnv(
      {
        PLACES_MAP_TILES: "osm",
        NEXT_PUBLIC_MAPTILER_API_KEY: "mt_public",
      },
      () => expect(resolveMapTilesProvider("maptiler")).toBe("osm"),
    );
  });
});
