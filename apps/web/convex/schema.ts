import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  waitlist: defineTable({
    email: v.string(),
    position: v.number(),
    joinedAt: v.number(),
    referral: v.optional(v.string()),
  }).index("by_email", ["email"]),

  /** Person contacts attached to a Places result; synced to Lead Flow. */
  placeContacts: defineTable({
    placeId: v.string(),
    placeName: v.string(),
    formattedAddress: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    leadFlowLeadId: v.optional(v.string()),
    syncStatus: v.union(v.literal("pending"), v.literal("synced"), v.literal("failed")),
    syncError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_placeId", ["placeId"])
    .index("by_placeId_email", ["placeId", "email"]),
});

export default schema;
