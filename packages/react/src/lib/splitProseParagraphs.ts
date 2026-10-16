/** Soft-split threshold: shorter single blocks stay one paragraph. */
const LONG_BLOCK_CHARS = 280;

/** Sentences per soft-split paragraph. */
const SENTENCES_PER_PARAGRAPH = 2;

/** Sentence end + space + Unicode uppercase / opening quote. */
const SENTENCE_BOUNDARY =
  /(?<=[.!?…])\s+(?=[\p{Lu}"“«])/gu;

/**
 * Split prose into readable paragraphs for news Summary display.
 * Prefers blank lines, then single newlines, then soft sentence groups for long walls of text.
 */
export function splitProseParagraphs(text: string): string[] {
  const normalized = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalized) return [];

  const blankSplit = normalized
    .split(/\n\s*\n+/)
    .map((chunk) => collapseInlineWhitespace(chunk))
    .filter(Boolean);

  if (blankSplit.length > 1) return blankSplit;

  if (normalized.includes("\n")) {
    const lineSplit = normalized
      .split(/\n+/)
      .map((line) => collapseInlineWhitespace(line))
      .filter(Boolean);
    if (lineSplit.length > 1) return lineSplit;
  }

  const single = blankSplit[0] ?? collapseInlineWhitespace(normalized);
  if (!single) return [];
  if (single.length <= LONG_BLOCK_CHARS) return [single];

  return softSplitLongBlock(single);
}

function collapseInlineWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function softSplitLongBlock(text: string): string[] {
  const sentences = text
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [text];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    const group = sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" ");
    if (group) paragraphs.push(group);
  }
  return paragraphs.length > 0 ? paragraphs : [text];
}
