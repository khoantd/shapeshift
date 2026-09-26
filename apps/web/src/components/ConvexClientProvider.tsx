"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const client = useMemo(() => (url ? new ConvexReactClient(url) : null), [url]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export function isConvexConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL?.trim());
}
