import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Join the waitlist. Idempotent: the same email always maps to the same spot. */
export const joinWaitlist = mutation({
  args: {
    email: v.string(),
    referral: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      const total = (await ctx.db.query("waitlist").collect()).length;
      return { status: "already_joined" as const, position: existing.position, total };
    }

    const total = (await ctx.db.query("waitlist").collect()).length;
    const position = total + 1;

    await ctx.db.insert("waitlist", {
      email,
      position,
      joinedAt: Date.now(),
      referral: args.referral,
    });

    return { status: "joined" as const, position, total };
  },
});

/** Public count for the landing page social-proof line. */
export const waitlistCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("waitlist").collect();
    return all.length;
  },
});
