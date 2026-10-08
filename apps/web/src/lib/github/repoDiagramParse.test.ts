import { describe, expect, test } from "bun:test";
import {
  buildRepoDiagramPrompt,
  parseRepoDiagramRequest,
} from "./repoDiagramParse";
import { parseExplainerChapters } from "./repoExplainerParse";

describe("parseRepoDiagramRequest", () => {
  test("requires repo", () => {
    expect(parseRepoDiagramRequest(null).ok).toBe(false);
    expect(parseRepoDiagramRequest({}).ok).toBe(false);
  });

  test("accepts repo + outline", () => {
    const parsed = parseRepoDiagramRequest({
      repo: "vercel/next.js",
      treeOutline: "apps/\npackages/\n",
      language: "en",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.fullName).toBe("vercel/next.js");
    expect(parsed.data.treeOutline).toContain("apps/");
  });
});

describe("buildRepoDiagramPrompt", () => {
  test("includes mermaid instructions", () => {
    const prompt = buildRepoDiagramPrompt({
      fullName: "a/b",
      description: null,
      readme: "# Hi",
      treeOutline: "src/",
      language: "en",
    });
    expect(prompt).toContain("mermaid");
    expect(prompt).toContain("src/");
  });
});

describe("parseExplainerChapters", () => {
  test("parses JSON chapters", () => {
    const chapters = parseExplainerChapters(
      JSON.stringify({
        chapters: [
          { title: "What", body: "A tool." },
          { title: "Parts", body: "Apps and packages." },
        ],
      }),
    );
    expect(chapters).toHaveLength(2);
    expect(chapters?.[0]?.title).toBe("What");
  });

  test("rejects empty", () => {
    expect(parseExplainerChapters("{}")).toBeNull();
  });
});
