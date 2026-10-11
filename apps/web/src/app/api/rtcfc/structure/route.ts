import { APIUserAbortError } from "@perplexity-ai/perplexity_ai";
import { NextRequest, NextResponse } from "next/server";
import {
  parseRtcfcStructureRequest,
  RtcfcStructureConfigError,
  RtcfcStructureUpstreamError,
  runRtcfcStructure,
} from "@/lib/rtcfc/structure";

export const runtime = "nodejs";

/**
 * AI-structure a freeform prompt into RTCFC fields.
 * Body: { text: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  const parsed = parseRtcfcStructureRequest(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 },
    );
  }

  const forceOffline = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  try {
    const result = await runRtcfcStructure(parsed.data, request.signal, { forceOffline });
    return NextResponse.json({
      success: true,
      data: result.data,
      model: result.model,
      responseId: result.responseId,
      cached: result.cached,
    });
  } catch (err) {
    if (err instanceof APIUserAbortError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (
      err instanceof RtcfcStructureConfigError ||
      err instanceof RtcfcStructureUpstreamError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.warn(
      `[rtcfc-structure] failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { success: false, error: "Could not structure prompt" },
      { status: 502 },
    );
  }
}
