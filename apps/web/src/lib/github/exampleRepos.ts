/** Curated starter repos for empty-search chips (gitdiagram-style). */

export type ExampleRepoChip = {
  fullName: string;
  label: string;
};

export const GITHUB_EXAMPLE_REPOS: readonly ExampleRepoChip[] = [
  { fullName: "vercel/next.js", label: "next.js" },
  { fullName: "facebook/react", label: "react" },
  { fullName: "vercel/ai", label: "ai sdk" },
  { fullName: "supabase/supabase", label: "supabase" },
  { fullName: "withastro/astro", label: "astro" },
] as const;
