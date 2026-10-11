import { describe, expect, test } from "bun:test";
import {
  mockStructureRtcfc,
  parseRtcfcStructureRequest,
  parseRtcfcStructureResponse,
} from "./structureParse";

describe("parseRtcfcStructureRequest", () => {
  test("accepts text", () => {
    const r = parseRtcfcStructureRequest({ text: "write a PR review for NestJS" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.text).toContain("PR review");
  });
  test("rejects empty / bare rtcfc", () => {
    expect(parseRtcfcStructureRequest({ text: "" }).ok).toBe(false);
    expect(parseRtcfcStructureRequest({ text: "rtcfc" }).ok).toBe(false);
    expect(parseRtcfcStructureRequest(null).ok).toBe(false);
  });
});

describe("parseRtcfcStructureResponse", () => {
  test("raw json", () => {
    const d = parseRtcfcStructureResponse(
      JSON.stringify({
        role: "staff engineer",
        task: "review PR",
        context: "NestJS",
        format: "table",
        constraints: "skip nits",
      }),
    );
    expect(d?.role).toBe("staff engineer");
    expect(d?.task).toBe("review PR");
  });
  test("fenced json", () => {
    const d = parseRtcfcStructureResponse(`\`\`\`json
{"role":"a","task":"b","context":"c","format":"d","constraints":"e"}
\`\`\``);
    expect(d).toEqual({
      role: "a",
      task: "b",
      context: "c",
      format: "d",
      constraints: "e",
    });
  });
  test("rejects empty object", () => {
    expect(parseRtcfcStructureResponse("{}")).toBeNull();
  });
});

describe("mockStructureRtcfc", () => {
  test("puts body in task", () => {
    const d = mockStructureRtcfc("rtcfc help me draft a README");
    expect(d.task).toContain("draft a README");
    expect(d.role).toBeTruthy();
  });
});
