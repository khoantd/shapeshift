/**
 * Strip unsafe Mermaid directives before client render.
 * Adapted from gitdiagram's mermaid-security approach.
 */

const safeGitHubClickDirective =
  /^\s*click\s+[a-z_][a-z0-9_-]*\s+"https:\/\/github\.com\/[^"\s]+"\s*$/iu;

const clickDirectiveStart = /^click(\s|$)/u;

const MERMAID_START =
  /^(flowchart|graph|sequencediagram|classdiagram|statediagram(-v2)?|erdiagram|mindmap|timeline|gitgraph|pie|gantt|journey)\b/i;

/** Remove init config blocks and non-GitHub click handlers. */
export function sanitizeMermaidSourceForRender(source: string): string {
  const lines: string[] = [];
  let insideConfigDirective = false;

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (insideConfigDirective) {
      insideConfigDirective = !trimmed.includes("}%%");
      continue;
    }
    if (trimmed.startsWith("%%{")) {
      insideConfigDirective = !trimmed.includes("}%%");
      continue;
    }
    if (
      clickDirectiveStart.test(trimmed) &&
      !safeGitHubClickDirective.test(line)
    ) {
      continue;
    }
    lines.push(line);
  }

  return lines.join("\n");
}

/** Keep only https://github.com anchors after Mermaid paints SVG. */
export function enforceSafeMermaidLinks(root: ParentNode): void {
  for (const anchor of root.querySelectorAll("a")) {
    const rawHref =
      anchor.getAttribute("href") ?? anchor.getAttribute("xlink:href") ?? "";

    try {
      const url = new URL(rawHref, window.location.origin);
      if (url.protocol !== "https:" || url.hostname !== "github.com") {
        anchor.removeAttribute("href");
        anchor.removeAttribute("xlink:href");
        continue;
      }
      anchor.setAttribute("href", url.toString());
      anchor.removeAttribute("xlink:href");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.setAttribute("target", "_blank");
    } catch {
      anchor.removeAttribute("href");
      anchor.removeAttribute("xlink:href");
    }
  }
}

/** Pull fenced ```mermaid block or raw diagram source from model output. */
export function extractMermaidSource(raw: string): string | null {
  const fenced = /```(?:mermaid)?\s*([\s\S]*?)```/i.exec(raw);
  const body = (fenced?.[1] ?? raw).trim();
  if (!body) return null;
  const first =
    body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  if (!MERMAID_START.test(first)) return null;
  return sanitizeMermaidSourceForRender(body);
}
