"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";
import {
  CITE_PROTOCOL,
  encodeWebCitations,
  parseCiteHref,
  resolveCiteSources,
  type CiteSource,
} from "../lib/webCitations";
import { CitationSourcesChip } from "./CitationSourcesChip";

const linkClass =
  "font-medium text-ink-2 underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Allow cite links through; keep default protocol sanitization for everything else. */
function urlTransform(url: string): string {
  if (url.startsWith(CITE_PROTOCOL)) return url;
  return defaultUrlTransform(url);
}
/**
 * Renders markdown for the news reader pane — semantic HTML, GFM tables/lists,
 * external links open safely. Optional `sources` turns `[web:N]` into favicon chips.
 */
export function MarkdownBody({
  children,
  className,
  sources,
}: {
  children: string;
  className?: string;
  sources?: readonly CiteSource[];
}) {
  const trimmed = children.trim();
  if (!trimmed) return null;

  const source =
    sources && sources.length > 0 ? encodeWebCitations(trimmed) : trimmed;

  return (
    <div
      className={cn(
        "markdown-body flex flex-col gap-3 text-[15px] leading-[22px] text-pretty text-ink-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          p: ({ children: c }) => <p className="text-pretty">{c}</p>,
          h1: ({ children: c }) => (
            <h4 className="text-[18px] leading-6 font-[550] tracking-tight text-foreground">{c}</h4>
          ),
          h2: ({ children: c }) => (
            <h4 className="text-[17px] leading-6 font-[550] tracking-tight text-foreground">{c}</h4>
          ),
          h3: ({ children: c }) => (
            <h4 className="text-[16px] leading-6 font-[550] tracking-tight text-foreground">{c}</h4>
          ),
          h4: ({ children: c }) => (
            <h5 className="text-[15px] leading-5 font-[550] text-foreground">{c}</h5>
          ),
          h5: ({ children: c }) => (
            <h5 className="text-[15px] leading-5 font-medium text-foreground">{c}</h5>
          ),
          h6: ({ children: c }) => (
            <h5 className="text-[14px] leading-5 font-medium text-foreground">{c}</h5>
          ),
          strong: ({ children: c }) => (
            <strong className="font-[600] text-foreground">{c}</strong>
          ),
          em: ({ children: c }) => <em className="italic">{c}</em>,
          ul: ({ children: c }) => (
            <ul className="flex list-disc flex-col gap-1.5 ps-5 marker:text-muted-foreground">{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol className="flex list-decimal flex-col gap-1.5 ps-5 marker:text-muted-foreground">{c}</ol>
          ),
          li: ({ children: c }) => <li className="ps-0.5 text-pretty">{c}</li>,
          a: ({ href, children: c }) => {
            const url = typeof href === "string" ? href.trim() : "";
            const indices = parseCiteHref(url);
            if (indices) {
              const resolved = resolveCiteSources(indices, sources ?? []);
              if (resolved.length === 0) {
                return (
                  <span className="font-medium text-muted-foreground">
                    {indices.map((n) => `[web:${n}]`).join("")}
                  </span>
                );
              }
              return <CitationSourcesChip sources={resolved} />;
            }
            const safe = /^https?:\/\//i.test(url);
            if (!safe) {
              return <span className="font-medium text-foreground">{c}</span>;
            }
            return (
              <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {c}
              </a>
            );
          },
          blockquote: ({ children: c }) => (
            <blockquote className="border-s-2 border-border ps-3 text-muted-foreground">{c}</blockquote>
          ),
          hr: () => <hr className="border-border" />,
          code: ({ className: codeClass, children: c }) => {
            const isBlock = typeof codeClass === "string" && codeClass.includes("language-");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-[13px] leading-5 text-ink-2">
                  {c}
                </code>
              );
            }
            return (
              <code className="rounded-sm bg-muted/60 px-1 py-0.5 font-mono text-[13px] text-foreground">
                {c}
              </code>
            );
          },
          pre: ({ children: c }) => (
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-0">{c}</pre>
          ),
          table: ({ children: c }) => (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[16rem] border-collapse text-left text-[13px] leading-5">
                {c}
              </table>
            </div>
          ),
          thead: ({ children: c }) => <thead className="bg-muted/50">{c}</thead>,
          th: ({ children: c }) => (
            <th className="border-b border-border px-2.5 py-1.5 font-medium text-foreground">{c}</th>
          ),
          td: ({ children: c }) => (
            <td className="border-b border-border px-2.5 py-1.5 align-top">{c}</td>
          ),
          tr: ({ children: c }) => <tr className="even:bg-muted/20">{c}</tr>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
