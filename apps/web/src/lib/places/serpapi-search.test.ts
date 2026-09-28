import { describe, expect, test } from "bun:test";
import {
  buildSerpMapsSearchLocationParams,
  isAddressLikePlacesQuery,
  MAX_PREDICTIONS,
  nextSerpStart,
  predictionsFromSerpMapsBody,
  rankSerpPredictionsForAutocomplete,
  SERP_NEARBY_MAP_HEIGHT_M,
  shouldApplySerpLocationBias,
  sortPredictionsByDistance,
} from "./serpapi-search";
import type { PlacePrediction } from "./types";

describe("isAddressLikePlacesQuery", () => {
  test("treats comma-separated text as an address", () => {
    expect(
      isAddressLikePlacesQuery("Nhất, Phường 16, Gò Vấp, Hồ Chí Minh"),
    ).toBe(true);
  });

  test("treats long queries as address-like", () => {
    expect(isAddressLikePlacesQuery("x".repeat(40))).toBe(true);
    expect(isAddressLikePlacesQuery("x".repeat(39))).toBe(false);
  });

  test("keeps short shop queries as not address-like", () => {
    expect(isAddressLikePlacesQuery("coffee")).toBe(false);
    expect(isAddressLikePlacesQuery("pizza near me")).toBe(false);
  });
});

describe("shouldApplySerpLocationBias", () => {
  const bias = { lat: 10.8, lng: 106.7 };

  test("applies bias for short shop queries", () => {
    expect(shouldApplySerpLocationBias("coffee", bias)).toBe(true);
  });

  test("skips bias for address-like queries", () => {
    expect(
      shouldApplySerpLocationBias("Nhất, Phường 16, Gò Vấp, Hồ Chí Minh", bias),
    ).toBe(false);
  });

  test("skips bias when coordinates are missing or invalid", () => {
    expect(shouldApplySerpLocationBias("coffee", null)).toBe(false);
    expect(shouldApplySerpLocationBias("coffee", { lat: NaN, lng: 1 })).toBe(
      false,
    );
    expect(shouldApplySerpLocationBias("coffee", { lat: 100, lng: 1 })).toBe(
      false,
    );
  });
});

describe("buildSerpMapsSearchLocationParams", () => {
  const bias = { lat: 10.823, lng: 106.629 };

  test("returns meter ll and nearby when bias applies", () => {
    expect(buildSerpMapsSearchLocationParams("Highlands Coffee", bias)).toEqual({
      ll: `@10.823,106.629,${SERP_NEARBY_MAP_HEIGHT_M}m`,
      nearby: "true",
    });
  });

  test("returns null for address-like queries", () => {
    expect(
      buildSerpMapsSearchLocationParams(
        "Nhất, Phường 16, Gò Vấp, Hồ Chí Minh",
        bias,
      ),
    ).toBeNull();
  });

  test("returns null without bias", () => {
    expect(buildSerpMapsSearchLocationParams("coffee", null)).toBeNull();
  });
});

describe("predictionsFromSerpMapsBody", () => {
  test("returns place_results when local_results is empty (address search)", () => {
    const predictions = predictionsFromSerpMapsBody({
      place_results: {
        place_id: "ChIJ_place_ward",
        title: "Phường 16",
        address: "Gò Vấp, Hồ Chí Minh, Vietnam",
        gps_coordinates: { latitude: 10.846, longitude: 106.667 },
      },
    });

    expect(predictions).toHaveLength(1);
    expect(predictions[0]).toMatchObject({
      placeId: "ChIJ_place_ward",
      mainText: "Phường 16",
      secondaryText: "Gò Vấp, Hồ Chí Minh, Vietnam",
      lat: 10.846,
      lng: 106.667,
    });
  });

  test("prepends place_results and dedupes overlapping local_results", () => {
    const predictions = predictionsFromSerpMapsBody({
      place_results: {
        place_id: "ChIJ_same",
        title: "Blue Bottle",
        address: "San Francisco",
        gps_coordinates: { latitude: 37.78, longitude: -122.4 },
      },
      local_results: [
        {
          place_id: "ChIJ_same",
          title: "Blue Bottle",
          address: "San Francisco",
          gps_coordinates: { latitude: 37.78, longitude: -122.4 },
        },
        {
          place_id: "ChIJ_other",
          title: "Other Cafe",
          address: "Nearby",
          gps_coordinates: { latitude: 37.79, longitude: -122.41 },
        },
      ],
    });

    expect(predictions.map((p) => p.placeId)).toEqual([
      "ChIJ_same",
      "ChIJ_other",
    ]);
  });

  test("returns empty array when both result shapes are missing", () => {
    expect(predictionsFromSerpMapsBody({})).toEqual([]);
    expect(predictionsFromSerpMapsBody({ local_results: [] })).toEqual([]);
  });

  test("ingests up to 20 combined predictions (one SerpAPI page)", () => {
    const local_results = Array.from({ length: 25 }, (_, i) => ({
      place_id: `ChIJ_${i}`,
      title: `Shop ${i}`,
      address: `Addr ${i}`,
      gps_coordinates: { latitude: 1 + i * 0.01, longitude: 2 },
    }));
    const predictions = predictionsFromSerpMapsBody({
      place_results: {
        place_id: "ChIJ_place",
        title: "Named Place",
        address: "Somewhere",
        gps_coordinates: { latitude: 0, longitude: 0 },
      },
      local_results,
    });
    expect(predictions).toHaveLength(20);
    expect(predictions[0]?.placeId).toBe("ChIJ_place");
  });
});

