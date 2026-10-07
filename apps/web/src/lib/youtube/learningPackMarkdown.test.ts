import { describe, expect, test } from "bun:test";
import { parseInline, parseLearningPackMarkdown } from "./learningPackMarkdown";

describe("parseInline", () => {
  test("parses bold italic and code", () => {
    const spans = parseInline("Hello **bold** and *italic* plus `code`");
    expect(spans).toEqual([
      { type: "text", text: "Hello " },
      { type: "bold", text: "bold" },
      { type: "text", text: " and " },
      { type: "italic", text: "italic" },
      { type: "text", text: " plus " },
      { type: "code", text: "code" },
    ]);
  });
});

describe("parseLearningPackMarkdown", () => {
  test("parses headings lists and paragraphs", () => {
    const md = `# Title

Intro paragraph.

## Section

- item one
- item two

### Sub

More text.
`;
    const blocks = parseLearningPackMarkdown(md);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(blocks[2]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: false });
    if (blocks[3]?.type === "list") {
      expect(blocks[3].items).toHaveLength(2);
    }
    expect(blocks[4]).toMatchObject({ type: "heading", level: 3 });
  });

  test("groups flashcards", () => {
    const md = `## Flashcards

- Q: What is X? | A: Y
- Q: Second? | A: Answer two
`;
    const blocks = parseLearningPackMarkdown(md);
    const cards = blocks.find((b) => b.type === "flashcards");
    expect(cards?.type).toBe("flashcards");
    if (cards?.type === "flashcards") {
      expect(cards.cards).toHaveLength(2);
      expect(cards.cards[0]!.q[0]).toMatchObject({ type: "text", text: "What is X?" });
      expect(cards.cards[0]!.a[0]).toMatchObject({ type: "text", text: "Y" });
    }
  });

  test("nests answer key until next same-level heading", () => {
    const md = `## Check your understanding

1. What is A?

## Answer key

1. A is alpha.

## Flashcards

- Q: Q1 | A: A1
`;
    const blocks = parseLearningPackMarkdown(md);
    const answer = blocks.find((b) => b.type === "answerKey");
    expect(answer?.type).toBe("answerKey");
    if (answer?.type === "answerKey") {
      expect(answer.blocks.some((b) => b.type === "list")).toBe(true);
    }
    expect(blocks.some((b) => b.type === "flashcards")).toBe(true);
  });

  test("parses hr", () => {
    const blocks = parseLearningPackMarkdown("Above\n\n---\n\nBelow");
    expect(blocks.some((b) => b.type === "hr")).toBe(true);
  });

  test("parses GFM pipe tables for Key arguments", () => {
    const md = `## Key arguments

| Argument | Support offered in the video | What the support does—and doesn't—show |
|---|---|---|
| Cross-level translation is central to architectural impact. | A personal project anecdote involving management, planning, and DevOps. | Illustrates the practice; does not demonstrate that every project needs the same approach. |
| Preserving options can matter more than optimizing performance. | The reviewer's experience in transformation programs. | Supports the reviewer's preference in that context; no comparative data is given. |

## Next section

More text.
`;
    const blocks = parseLearningPackMarkdown(md);
    const table = blocks.find((b) => b.type === "table");
    expect(table?.type).toBe("table");
    if (table?.type === "table") {
      expect(table.headers).toHaveLength(3);
      expect(table.headers[0]![0]).toMatchObject({ type: "text", text: "Argument" });
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0]![0]![0]).toMatchObject({
        type: "text",
        text: "Cross-level translation is central to architectural impact.",
      });
      expect(table.rows[1]![2]![0]).toMatchObject({
        type: "text",
        text: "Supports the reviewer's preference in that context; no comparative data is given.",
      });
    }
    // Must not collapse into a pipe-filled paragraph
    const pipesAsParagraph = blocks.some(
      (b) =>
        b.type === "paragraph" &&
        b.spans.some((s) => s.type === "text" && s.text.includes("|---|")),
    );
    expect(pipesAsParagraph).toBe(false);
    expect(blocks.some((b) => b.type === "heading" && b.level === 2)).toBe(true);
  });

  test("flashcard lines with pipes are not tables", () => {
    const md = `## Flashcards

- Q: What is X? | A: Y
- Q: Second? | A: Answer two
`;
    const blocks = parseLearningPackMarkdown(md);
    expect(blocks.some((b) => b.type === "table")).toBe(false);
    expect(blocks.some((b) => b.type === "flashcards")).toBe(true);
  });
});
