import { createNewsLinkSuggestHandler } from "@shapeshift/core/server";

export const runtime = "nodejs";

export const POST = createNewsLinkSuggestHandler({
  forceOffline: process.env.NEXT_PUBLIC_USE_MOCK === "true",
});
