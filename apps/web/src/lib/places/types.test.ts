import { describe, expect, test } from "bun:test";
import {
  parseAutocompleteQuery,
  parsePlaceIdParam,
  placeDetailsSchema,
  placePredictionSchema,
  sanitizeHttpsUrl,
} from "./types";
import {
  extractImageUrls,
  normalizeHours,
  normalizeReviews,
  normalizeTypes,
} from "./serpapi-normalize";

describe("parseAutocompleteQuery", () => {
  test("returns null for short or empty input", () => {
    expect(parseAutocompleteQuery(null)).toBeNull();
    expect(parseAutocompleteQuery("")).toBeNull();
    expect(parseAutocompleteQuery(" ")).toBeNull();
    expect(parseAutocompleteQuery("a")).toBeNull();
  });

  test("trims and accepts queries of length >= 2", () => {
    expect(parseAutocompleteQuery("  ab  ")).toBe("ab");
    expect(parseAutocompleteQuery("coffee near me")).toBe("coffee near me");
  });

  test("clamps to 200 characters", () => {
    const long = "x".repeat(250);
    expect(parseAutocompleteQuery(long)?.length).toBe(200);
  });
});

describe("parsePlaceIdParam", () => {
  test("rejects empty or invalid ids", () => {
    expect(parsePlaceIdParam(null)).toBeNull();
    expect(parsePlaceIdParam("")).toBeNull();
    expect(parsePlaceIdParam("bad id")).toBeNull();
    expect(parsePlaceIdParam("id/with/slash")).toBeNull();
  });

  test("accepts typical Google place ids", () => {
    expect(parsePlaceIdParam("ChIJj61dQgK6j4AR4GeTYWZsKWw")).toBe(
      "ChIJj61dQgK6j4AR4GeTYWZsKWw",
    );
  });

  test("accepts MapTiler feature ids with dots", () => {
    expect(parsePlaceIdParam("poi.1234567890")).toBe("poi.1234567890");
    expect(parsePlaceIdParam("address.1486604315488362")).toBe("address.1486604315488362");
  });
});

describe("place schemas", () => {
  test("prediction schema requires mainText and placeId", () => {
    expect(
      placePredictionSchema.safeParse({
        placeId: "ChIJ123",
        mainText: "Cafe",
        secondaryText: "SF",
      }).success,
    ).toBe(true);
    expect(placePredictionSchema.safeParse({ placeId: "x" }).success).toBe(false);
  });

  test("prediction schema accepts optional lat/lng and list extras", () => {
    expect(
      placePredictionSchema.safeParse({
        placeId: "ChIJ123",
        mainText: "Cafe",
        lat: 21.03,
        lng: 105.85,
        rating: 4.5,
        reviewCount: 120,
        openState: "Open",
        thumbnail: "https://example.com/t.jpg",
      }).success,
    ).toBe(true);
  });

  test("details schema rejects nested types arrays", () => {
    expect(
      placeDetailsSchema.safeParse({
        placeId: "ChIJ123",
        name: "Cafe",
        lat: 21,
        lng: 105,
        types: [["Coffee shop"]],
      }).success,
    ).toBe(false);
  });

  test("details schema accepts rich SerpAPI fields", () => {
    const ok = placeDetailsSchema.safeParse({
      placeId: "ChIJ123",
      name: "Cafe",
      formattedAddress: "1 Main St",
      lat: 37.7,
      lng: -122.4,
      types: ["cafe"],
      mapsUri: "https://maps.google.com/?cid=1",
      website: "https://cafe.example",
      phone: "+1 415-555-0100",
      rating: 4.6,
      reviewCount: 88,
      reviews: [{ author: "A", rating: 5, text: "Great coffee", date: "2 weeks ago" }],
      images: ["https://example.com/a.jpg"],
      openState: "Open ⋅ Closes 10 PM",
      hours: [{ day: "Monday", hours: "8 AM–10 PM" }],
    });
    expect(ok.success).toBe(true);
  });

  test("details schema requires lat/lng and name", () => {
    expect(
      placeDetailsSchema.safeParse({
        placeId: "ChIJ123",
        name: "Cafe",
        lat: Number.NaN,
        lng: -122.4,
      }).success,
    ).toBe(false);
  });

  test("sanitizeHttpsUrl rejects non-https", () => {
    expect(sanitizeHttpsUrl("http://insecure.example")).toBeUndefined();
    expect(sanitizeHttpsUrl("https://ok.example/x")).toBe("https://ok.example/x");
  });
});

describe("serpapi normalize helpers", () => {
  test("normalizeTypes flattens string type arrays", () => {
    expect(normalizeTypes(undefined, ["Coffee shop", "Bar"])).toEqual([
      "Coffee shop",
      "Bar",
    ]);
    expect(normalizeTypes(undefined, "Cafe")).toEqual(["Cafe"]);
  });

  test("extractImageUrls prefers original and caps at 4", () => {
    const urls = extractImageUrls([
      { thumbnail: "https://a.example/t.jpg", original: "https://a.example/o.jpg" },
      "https://b.example/b.jpg",
      { thumbnail: "http://bad.example/t.jpg" },
      "https://c.example/c.jpg",
      "https://d.example/d.jpg",
      "https://e.example/e.jpg",
    ]);
    expect(urls).toEqual([
      "https://a.example/o.jpg",
      "https://b.example/b.jpg",
      "https://c.example/c.jpg",
      "https://d.example/d.jpg",
    ]);
  });

  test("normalizeHours accepts day/hours rows", () => {
    expect(
      normalizeHours([
        { day: "Monday", hours: "9–5" },
        { day: "Tuesday", hours: "Closed" },
      ]),
    ).toEqual([
      { day: "Monday", hours: "9–5" },
      { day: "Tuesday", hours: "Closed" },
    ]);
  });

  test("normalizeReviews caps at 3 with text", () => {
    const reviews = normalizeReviews([
      { username: "a", rating: 5, description: "Great" },
      { username: "b", snippet: "Nice" },
      { username: "c", description: "Ok" },
      { username: "d", description: "Skip" },
      { username: "e", description: "" },
    ]);
    expect(reviews).toHaveLength(3);
    expect(reviews?.[0]?.text).toBe("Great");
  });

  test("normalizeReviews reads most_relevant object shape", () => {
    const reviews = normalizeReviews({
      most_relevant: [{ username: "x", description: "Hidden gem" }],
    });
    expect(reviews).toEqual([{ author: "x", text: "Hidden gem", rating: undefined, date: undefined }]);
  });
});
