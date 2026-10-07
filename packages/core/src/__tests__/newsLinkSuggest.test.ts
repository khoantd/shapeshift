import { describe, expect, test } from "bun:test";
import {
  composeNewsLinkSuggestLine,
  mockSuggestNewsLink,
  newsLinkTextForSuggest,
} from "../jev/newsLinkSuggest";

describe("mockSuggestNewsLink", () => {
  test("detects CONTRASTS_WITH from opposing language", () => {
    const r = mockSuggestNewsLink({
      sourceName: "MB Bank",
      targetName: "ACB",
      sourceContext: "MB Bank posted record profits this quarter.",
      targetContext: "Unlike ACB, which faces decline and lawsuit risk.",
    });
    expect(r.source).toBe("mock");
    expect(r.linkType).toBe("CONTRASTS_WITH");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.line).toContain("Contrasts with");
  });

  test("detects SUPPORTS from corroborating language", () => {
    const r = mockSuggestNewsLink({
      sourceName: "Interest rates",
      targetName: "Lending slowdown",
      sourceContext: "Higher interest rates confirm pressure on credit.",
      targetContext: "Data supports a lending slowdown across banks.",
    });
    expect(r.linkType).toBe("SUPPORTS");
    expect(r.line).toContain("Supports");
  });

  test("defaults to RELATED_TO when neutral", () => {
    const r = mockSuggestNewsLink({
      sourceName: "Vietcombank",
      targetName: "Digital banking",
      sourceContext: "Vietcombank invested in mobile apps.",
      targetContext: "Digital banking adoption rose among SMEs.",
    });
    expect(r.linkType).toBe("RELATED_TO");
    expect(r.line).toContain("Related to");
  });

  test("requires both entity names", () => {
    const r = mockSuggestNewsLink({
      sourceName: "  ",
      targetName: "ACB",
    });
    expect(r.linkType).toBe("RELATED_TO");
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe("composeNewsLinkSuggestLine", () => {
  test("joins labels", () => {
    expect(
      composeNewsLinkSuggestLine({
        linkType: "SUPPORTS",
        confidence: 0.8,
      }),
    ).toBe("Supports · High confidence");
  });
});

describe("newsLinkTextForSuggest", () => {
  test("includes both entities and contexts", () => {
    const text = newsLinkTextForSuggest({
      sourceName: "MB Bank",
      targetName: "ACB",
      sourceContext: "Profits up.",
      targetContext: "Cuts staff.",
    });
    expect(text).toContain("Source entity: MB Bank");
    expect(text).toContain("Target entity: ACB");
    expect(text).toContain("Profits up.");
    expect(text).toContain("Cuts staff.");
  });
});
