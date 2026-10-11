import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { COMPOSITION_ID } from "@/remotion/constants";
import type { RepoExplainerVideoProps } from "@/remotion/types";

function remotionEntryPoint(): string {
  const candidates = [
    path.join(process.cwd(), "src/remotion/index.ts"),
    path.join(process.cwd(), "apps/web/src/remotion/index.ts"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

/** Local-only Remotion render (Chromium). Not imported on Vercel. */
export async function renderLocal(input: {
  inputProps: RepoExplainerVideoProps;
  outPath: string;
}): Promise<void> {
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const bundleLocation = await bundle({
    entryPoint: remotionEntryPoint(),
    onProgress: () => undefined,
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: COMPOSITION_ID,
    inputProps: input.inputProps,
  });

  const chrome =
    process.env.REMOTION_CHROME_EXECUTABLE?.trim() ||
    process.env.VIDEO_RENDER_CHROME_PATH?.trim() ||
    undefined;

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: input.outPath,
    inputProps: input.inputProps,
    chromiumOptions: { gl: "angle" },
    ...(chrome ? { browserExecutable: chrome } : {}),
  });
}
