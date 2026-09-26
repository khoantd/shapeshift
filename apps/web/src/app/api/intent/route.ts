import { createIntentHandler } from "@shapeshift/core/server";

export const runtime = "nodejs";

export const POST = createIntentHandler({
  forceOffline: process.env.NEXT_PUBLIC_USE_MOCK === "true",
});
