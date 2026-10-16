import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  test("returns empty for blank", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\t  ")).toEqual([]);
  });

  test("parses ATX headings without hash markers", () => {
    const blocks = parseMarkdown("## Executive take\n\nBody text.");
    expect(blocks[0]).toEqual({
      type: "heading",
      level: 2,
      children: [{ type: "text", text: "Executive take" }],
    });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "Body text." }],
    });
  });

  test("parses bold and italic inline", () => {
    const blocks = parseMarkdown(
      "**Cerebras** is a *credible* challenger.",
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "bold", children: [{ type: "text", text: "Cerebras" }] },
          { type: "text", text: " is a " },
          { type: "italic", children: [{ type: "text", text: "credible" }] },
          { type: "text", text: " challenger." },
        ],
      },
    ]);
  });

  test("parses unordered list items", () => {
    const blocks = parseMarkdown(
      "- **Commercial validation:** OpenAI deal\n- Product momentum",
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("bullet");
    expect(blocks[1]).toEqual({
      type: "bullet",
      children: [{ type: "text", text: "Product momentum" }],
    });
  });

  test("parses citation clusters as cite nodes", () => {
    const blocks = parseMarkdown(
      "WSE-3 chip.[web:18][page:2]",
    );
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "text", text: "WSE-3 chip." },
        { type: "cite", indices: [18, 2] },
      ],
    });
  });

  test("parses markdown links", () => {
    const blocks = parseMarkdown("See [Meanbox](https://meanbox.vercel.app).");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "text", text: "See " },
        {
          type: "link",
          href: "https://meanbox.vercel.app",
          children: [{ type: "text", text: "Meanbox" }],
        },
        { type: "text", text: "." },
      ],
    });
  });

  test("parses ordered lists and blockquotes", () => {
    const blocks = parseMarkdown("1. First\n\n> Quote line");
    expect(blocks[0]).toEqual({
      type: "ordered",
      index: 1,
      children: [{ type: "text", text: "First" }],
    });
    expect(blocks[1]).toEqual({
      type: "blockquote",
      children: [{ type: "text", text: "Quote line" }],
    });
  });
});
