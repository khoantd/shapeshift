/** Pure helpers for GitHub recursive tree → prompt outline. */

export const TREE_MAX_PATHS = 120;
export const TREE_OUTLINE_MAX_CHARS = 12_000;

export type GithubTreeEntryRaw = {
  path?: string;
  type?: string;
  mode?: string;
  sha?: string;
  size?: number;
  url?: string;
};

export type GithubRepoTree = {
  fullName: string;
  defaultBranch: string;
  truncated: boolean;
  paths: string[];
  outline: string;
  fetchedAt: number;
};

const SKIP_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  "vendor/",
  "Pods/",
];

const SKIP_EXACT = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
]);

export function shouldIncludeTreePath(path: string, type: string): boolean {
  if (type !== "blob" && type !== "tree") return false;
  const p = path.replace(/^\.\//, "");
  if (!p || p.includes("..")) return false;
  if (SKIP_EXACT.has(p.split("/").pop() ?? "")) return false;
  for (const prefix of SKIP_PREFIXES) {
    if (p === prefix.slice(0, -1) || p.startsWith(prefix)) return false;
  }
  // Skip deep nested junk and binary-ish extensions
  if (p.split("/").length > 6) return false;
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|zip|gz|br)$/i.test(p)) {
    return false;
  }
  return true;
}

/**
 * Prefer directories + top-level files, then shallow source paths.
 * Caps at TREE_MAX_PATHS.
 */
export function selectTreePaths(
  entries: readonly GithubTreeEntryRaw[],
  max = TREE_MAX_PATHS,
): string[] {
  const trees: string[] = [];
  const blobs: string[] = [];
  for (const e of entries) {
    const path = (e.path ?? "").trim();
    const type = (e.type ?? "").trim();
    if (!path || !shouldIncludeTreePath(path, type)) continue;
    if (type === "tree") trees.push(path);
    else blobs.push(path);
  }
  trees.sort((a, b) => a.localeCompare(b));
  blobs.sort((a, b) => {
    const da = a.split("/").length;
    const db = b.split("/").length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
  const out: string[] = [];
  for (const p of trees) {
    if (out.length >= max) break;
    out.push(`${p}/`);
  }
  for (const p of blobs) {
    if (out.length >= max) break;
    out.push(p);
  }
  return out;
}

export function buildTreeOutline(
  paths: readonly string[],
  maxChars = TREE_OUTLINE_MAX_CHARS,
): { outline: string; truncated: boolean } {
  const lines = [...paths];
  let outline = lines.join("\n");
  if (outline.length <= maxChars) {
    return { outline, truncated: false };
  }
  outline = "";
  for (const line of lines) {
    const next = outline ? `${outline}\n${line}` : line;
    if (next.length > maxChars) {
      return {
        outline: `${outline}\n…`,
        truncated: true,
      };
    }
    outline = next;
  }
  return { outline, truncated: false };
}

export function buildRepoTreeResult(input: {
  fullName: string;
  defaultBranch: string;
  entries: readonly GithubTreeEntryRaw[];
  apiTruncated?: boolean;
}): GithubRepoTree {
  const paths = selectTreePaths(input.entries);
  const { outline, truncated } = buildTreeOutline(paths);
  return {
    fullName: input.fullName,
    defaultBranch: input.defaultBranch,
    truncated: Boolean(input.apiTruncated) || truncated || paths.length >= TREE_MAX_PATHS,
    paths,
    outline,
    fetchedAt: Date.now(),
  };
}
