"use client";

import type { ReactNode } from "react";
import {
  parseLearningPackMarkdown,
  type InlineSpan,
  type MdBlock,
} from "@/lib/youtube/learningPackMarkdown";

const TIMESTAMP_RE = /(\[\d{1,2}:\d{2}(?::\d{2})?\])/g;

function Inline({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.type === "bold") {
          return (
            <strong key={i} className="font-[550] text-foreground">
              {span.text}
            </strong>
          );
        }
        if (span.type === "italic") {
          return (
            <em key={i} className="italic">
              {span.text}
            </em>
          );
        }
        if (span.type === "code") {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground"
            >
              {span.text}
            </code>
          );
        }
        return <TimestampText key={i} text={span.text} />;
      })}
    </>
  );
}

function isTimestampToken(part: string): boolean {
  return /^\[\d{1,2}:\d{2}(?::\d{2})?\]$/.test(part);
}

function TimestampText({ text }: { text: string }) {
  const parts = text.split(TIMESTAMP_RE);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        isTimestampToken(part) ? (
          <span key={i} className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Blocks({ blocks }: { blocks: MdBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "heading": {
      const className =
        block.level === 1
          ? "mt-0 mb-3 text-[22px] font-[550] leading-7 tracking-[-0.02em] text-foreground"
          : block.level === 2
            ? "mt-6 mb-2 border-t border-border pt-4 text-[16px] font-[550] leading-6 text-foreground first:mt-0 first:border-t-0 first:pt-0"
            : "mt-4 mb-1.5 text-[14px] font-[550] leading-5 text-foreground";
      const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
      return (
        <Tag className={className}>
          <Inline spans={block.spans} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="mb-3 text-[14px] leading-6 text-pretty text-ink-2">
          <Inline spans={block.spans} />
        </p>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={
            block.ordered
              ? "mb-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-ink-2"
              : "mb-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-ink-2"
          }
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline spans={item} />
            </li>
          ))}
        </ListTag>
      );
    }
    case "flashcards":
      return (
        <ul className="mb-4 list-none space-y-0 divide-y divide-border rounded-md border border-border bg-background">
          {block.cards.map((card, i) => (
            <li key={i} className="px-3 py-2.5">
              <p className="text-[13px] font-[550] leading-5 text-foreground">
                <span className="sr-only">Question: </span>
                <Inline spans={card.q} />
              </p>
              <p className="mt-1 text-[13px] leading-5 text-ink-2">
                <span className="sr-only">Answer: </span>
                <Inline spans={card.a} />
              </p>
            </li>
          ))}
        </ul>
      );
    case "hr":
      return <hr className="my-4 border-border" />;
    case "answerKey":
      return (
        <details className="mb-4 rounded-md border border-border bg-background open:pb-2">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Show answer key
          </summary>
          <div className="border-t border-border px-3 pt-2">
            <Blocks blocks={block.blocks} />
          </div>
        </details>
      );
    default:
      return null;
  }
}

type Props = {
  markdown: string;
};

export function LearningPackPreview({ markdown }: Props): ReactNode {
  const blocks = parseLearningPackMarkdown(markdown);
  return (
    <article
      className="max-h-[min(70vh,36rem)] overflow-auto rounded-md border border-border bg-background px-4 py-4"
      aria-label="Learning pack preview"
    >
      <Blocks blocks={blocks} />
    </article>
  );
}
