import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** List pinned places, newest first. Used by Places `/pinned` category filter. */
export const listPinned = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("placePins").collect();
    return rows.sort((a, b) => b.pinnedAt - a.pinnedAt);
  },
});

/** Whether a place is currently pinned. */
export const isPinned = query({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    if (!placeId) return false;

    const row = await ctx.db
      .query("placePins")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();

    return row != null;
  },
});

/** Upsert a pin for a place (idempotent). */
export const pin = mutation({
  args: {
    placeId: v.string(),
    placeName: v.string(),
    formattedAddress: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    const placeName = args.placeName.trim();
    if (!placeId || !placeName) throw new Error("Place is required.");

    const existing = await ctx.db
      .query("placePins")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();

    const snapshot = {
      placeId,
      placeName,
      formattedAddress: args.formattedAddress?.trim() || undefined,
      lat: typeof args.lat === "number" && Number.isFinite(args.lat) ? args.lat : undefined,
      lng: typeof args.lng === "number" && Number.isFinite(args.lng) ? args.lng : undefined,
      pinnedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, snapshot);
      return { id: existing._id, status: "updated" as const, pinned: true };
    }

    const id = await ctx.db.insert("placePins", snapshot);
    return { id, status: "created" as const, pinned: true };
  },
});

/** Remove a pin by placeId (no-op if missing). */
export const unpin = mutation({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    if (!placeId) throw new Error("Place is required.");

    const existing = await ctx.db
      .query("placePins")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();

    if (!existing) return { status: "missing" as const, pinned: false };

    await ctx.db.delete(existing._id);
    return { status: "deleted" as const, pinned: false };
  },
});

/** Pin if unpinned, unpin if pinned. */
export const toggle = mutation({
  args: {
    placeId: v.string(),
    placeName: v.string(),
    formattedAddress: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    const placeName = args.placeName.trim();
    if (!placeId || !placeName) throw new Error("Place is required.");

    const existing = await ctx.db
      .query("placePins")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { status: "deleted" as const, pinned: false };
    }

    const id = await ctx.db.insert("placePins", {
      placeId,
      placeName,
      formattedAddress: args.formattedAddress?.trim() || undefined,
      lat: typeof args.lat === "number" && Number.isFinite(args.lat) ? args.lat : undefined,
      lng: typeof args.lng === "number" && Number.isFinite(args.lng) ? args.lng : undefined,
      pinnedAt: Date.now(),
    });

    return { id, status: "created" as const, pinned: true };
  },
});
