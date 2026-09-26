import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Convex codegen emits eslint-disable headers; ignore so lint stays clean.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "convex/_generated/**"]),
]);

export default eslintConfig;
