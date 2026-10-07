import { createVideoStudyGateHandler } from "@shapeshift/core/server";

export const runtime = "nodejs";

export const POST = createVideoStudyGateHandler({
  forceOffline: process.env.NEXT_PUBLIC_USE_MOCK === "true",
});
