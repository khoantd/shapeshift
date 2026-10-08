import { describe, expect, test } from "bun:test";
import {
  extractMermaidSource,
  sanitizeMermaidSourceForRender,
} from "./mermaidSecurity";

describe("sanitizeMermaidSourceForRender", () => {
  test("strips init config and unsafe click handlers", () => {
    const src = `%%{init: {'theme':'dark'}}%%
flowchart TD
  A-->B
click A "javascript:alert(1)"
click B "https://github.com/a/b"
`;
    const out = sanitizeMermaidSourceForRender(src);
    expect(out).not.toContain("%%{");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('click B "https://github.com/a/b"');
    expect(out).toContain("flowchart TD");
  });
});

describe("extractMermaidSource", () => {
  test("extracts fenced mermaid", () => {
    const raw = `Here you go:\n\`\`\`mermaid\nflowchart LR\n  A-->B\n\`\`\`\n`;
    expect(extractMermaidSource(raw)).toContain("flowchart LR");
  });

  test("rejects non-diagram text", () => {
    expect(extractMermaidSource("just a paragraph")).toBeNull();
  });
});
