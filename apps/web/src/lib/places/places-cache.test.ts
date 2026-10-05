import { describe, expect, test } from "bun:test";
import {
  buildPlaceSearchCacheKey,
  isCacheFresh,
  PLACE_DETAILS_TTL_MS,
  PLACE_SEARCH_TTL_MS,
  placeDetailsFromPlaceRow,
  predictionFromPlaceRow,
  predictionToCacheFields,
  type CachedPlaceRow,
} from "./places-cache";

describe("buildPlaceSearchCacheKey", () => {
  test("normalizes query case and trims", () => {
    expect(buildPlaceSearchCacheKey("  Coffee  ", null, 0)).toBe("coffee|,|0");
  });

  test("rounds bias to 3 decimals", () => {
    expect(
      buildPlaceSearchCacheKey("cafe", { lat: 10.812345, lng: 106.678901 }, 0),
    ).toBe("cafe|10.812,106.679|0");
  });

  test("includes pagination start", () => {
    expect(buildPlaceSearchCacheKey("cafe", null, 20)).toBe("cafe|,|20");
  });
});

describe("isCacheFresh", () => {
  test("returns true within TTL", () => {
    const now = 1_000_000;
    expect(isCacheFresh(now - 1000, PLACE_SEARCH_TTL_MS, now)).toBe(true);
  });

  test("returns false when expired", () => {
    const now = 1_000_000;
    expect(isCacheFresh(now - PLACE_SEARCH_TTL_MS - 1, PLACE_SEARCH_TTL_MS, now)).toBe(
      false,
    );
  });

  test("rejects invalid timestamps", () => {
    expect(isCacheFresh(0, PLACE_DETAILS_TTL_MS)).toBe(false);
    expect(isCacheFresh(Date.now(), 0)).toBe(false);
  });
});

describe("predictionFromPlaceRow / predictionToCacheFields", () => {
  test("round-trips prediction fields", () => {
    const prediction = {
      placeId: "ChIJ123",
      mainText: "Cafe A",
      secondaryText: "HCMC",
      lat: 10.8,
      lng: 106.7,
      rating: 4.5,
      reviewCount: 12,
      openState: "Open",
      thumbnail: "https://example.com/t.jpg",
    };
    const fields = predictionToCacheFields(prediction);
    const row: CachedPlaceRow = {
      ...fields,
      hasDetails: false,
      fetchedAt: Date.now(),
    };
    expect(predictionFromPlaceRow(row)).toEqual(prediction);
  });
});

describe("placeDetailsFromPlaceRow", () => {
  test("returns null when hasDetails is false", () => {
    expect(
      placeDetailsFromPlaceRow({
        placeId: "a",
        mainText: "Cafe",
        lat: 1,
        lng: 2,
        hasDetails: false,
        fetchedAt: Date.now(),
      }),
    ).toBeNull();
  });

  test("maps details when complete", () => {
    const details = placeDetailsFromPlaceRow({
      placeId: "a",
      mainText: "Cafe",
      secondaryText: "Addr",
      lat: 1,
      lng: 2,
      hasDetails: true,
      fetchedAt: Date.now(),
      detailsFetchedAt: Date.now(),
      phone: "+1",
      types: ["cafe"],
    });
    expect(details).toMatchObject({
      placeId: "a",
      name: "Cafe",
      formattedAddress: "Addr",
      lat: 1,
      lng: 2,
      phone: "+1",
      types: ["cafe"],
    });
  });
});
