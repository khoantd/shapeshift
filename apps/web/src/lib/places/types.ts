import { z } from "zod";

export const placesProviderSchema = z.enum(["google", "maptiler", "serpapi"]);
export type PlacesProvider = z.infer<typeof placesProviderSchema>;

export const mapTilesProviderSchema = z.enum(["google", "maptiler", "osm"]);
export type MapTilesProvider = z.infer<typeof mapTilesProviderSchema>;

const httpsUrlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "Must be https" });

export const placeReviewSchema = z.object({
  author: z.string().max(200).optional(),
  rating: z.number().min(0).max(5).optional(),
  text: z.string().min(1).max(2000),
  date: z.string().max(100).optional(),
});

export const placeHoursRowSchema = z.object({
  day: z.string().min(1).max(40),
  hours: z.string().min(1).max(120),
});

export const placePredictionSchema = z.object({
  placeId: z.string().min(1).max(256),
  mainText: z.string().min(1).max(500),
  secondaryText: z.string().max(500).optional(),
  /** Present when the search provider already returned coordinates (e.g. SerpAPI locals). */
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  openState: z.string().max(200).optional(),
  thumbnail: httpsUrlSchema.optional(),
});

export const placeDetailsSchema = z.object({
  placeId: z.string().min(1).max(256),
  name: z.string().min(1).max(500),
  formattedAddress: z.string().max(1000).optional(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  types: z.array(z.string().max(100)).max(50).optional(),
  /** External maps link (Google Maps, MapTiler, OSM, etc.). */
  mapsUri: z.string().url().optional(),
  website: httpsUrlSchema.optional(),
  phone: z.string().max(40).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  reviews: z.array(placeReviewSchema).max(3).optional(),
  images: z.array(httpsUrlSchema).max(4).optional(),
  openState: z.string().max(200).optional(),
  hours: z.array(placeHoursRowSchema).max(7).optional(),
});

export type PlacePrediction = z.infer<typeof placePredictionSchema>;
export type PlaceDetails = z.infer<typeof placeDetailsSchema>;
export type PlaceReview = z.infer<typeof placeReviewSchema>;
export type PlaceHoursRow = z.infer<typeof placeHoursRowSchema>;

export const autocompleteResponseSchema = z.object({
  success: z.literal(true),
  predictions: z.array(placePredictionSchema),
});

export const placeDetailsResponseSchema = z.object({
  success: z.literal(true),
  place: placeDetailsSchema,
});

/** Clamp and validate autocomplete query. Returns null when too short. */
export function parseAutocompleteQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim().slice(0, 200);
  if (q.length < 2) return null;
  return q;
}

/**
 * Validate placeId query param.
 * Google place ids are typically `[A-Za-z0-9_-]+`; MapTiler feature ids often include dots (`poi.123`).
 */
export function parsePlaceIdParam(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim().slice(0, 256);
  if (!id || !/^[\w.-]+$/.test(id)) return null;
  return id;
}

/** Keep only https URLs; used by SerpAPI image/thumbnail mapping. */
export function sanitizeHttpsUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("https://")) return undefined;
  const parsed = httpsUrlSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : undefined;
}
