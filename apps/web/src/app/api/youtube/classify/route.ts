import { createVideoClassifyHandler } from "@shapeshift/core/server";

export const runtime = "nodejs";

export const POST = createVideoClassifyHandler({
  forceOffline: process.env.NEXT_PUBLIC_USE_MOCK === "true",
});
