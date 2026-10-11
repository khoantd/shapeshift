/**
 * Build-time Remotion site bundle for Vercel Sandbox renders.
 * Must run during `next build` — never call @remotion/bundler at Function runtime
 * (native @rspack/binding is missing under Bun's install layout on Vercel).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPoint = path.join(webRoot, "src/remotion/index.ts");
const outDir = path.join(webRoot, ".remotion");

/** Chromium follows //# sourceMappingURL=…; dangling refs → ENOENT on Sandbox. */
const SOURCE_MAPPING_URL_RE = /\n?\/\/[#@]\s*sourceMappingURL=[^\n]*\n?/g;

if (!existsSync(entryPoint)) {
  console.error(`[bundle-remotion] missing entry: ${entryPoint}`);
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });

// Remotion treats `publicDir: null` as "use ./public". Point at an empty dir so
// Next.js brand assets are not copied — nested public/ breaks Sandbox upload
// (`mkDir remotion-bundle/public` fails when remotion-bundle does not exist yet).
const emptyPublicDir = await mkdtemp(path.join(tmpdir(), "remotion-empty-public-"));

try {
  const location = await bundle({
    entryPoint,
    outDir,
    publicDir: emptyPublicDir,
    enableCaching: false,
    // Don't emit .map files — Sandbox only needs the JS; maps bloat upload size.
    webpackOverride: (config) => ({
      ...config,
      devtool: false,
    }),
    onProgress: (progress) => {
      if (progress === 0 || progress === 100 || progress % 25 === 0) {
        console.log(`[bundle-remotion] ${progress}%`);
      }
    },
  });

  // Belt-and-suspenders: keep the Sandbox bundle flat (no nested dirs).
  await rm(path.join(location, "public"), { recursive: true, force: true });

  // Drop any leftover maps and strip sourceMappingURL comments so Chrome in the
  // Sandbox does not ENOENT on remotion-bundle/bundle.js.map.
  const entries = await readdir(location);
  await Promise.all(
    entries.map(async (name) => {
      const full = path.join(location, name);
      if (name.endsWith(".map")) {
        await unlink(full);
        return;
      }
      if (!name.endsWith(".js")) return;
      const src = await readFile(full, "utf8");
      if (!src.includes("sourceMappingURL")) return;
      await writeFile(full, src.replace(SOURCE_MAPPING_URL_RE, "\n"));
    }),
  );

  console.log(`[bundle-remotion] wrote ${location}`);
} finally {
  await rm(emptyPublicDir, { recursive: true, force: true }).catch(() => undefined);
}
