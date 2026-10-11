import { describe, expect, test } from "bun:test";
import {
  mockStructureBcmt,
  parseBcmtStructureRequest,
  parseBcmtStructureResponse,
} from "./structureParse";

describe("parseBcmtStructureRequest", () => {
  test("accepts text", () => {
    const r = parseBcmtStructureRequest({ text: "viết email kích hoạt trial" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.text).toContain("email");
  });
  test("rejects empty / bare bcmt", () => {
    expect(parseBcmtStructureRequest({ text: "" }).ok).toBe(false);
    expect(parseBcmtStructureRequest({ text: "bcmt" }).ok).toBe(false);
  });
});

describe("parseBcmtStructureResponse", () => {
  test("raw json", () => {
    const d = parseBcmtStructureResponse(
      JSON.stringify({
        context: "CRM SME",
        people: "CSM; chủ SME",
        goal: "email kích hoạt",
        standards: "≤120 từ",
        input: "",
      }),
    );
    expect(d?.context).toBe("CRM SME");
    expect(d?.goal).toBe("email kích hoạt");
  });
  test("fenced json", () => {
    const d = parseBcmtStructureResponse(`\`\`\`json
{"context":"a","people":"b","goal":"c","standards":"d","input":""}
\`\`\``);
    expect(d?.goal).toBe("c");
  });
  test("rejects empty core", () => {
    expect(parseBcmtStructureResponse('{"input":"x"}')).toBeNull();
  });
});

describe("mockStructureBcmt", () => {
  test("puts body in goal", () => {
    const d = mockStructureBcmt("bcmt viết email kích hoạt");
    expect(d.goal).toContain("viết email");
    expect(d.people).toBeTruthy();
  });
});
