import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  waitlist: defineTable({
    email: v.string(),
    position: v.number(),
    joinedAt: v.number(),
    referral: v.optional(v.string()),
  }).index("by_email", ["email"]),
});

export default schema;
