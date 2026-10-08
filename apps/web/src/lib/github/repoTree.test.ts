import { describe, expect, test } from "bun:test";
import {
  buildRepoTreeResult,
  buildTreeOutline,
  selectTreePaths,
  shouldIncludeTreePath,
} from "./repoTree";

describe("shouldIncludeTreePath", () => {
  test("skips node_modules and lockfiles", () => {
    expect(shouldIncludeTreePath("node_modules/foo", "blob")).toBe(false);
    expect(shouldIncludeTreePath("package-lock.json", "blob")).toBe(false);
    expect(shouldIncludeTreePath("src/index.ts", "blob")).toBe(true);
  });
});

describe("selectTreePaths", () => {
  test("prefers directories then shallow files", () => {
    const paths = selectTreePaths(
      [
        { path: "src", type: "tree" },
        { path: "src/a.ts", type: "blob" },
        { path: "README.md", type: "blob" },
        { path: "node_modules/x", type: "blob" },
      ],
      10,
    );
    expect(paths[0]).toBe("src/");
    expect(paths).toContain("README.md");
    expect(paths).toContain("src/a.ts");
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
  });
});

describe("buildTreeOutline", () => {
  test("truncates when over max chars", () => {
    const { outline, truncated } = buildTreeOutline(
      ["aaaa", "bbbb", "cccc"],
      10,
    );
    expect(truncated).toBe(true);
    expect(outline.endsWith("…")).toBe(true);
  });
});

describe("buildRepoTreeResult", () => {
  test("builds outline from entries", () => {
    const result = buildRepoTreeResult({
      fullName: "a/b",
      defaultBranch: "main",
      entries: [
        { path: "src", type: "tree" },
        { path: "src/index.ts", type: "blob" },
      ],
    });
    expect(result.fullName).toBe("a/b");
    expect(result.outline).toContain("src/");
    expect(result.paths.length).toBeGreaterThan(0);
  });
});
