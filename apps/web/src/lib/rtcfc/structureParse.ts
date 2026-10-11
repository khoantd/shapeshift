import {
  normalizeRtcfcFields,
  rtcfcSourceBody,
  type RtcfcData,
} from "@shapeshift/core/parse/rtcfc";
import { parseJsonObject } from "@/lib/ai/jsonFence";

export type RtcfcStructureRequest = {
  text: string;
  force?: boolean;
};

export type RtcfcStructureParseError = { ok: false; error: string };
export type RtcfcStructureParseOk = { ok: true; data: RtcfcStructureRequest };

const TEXT_MAX = 8000;

export function parseRtcfcStructureRequest(
  body: unknown,
): RtcfcStructureParseOk | RtcfcStructureParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { text: string }" };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.text !== "string") {
    return { ok: false, error: "Expected { text: string }" };
  }
  const text = raw.text.replace(/\r\n/g, "\n").slice(0, TEXT_MAX);
  if (!rtcfcSourceBody(text)) {
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

export function rtcfcStructureCacheKey(input: RtcfcStructureRequest): string {
  const t = input.text.trim();
  return `rtcfc:${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`;
}

export function buildRtcfcStructurePrompt(input: RtcfcStructureRequest): string {
  return `You convert a freeform AI prompt into the RTCFC framework (Role, Task, Context, Format, Constraints).

Rules:
- Output ONLY valid JSON (no markdown fences): {"role":"...","task":"...","context":"...","format":"...","constraints":"..."}
- Infer reasonable values from the user's intent; do not leave all fields empty.
- Keep each field concise (one short sentence or phrase).
- Preserve the user's language (English or Vietnamese as given).
- If the input is already labeled Role/Task/…, improve and fill missing sections.

User prompt:
---
${input.text}
---
`;
}

export function parseRtcfcStructureResponse(raw: string): RtcfcData | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;
  return normalizeRtcfcFields(obj);
}

/** Offline / mock: put the body in task with light defaults. */
export function mockStructureRtcfc(text: string): RtcfcData {
  const body = rtcfcSourceBody(text);
  return {
    role: "helpful assistant",
    task: body.slice(0, 400),
    context: "User-provided freeform prompt",
    format: "Clear, structured response",
    constraints: "Stay faithful to the user's request",
  };
}
