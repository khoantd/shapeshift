import {
  bcmtSourceBody,
  normalizeBcmtFields,
  type BcmtData,
} from "@shapeshift/core/parse/bcmt";
import { parseJsonObject } from "@/lib/ai/jsonFence";

export type BcmtStructureRequest = {
  text: string;
  force?: boolean;
};

export type BcmtStructureParseError = { ok: false; error: string };
export type BcmtStructureParseOk = { ok: true; data: BcmtStructureRequest };

const TEXT_MAX = 8000;

export function parseBcmtStructureRequest(
  body: unknown,
): BcmtStructureParseOk | BcmtStructureParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { text: string }" };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.text !== "string") {
    return { ok: false, error: "Expected { text: string }" };
  }
  const text = raw.text.replace(/\r\n/g, "\n").slice(0, TEXT_MAX);
  if (!bcmtSourceBody(text)) {
    return { ok: false, error: "Prompt text is empty" };
  }
  return {
    ok: true,
    data: {
      text,
      ...(raw.force === true ? { force: true } : {}),
    },
  };
}

export function bcmtStructureCacheKey(input: BcmtStructureRequest): string {
  const t = input.text.trim();
  return `bcmt:${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`;
}

export function buildBcmtStructurePrompt(input: BcmtStructureRequest): string {
  return `You convert a freeform AI prompt into the BCMT framework (Bối cảnh, Con người, Mục tiêu, Tiêu chuẩn, optional Đầu vào).

Rules:
- Output ONLY valid JSON (no markdown fences): {"context":"...","people":"...","goal":"...","standards":"...","input":"..."}
- Map semantics: context = industry/product/background; people = who you are + who reads; goal = single measurable deliverable; standards = format/length/language/must/must-not; input = optional payload placeholder ("" if none).
- Infer reasonable values from the user's intent; do not leave all four core fields empty.
- Keep each field concise. Prefer Vietnamese when the user wrote Vietnamese; otherwise match the user's language.
- If the input is already tagged or labeled BCMT sections, improve and fill missing sections.

User prompt:
---
${input.text}
---
`;
}

export function parseBcmtStructureResponse(raw: string): BcmtData | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;
  return normalizeBcmtFields(obj);
}

/** Offline / mock: put the body in goal with light defaults. */
export function mockStructureBcmt(text: string): BcmtData {
  const body = bcmtSourceBody(text);
  return {
    context: "User-provided freeform prompt",
    people: "Bạn là trợ lý hữu ích. Người đọc là người dùng",
    goal: body.slice(0, 400),
    standards: "Rõ ràng · đúng yêu cầu · không thêm phần thừa",
    input: "",
  };
}
