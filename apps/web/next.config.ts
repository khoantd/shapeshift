import type { NextConfig } from "next";
import { existsSync, readFileSync } from "fs";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

/** Relative path required for Turbopack (`next-intl/config` alias). */
const NEXT_INTL_REQUEST = "./src/i18n/request.ts";

const withNextIntl = createNextIntlPlugin(NEXT_INTL_REQUEST);

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

const neo4jArcCommon = path.join(__dirname, "vendor/neo4j-arc/common");
const neo4jArcViz = path.join(__dirname, "vendor/neo4j-arc/graph-visualization");
const nextIntlRequestAbs = path.join(__dirname, "src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@shapeshift/core", "@shapeshift/react"],
  serverExternalPackages: [
    "remotion",
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/vercel",
    "@remotion/media-utils",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "@remotion/compositor-win32-x64-msvc",
    "openai",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@vercel/sandbox",
  ],
  compiler: {
    // Vendored neo4j-arc GraphVisualizer uses styled-components v5.
    styledComponents: true,
  },
  outputFileTracingIncludes: {
    "/*": ["./vendor/neo4j-arc/**/*"],
    "/api/github/video": ["./src/remotion/**/*"],
  },
  async redirects() {
    return [
      { source: "/demo", destination: "/gadgets", permanent: true },
      { source: "/vi/demo", destination: "/vi/gadgets", permanent: true },
    ];
  },
  turbopack: {
    resolveAlias: {
      // Belt-and-suspenders: plugin also sets this; explicit so Turbopack never
      // resolves the throw-stub at `next-intl/config`.
      "next-intl/config": NEXT_INTL_REQUEST,
      "neo4j-arc/common": "./vendor/neo4j-arc/common",
      "neo4j-arc/graph-visualization": "./vendor/neo4j-arc/graph-visualization",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next-intl/config": nextIntlRequestAbs,
      "neo4j-arc/common": neo4jArcCommon,
      "neo4j-arc/graph-visualization": neo4jArcViz,
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
