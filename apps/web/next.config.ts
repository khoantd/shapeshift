import type { NextConfig } from "next";
import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Next only auto-loads `apps/web/.env*`. Many editors also keep secrets in the
 * monorepo root `.env`. Fill empty app keys from the root file so either works.
 */
function applyRootEnvFallback() {
  const rootEnvPath = path.join(__dirname, "../../.env");
  if (!existsSync(rootEnvPath)) return;
  for (const raw of readFileSync(rootEnvPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1);
    if (!key || !value.trim()) continue;
    const current = process.env[key];
    if (current == null || !String(current).trim()) {
      process.env[key] = value;
    }
  }
}

applyRootEnvFallback();

const nextConfig: NextConfig = {
  transpilePackages: ["@shapeshift/core", "@shapeshift/react"],
};

export default nextConfig;
