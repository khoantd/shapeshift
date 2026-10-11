import { normalizeBcmtFields, type BcmtData } from "@shapeshift/core/parse/bcmt";
import { normalizeRtcfcFields, type RtcfcData } from "@shapeshift/core/parse/rtcfc";

export type StructureRtcfcFn = (text: string, signal?: AbortSignal) => Promise<RtcfcData>;
export type StructureBcmtFn = (text: string, signal?: AbortSignal) => Promise<BcmtData>;

type StructureOk<T> = {
  success: true;
  data: T;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

/**
 * POST `{ text }` to an RTCFC structure API.
 * Throws on network/HTTP/schema failure (caller shows inline error).
 */
export function createFetchStructureRtcfc(url = "/api/rtcfc/structure"): StructureRtcfcFn {
  return async (text, signal) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        isObject(json) && typeof json.error === "string" ? json.error : `Structure failed (${res.status})`;
      throw new Error(msg);
    }
    if (!isObject(json) || json.success !== true) {
      throw new Error("Invalid structure response");
    }
    const data = normalizeRtcfcFields((json as StructureOk<unknown>).data);
    if (!data) throw new Error("Empty structure response");
    return data;
  };
}

/**
 * POST `{ text }` to a BCMT structure API.
 * Throws on network/HTTP/schema failure (caller shows inline error).
 */
export function createFetchStructureBcmt(url = "/api/bcmt/structure"): StructureBcmtFn {
  return async (text, signal) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        isObject(json) && typeof json.error === "string" ? json.error : `Structure failed (${res.status})`;
      throw new Error(msg);
    }
    if (!isObject(json) || json.success !== true) {
      throw new Error("Invalid structure response");
    }
    const data = normalizeBcmtFields((json as StructureOk<unknown>).data);
    if (!data) throw new Error("Empty structure response");
    return data;
  };
}
