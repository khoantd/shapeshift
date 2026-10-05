import { describe, expect, it } from "vitest";
import { parseTextFlowTranscriptResponse } from "./textflowTranscriptParse";
import { textFlowTranscriptProxyUrl } from "./textflowTranscriptUrl";

describe("parseTextFlowTranscriptResponse", () => {
  it("reads litellm-aid-studio { data: { transcript } } shape", () => {
    expect(
      parseTextFlowTranscriptResponse({
        data: {
          transcript: "Hello world",
          language: "en",
          videoId: "abc12345678",
        },
      }),
    ).toEqual({ text: "Hello world", language: "en" });
  });

  it("reads documented { success, text } shape", () => {
    expect(
      parseTextFlowTranscriptResponse({ success: true, text: "Line one", language: "vi" }),
    ).toEqual({ text: "Line one", language: "vi" });
  });
});

describe("textFlowTranscriptProxyUrl", () => {
  it("appends /api/videos/transcript/proxy when base is host only", () => {
    expect(textFlowTranscriptProxyUrl("https://textflow.sutools.app")).toBe(
      "https://textflow.sutools.app/api/videos/transcript/proxy",
    );
  });

  it("avoids double /api when base already ends with /api", () => {
    expect(textFlowTranscriptProxyUrl("https://textflow.sutools.app/api")).toBe(
      "https://textflow.sutools.app/api/videos/transcript/proxy",
    );
  });
});