describe("sortPredictionsByDistance", () => {
  const bias = { lat: 10.8, lng: 106.7 };

  function pred(
    placeId: string,
    lat?: number,
    lng?: number,
  ): PlacePrediction {
    return {
      placeId,
      mainText: placeId,
      ...(lat != null && lng != null ? { lat, lng } : {}),
    };
  }

  test("orders nearer predictions first", () => {
    const far = pred("far", 10.9, 106.8);
    const near = pred("near", 10.801, 106.701);
    const mid = pred("mid", 10.85, 106.75);
    const sorted = sortPredictionsByDistance([far, near, mid], bias);
    expect(sorted.map((p) => p.placeId)).toEqual(["near", "mid", "far"]);
  });

  test("keeps predictions without coords at the end", () => {
    const noCoords = pred("no-gps");
    const near = pred("near", 10.801, 106.701);
    const sorted = sortPredictionsByDistance([noCoords, near], bias);
    expect(sorted.map((p) => p.placeId)).toEqual(["near", "no-gps"]);
  });

  test("returns original order when bias is missing", () => {
    const a = pred("a", 1, 1);
    const b = pred("b", 2, 2);
    expect(sortPredictionsByDistance([a, b], null)).toEqual([a, b]);
  });
});

describe("rankSerpPredictionsForAutocomplete", () => {
  const bias = { lat: 10.8, lng: 106.7 };

  test("promotes a nearer place that was past Google's top 8", () => {
    const local_results = [
      ...Array.from({ length: 12 }, (_, i) => ({
        place_id: `ChIJ_far_${i}`,
        title: `Far Shop ${i}`,
        address: `Far ${i}`,
        gps_coordinates: { latitude: 10.95, longitude: 106.85 },
      })),
      {
        place_id: "ChIJ_thong_that",
        title: "Highlands Coffee",
        address: "288 Đường Thống Thất",
        gps_coordinates: { latitude: 10.801, longitude: 106.701 },
      },
    ];

    const page = rankSerpPredictionsForAutocomplete({ local_results }, bias);

    expect(page.predictions[0]?.placeId).toBe("ChIJ_thong_that");
    expect(page.predictions[0]?.secondaryText).toContain("Thống Thất");
    expect(page.nextStart).toBeNull();
  });

  test("sets nextStart when a full page is returned", () => {
    const local_results = Array.from({ length: 20 }, (_, i) => ({
      place_id: `ChIJ_${i}`,
      title: `Shop ${i}`,
      address: `Addr ${i}`,
      gps_coordinates: { latitude: 1 + i * 0.01, longitude: 2 },
    }));
    const page = rankSerpPredictionsForAutocomplete({ local_results }, null, 0);
    expect(page.predictions).toHaveLength(MAX_PREDICTIONS);
    expect(page.nextStart).toBe(20);
  });

  test("returns fewer results without nextStart", () => {
    const local_results = Array.from({ length: 5 }, (_, i) => ({
      place_id: `ChIJ_${i}`,
      title: `Shop ${i}`,
      address: `Addr ${i}`,
      gps_coordinates: { latitude: 1 + i * 0.01, longitude: 2 },
    }));
    const page = rankSerpPredictionsForAutocomplete({ local_results }, null);
    expect(page.predictions).toHaveLength(5);
    expect(page.nextStart).toBeNull();
  });
});

describe("nextSerpStart", () => {
  test("advances by page size when full", () => {
    expect(nextSerpStart(0, 20)).toBe(20);
    expect(nextSerpStart(20, 20)).toBe(40);
  });

  test("returns null when short page", () => {
    expect(nextSerpStart(0, 8)).toBeNull();
  });
});
