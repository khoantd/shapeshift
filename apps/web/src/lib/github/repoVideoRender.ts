import "server-only";

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChapterNarration } from "./repoVideoTts";
import {
  COMPOSITION_ID,
  TITLE_DURATION_FRAMES,
  secondsToFrames,
} from "@/remotion/constants";
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

export class RepoVideoRenderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "RepoVideoRenderError";
    this.status = status;
  }
}

export function buildVideoInputProps(input: {
  fullName: string;
  description: string | null;
  narrations: ChapterNarration[];
  audioUrls: string[];
}): RepoExplainerVideoProps {
  return {
    fullName: input.fullName,
    description: input.description,
    titleDurationInFrames: TITLE_DURATION_FRAMES,
    chapters: input.narrations.map((n, i) => ({
      title: n.title,
      body: n.body,
      audioSrc: input.audioUrls[i] ?? "",
      durationInFrames: secondsToFrames(n.durationSeconds),
    })),
  };
}

async function renderLocal(input: {
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

async function renderOnVercelSandbox(input: {
  inputProps: RepoExplainerVideoProps;
  outPath: string;
}): Promise<void> {
  const { createSandbox, addBundleToSandbox, renderMediaOnVercel } =
    await import("@remotion/vercel");
  const { bundle } = await import("@remotion/bundler");

  const bundleLocation = await bundle({
    entryPoint: remotionEntryPoint(),
    onProgress: () => undefined,
  });

  await using sandbox = await createSandbox({
    resources: { vcpus: 4 },
  });

  await addBundleToSandbox({
    sandbox,
    bundleDir: bundleLocation,
  });

  const sandboxOut = "/tmp/repo-explainer.mp4";
  const { sandboxFilePath } = await renderMediaOnVercel({
    sandbox,
    compositionId: COMPOSITION_ID,
    inputProps: input.inputProps,
    codec: "h264",
    outputFile: sandboxOut,
  });

  const filePath = sandboxFilePath || sandboxOut;
  const sandboxAny = sandbox as unknown as {
    readFileToBuffer?: (opts: { path: string }) => Promise<Buffer>;
    readFile?: (opts: { path: string }) => Promise<Buffer | Uint8Array | string>;
  };
  let bytes: Buffer;
  if (typeof sandboxAny.readFileToBuffer === "function") {
    bytes = await sandboxAny.readFileToBuffer({ path: filePath });
  } else if (typeof sandboxAny.readFile === "function") {
    const raw = await sandboxAny.readFile({ path: filePath });
    bytes = Buffer.isBuffer(raw)
      ? raw
      : typeof raw === "string"
        ? Buffer.from(raw)
        : Buffer.from(raw);
  } else {
    throw new RepoVideoRenderError(
      "Vercel Sandbox render finished but file could not be read",
    );
  }
  await writeFile(input.outPath, bytes);
}

/**
 * Renders the Remotion RepoExplainer composition to an MP4 buffer.
 * Uses Vercel Sandbox on Vercel; local Chromium otherwise.
 */
export async function renderRepoExplainerMp4(input: {
  fullName: string;
  description: string | null;
  narrations: ChapterNarration[];
  /** http(s) URLs Remotion can fetch during render (not file://) */
  audioUrls: string[];
}): Promise<Buffer> {
  if (input.audioUrls.length !== input.narrations.length) {
    throw new RepoVideoRenderError("Audio URL count must match chapters", 500);
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "shapeshift-video-"));
  const outPath = path.join(workDir, "out.mp4");
  try {
    const inputProps = buildVideoInputProps(input);
    if (process.env.VERCEL) {
      await renderOnVercelSandbox({ inputProps, outPath });
    } else {
      await renderLocal({ inputProps, outPath });
    }
    return await readFile(outPath);
  } catch (err) {
    if (err instanceof RepoVideoRenderError) throw err;
    const message =
      err instanceof Error ? err.message : "Remotion render failed";
    throw new RepoVideoRenderError(message, 502);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

