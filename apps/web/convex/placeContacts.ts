import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** List contacts saved for a place, newest first. Many contacts per place are allowed. */
export const listByPlaceId = query({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    if (!placeId) return [];

    const rows = await ctx.db
      .query("placeContacts")
      .withIndex("by_placeId", (q) => q.eq("placeId", placeId))
      .collect();

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Unique places that have at least one contact, newest activity first.
 * Used by Places `/contact` category filter.
 */
export const listPlacesWithContacts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("placeContacts").collect();

    type PlaceAgg = {
      placeId: string;
      placeName: string;
      formattedAddress?: string;
      contactCount: number;
      latestAt: number;
    };

    const byPlace = new Map<string, PlaceAgg>();
    for (const row of rows) {
      const existing = byPlace.get(row.placeId);
      if (!existing) {
        byPlace.set(row.placeId, {
          placeId: row.placeId,
          placeName: row.placeName,
          formattedAddress: row.formattedAddress,
          contactCount: 1,
          latestAt: row.createdAt,
        });
        continue;
      }
      existing.contactCount += 1;
      if (row.createdAt > existing.latestAt) {
        existing.latestAt = row.createdAt;
        existing.placeName = row.placeName;
        if (row.formattedAddress) existing.formattedAddress = row.formattedAddress;
      }
    }

    return [...byPlace.values()].sort((a, b) => b.latestAt - a.latestAt);
  },
});

/**
 * Always inserts a new contact for the place (one place → many contacts).
 * Sets syncStatus to pending so the client can push to Lead Flow.
 */
export const create = mutation({
  args: {
    placeId: v.string(),
    placeName: v.string(),
    formattedAddress: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    const placeName = args.placeName.trim();
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const role = args.role?.trim() || undefined;

    if (!placeId || !placeName) throw new Error("Place is required.");
    if (!name) throw new Error("Name is required.");
    if (!EMAIL_PATTERN.test(email)) throw new Error("Please enter a valid email address.");

    const now = Date.now();
    const id = await ctx.db.insert("placeContacts", {
      placeId,
      placeName,
      formattedAddress: args.formattedAddress?.trim() || undefined,
      name,
      email,
      role,
      phone: args.phone?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { id, status: "created" as const };
  },
});

export const markSynced = mutation({
  args: {
    id: v.id("placeContacts"),
    leadFlowLeadId: v.string(),
  },
  handler: async (ctx, args) => {
    const leadFlowLeadId = args.leadFlowLeadId.trim();
    if (!leadFlowLeadId) throw new Error("Lead Flow lead id is required.");

    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Contact not found.");

    await ctx.db.patch(args.id, {
      leadFlowLeadId,
      syncStatus: "synced",
      syncError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markFailed = mutation({
  args: {
    id: v.id("placeContacts"),
    syncError: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Contact not found.");

    await ctx.db.patch(args.id, {
      syncStatus: "failed",
      syncError: args.syncError.trim().slice(0, 500) || "Sync failed",
      updatedAt: Date.now(),
    });
  },
});

export const markPending = mutation({
  args: { id: v.id("placeContacts") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Contact not found.");

    await ctx.db.patch(args.id, {
      syncStatus: "pending",
      syncError: undefined,
      updatedAt: Date.now(),
    });
  },
});
