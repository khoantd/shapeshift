import { describe, expect, test } from "bun:test";
import { splitProseParagraphs } from "./splitProseParagraphs";

describe("splitProseParagraphs", () => {
  test("returns empty array for blank input", () => {
    expect(splitProseParagraphs("")).toEqual([]);
    expect(splitProseParagraphs("   \n\t  ")).toEqual([]);
  });

  test("preserves blank-line paragraphs", () => {
    expect(
      splitProseParagraphs("First block.\n\nSecond block.\n\n\nThird block."),
    ).toEqual(["First block.", "Second block.", "Third block."]);
  });

  test("collapses single newlines inside a blank-line paragraph", () => {
    expect(
      splitProseParagraphs("Line one\nstill same para.\n\nNext para."),
    ).toEqual(["Line one still same para.", "Next para."]);
  });

  test("treats single-newline lines as paragraphs when no blank lines", () => {
    expect(splitProseParagraphs("Alpha.\nBeta.\nGamma.")).toEqual([
      "Alpha.",
      "Beta.",
      "Gamma.",
    ]);
  });

  test("keeps short single-line text as one paragraph", () => {
    const short =
      "Bill Gates says avoiding contrails costs about 1-2 USD per ton.";
    expect(splitProseParagraphs(short)).toEqual([short]);
  });

  test("soft-splits long single-line prose into sentence groups", () => {
    const long =
      "Bill Gates đang tập trung vào việc giảm tác động khí hậu từ ngành hàng không. " +
      "Vệt mây (contrails) có thể giữ nhiệt và góp phần làm nóng toàn cầu. " +
      "Thay vì chỉ dựa vào nhiên liệu bền vững đắt đỏ, điều chỉnh đường bay giúp tránh tạo vệt mây. " +
      "Chi phí ước tính chỉ khoảng 1-2 USD mỗi tấn CO2. " +
      "Contrails.org hợp tác với American Airlines và Google Research để thử nghiệm. " +
      "Jeff Bezos cũng từng cam kết 10 tỷ USD cho khí hậu.";
    const parts = splitProseParagraphs(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(" ")).toBe(long);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });

  test("normalizes CRLF", () => {
    expect(splitProseParagraphs("One.\r\n\r\nTwo.")).toEqual(["One.", "Two."]);
  });
});
