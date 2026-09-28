import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const syncStatus = v.union(v.literal("pending"), v.literal("synced"), v.literal("failed"));

/** List contacts saved for a place, newest first. */
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
 * Create or refresh a contact for a place (keyed by placeId + email).
 * Always sets syncStatus to pending so the client can push to Lead Flow.
 */
export const create = mutation({
  args: {
    placeId: v.string(),
    placeName: v.string(),
    formattedAddress: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const placeId = args.placeId.trim();
    const placeName = args.placeName.trim();
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();

    if (!placeId || !placeName) throw new Error("Place is required.");
    if (!name) throw new Error("Name is required.");
    if (!EMAIL_PATTERN.test(email)) throw new Error("Please enter a valid email address.");

    const now = Date.now();
    const existing = await ctx.db
      .query("placeContacts")
      .withIndex("by_placeId_email", (q) => q.eq("placeId", placeId).eq("email", email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        placeName,
        formattedAddress: args.formattedAddress?.trim() || undefined,
        name,
        phone: args.phone?.trim() || undefined,
        notes: args.notes?.trim() || undefined,
        syncStatus: "pending",
        syncError: undefined,
        leadFlowLeadId: undefined,
        updatedAt: now,
      });
      return { id: existing._id, status: "updated" as const };
    }

    const id = await ctx.db.insert("placeContacts", {
      placeId,
      placeName,
      formattedAddress: args.formattedAddress?.trim() || undefined,
      name,
      email,
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
