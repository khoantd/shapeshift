import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const placeReviewValidator = v.object({
  author: v.optional(v.string()),
  rating: v.optional(v.number()),
  text: v.string(),
  date: v.optional(v.string()),
});

const placeHoursValidator = v.object({
  day: v.string(),
  hours: v.string(),
});

const predictionValidator = v.object({
  placeId: v.string(),
  mainText: v.string(),
  secondaryText: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  rating: v.optional(v.number()),
  reviewCount: v.optional(v.number()),
  openState: v.optional(v.string()),
  thumbnail: v.optional(v.string()),
});

/** Load a cached autocomplete page and hydrate predictions from `places`. */
export const getSearch = query({
  args: { queryKey: v.string() },
  handler: async (ctx, args) => {
    const queryKey = args.queryKey.trim();
    if (!queryKey) return null;

    const search = await ctx.db
      .query("placeSearches")
      .withIndex("by_queryKey", (q) => q.eq("queryKey", queryKey))
      .first();

    if (!search) return null;

    const predictions = [];
    for (const placeId of search.placeIds) {
      const row = await ctx.db
        .query("places")
        .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
        .first();
      if (!row) continue;
      predictions.push({
        placeId: row.placeId,
        mainText: row.mainText,
        secondaryText: row.secondaryText,
        lat: row.lat,
        lng: row.lng,
        rating: row.rating,
        reviewCount: row.reviewCount,
        openState: row.openState,
        thumbnail: row.thumbnail,
      });
    }

    return {
      queryKey: search.queryKey,
      placeIds: search.placeIds,
      nextStart: search.nextStart ?? null,
      fetchedAt: search.fetchedAt,
      predictions,
    };
  },
});

/** Upsert prediction rows + autocomplete page for a queryKey. */
export const upsertSearch = mutation({
  args: {
    queryKey: v.string(),
    query: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    start: v.number(),
    nextStart: v.optional(v.number()),
    predictions: v.array(predictionValidator),
  },
  handler: async (ctx, args) => {
    const queryKey = args.queryKey.trim();
    const query = args.query.trim();
    if (!queryKey || !query) throw new Error("Query is required.");

    const now = Date.now();
    const placeIds: string[] = [];

    for (const prediction of args.predictions) {
      const placeId = prediction.placeId.trim();
      const mainText = prediction.mainText.trim();
      if (!placeId || !mainText) continue;

      placeIds.push(placeId);

      const existing = await ctx.db
        .query("places")
        .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
        .first();

      const patch = {
        placeId,
        mainText,
        secondaryText: prediction.secondaryText?.trim() || undefined,
        lat:
          typeof prediction.lat === "number" && Number.isFinite(prediction.lat)
            ? prediction.lat
            : undefined,
        lng:
          typeof prediction.lng === "number" && Number.isFinite(prediction.lng)
            ? prediction.lng
            : undefined,
        rating: typeof prediction.rating === "number" ? prediction.rating : undefined,
        reviewCount:
          typeof prediction.reviewCount === "number" ? prediction.reviewCount : undefined,
        openState: prediction.openState?.trim() || undefined,
        thumbnail: prediction.thumbnail,
        provider: "serpapi" as const,
        fetchedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...patch,
          // Preserve details if already loaded.
          hasDetails: existing.hasDetails,
          detailsFetchedAt: existing.detailsFetchedAt,
          formattedAddress: existing.formattedAddress,
          types: existing.types,
          mapsUri: existing.mapsUri,
          website: existing.website,
          phone: existing.phone,
          reviews: existing.reviews,
          images: existing.images,
          hours: existing.hours,
        });
      } else {
        await ctx.db.insert("places", {
          ...patch,
          hasDetails: false,
        });
      }
    }

    const existingSearch = await ctx.db
      .query("placeSearches")
      .withIndex("by_queryKey", (q) => q.eq("queryKey", queryKey))
      .first();

    const searchRow = {
      queryKey,
      query,
      lat: typeof args.lat === "number" && Number.isFinite(args.lat) ? args.lat : undefined,
      lng: typeof args.lng === "number" && Number.isFinite(args.lng) ? args.lng : undefined,
      start: args.start,
      placeIds,
      nextStart:
        typeof args.nextStart === "number" && Number.isFinite(args.nextStart)
          ? args.nextStart
          : undefined,
      fetchedAt: now,
      provider: "serpapi" as const,
    };

    if (existingSearch) {
      await ctx.db.patch(existingSearch._id, searchRow);
      return { status: "updated" as const, placeCount: placeIds.length };
    }

    await ctx.db.insert("placeSearches", searchRow);
    return { status: "created" as const, placeCount: placeIds.length };
  },
});

/** Load a single cached place by placeId. */
export const getPlace = query({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    if (!placeId) return null;

    return await ctx.db
      .query("places")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();
  },
});

/** Upsert full place details onto the places row. */
export const upsertPlaceDetails = mutation({
  args: {
    placeId: v.string(),
    mainText: v.string(),
    secondaryText: v.optional(v.string()),
    formattedAddress: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    types: v.optional(v.array(v.string())),
    mapsUri: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    reviews: v.optional(v.array(placeReviewValidator)),
    images: v.optional(v.array(v.string())),
    openState: v.optional(v.string()),
    hours: v.optional(v.array(placeHoursValidator)),
    thumbnail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    const mainText = args.mainText.trim();
    if (!placeId || !mainText) throw new Error("Place is required.");
    if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) {
      throw new Error("Coordinates are required.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("places")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();

    const row = {
      placeId,
      mainText,
      secondaryText: args.secondaryText?.trim() || args.formattedAddress?.trim() || undefined,
      formattedAddress: args.formattedAddress?.trim() || undefined,
      lat: args.lat,
      lng: args.lng,
      types: args.types,
      mapsUri: args.mapsUri,
      website: args.website,
      phone: args.phone?.trim() || undefined,
      rating: typeof args.rating === "number" ? args.rating : undefined,
      reviewCount: typeof args.reviewCount === "number" ? args.reviewCount : undefined,
      reviews: args.reviews,
      images: args.images,
      openState: args.openState?.trim() || undefined,
      hours: args.hours,
      thumbnail: args.thumbnail ?? existing?.thumbnail,
      hasDetails: true,
      provider: "serpapi" as const,
      fetchedAt: existing?.fetchedAt ?? now,
      detailsFetchedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { status: "updated" as const };
    }

    await ctx.db.insert("places", row);
    return { status: "created" as const };
  },
});
