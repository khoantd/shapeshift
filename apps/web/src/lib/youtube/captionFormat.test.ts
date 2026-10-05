import { describe, expect, test } from "bun:test";
import {
  parseCaptionBody,
  parseSrtTimestamp,
  parseSrtToTranscript,
  pickApiCaptionTrack,
  formatCaptionTimestamp,
} from "./captionFormat";

describe("formatCaptionTimestamp", () => {
  test("formats mm:ss and h:mm:ss", () => {
    expect(formatCaptionTimestamp(65)).toBe("1:05");
    expect(formatCaptionTimestamp(3723)).toBe("1:02:03");
  });
});

describe("parseSrtTimestamp", () => {
  test("parses comma and dot millis", () => {
    expect(parseSrtTimestamp("00:01:05,000")).toBe(65);
    expect(parseSrtTimestamp("01:02:03.500")).toBe(3723.5);
  });
});

describe("parseSrtToTranscript", () => {
  test("converts SRT blocks to timestamped lines", () => {
    const srt = `1
00:00:00,000 --> 00:00:02,000
Hello world

2
00:00:02,500 --> 00:00:05,000
Second <b>line</b>
`;
    const text = parseSrtToTranscript(srt);
    expect(text).toContain("[0:00] Hello world");
    expect(text).toContain("[0:02] Second line");
  });
});

describe("parseCaptionBody", () => {
  test("parses srv3 timedtext XML", () => {
    const xml = `<?xml version="1.0"?><timedtext format="3"><body><p t="61000" d="4000"><s>Hello</s> <s>world</s></p></body></timedtext>`;
    const text = parseCaptionBody(xml);
    expect(text).toBe("[1:01] Hello world");
  });
});

describe("pickApiCaptionTrack", () => {
  test("prefers en then non-ASR", () => {
    const picked = pickApiCaptionTrack([
      { id: "1", language: "vi", trackKind: "standard" },
      { id: "2", language: "en", trackKind: "ASR" },
      { id: "3", language: "en", trackKind: "standard" },
    ]);
    expect(picked?.id).toBe("3");
  });

  test("falls back to first when no prefer match", () => {
    const picked = pickApiCaptionTrack([{ id: "x", language: "ja", trackKind: "ASR" }], ["en"]);
    expect(picked?.id).toBe("x");
  });
});
