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

/** Prebuilt by `scripts/bundle-remotion.mjs` during `next build`. */
function resolvePrebuiltBundleDir(): string {
  const candidates = [
    path.join(process.cwd(), ".remotion"),
    path.join(process.cwd(), "apps/web/.remotion"),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  throw new RepoVideoRenderError(
    "Prebuilt Remotion bundle missing (.remotion). Rebuild with bundle:remotion.",
    500,
  );
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

async function renderOnVercelSandbox(input: {
  inputProps: RepoExplainerVideoProps;
  outPath: string;
}): Promise<void> {
  // Never import @remotion/bundler here — its native @rspack/binding is not
  // available in the Vercel Function (Bun install layout). Use the build-time
  // .remotion site and only render inside the Sandbox VM.
  const { createSandbox, addBundleToSandbox, renderMediaOnVercel } =
    await import("@remotion/vercel");

  const bundleDir = resolvePrebuiltBundleDir();

  await using sandbox = await createSandbox({
    resources: { vcpus: 4 },
  });

  const sandboxFs = sandbox as unknown as {
    mkDir?: (dirPath: string) => Promise<unknown>;
    readFileToBuffer?: (opts: { path: string }) => Promise<Buffer>;
    readFile?: (opts: { path: string }) => Promise<Buffer | Uint8Array | string>;
  };

  // @remotion/vercel mkDirs nested paths like remotion-bundle/public without
  // creating the remotion-bundle parent first — Vercel Sandbox returns 400.
  // Ensure the root exists; keep the prebuilt bundle flat (no public/) so we
  // usually never hit nested mkDir at all.
  if (typeof sandboxFs.mkDir === "function") {
    await sandboxFs.mkDir("remotion-bundle");
  }

  await addBundleToSandbox({
    sandbox,
    bundleDir,
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
  let bytes: Buffer;
  if (typeof sandboxFs.readFileToBuffer === "function") {
    bytes = await sandboxFs.readFileToBuffer({ path: filePath });
  } else if (typeof sandboxFs.readFile === "function") {
    const raw = await sandboxFs.readFile({ path: filePath });
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
      const { renderLocal } = await import("./repoVideoRenderLocal");
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
