import {
  createInboundLead,
  LeadFlowApiError,
  LeadFlowConfigError,
  leadFlowConfigured,
  missingLeadFlowConfigMessage,
  placeContactRequestSchema,
} from "@/lib/lead-flow/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!leadFlowConfigured()) {
    return Response.json(
      {
        success: false,
        error: { code: "LEAD_FLOW_CONFIG", message: missingLeadFlowConfigMessage() },
      },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" },
      },
      { status: 400 },
    );
  }

  const parsed = placeContactRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid contact payload",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  try {
    const result = await createInboundLead(parsed.data, req.signal);
    return Response.json({ success: true, leadId: result.id }, { status: 201 });
  } catch (e) {
    if (e instanceof LeadFlowConfigError) {
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status: 503 },
      );
    }
    if (e instanceof LeadFlowApiError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return Response.json(
        { success: false, error: { code: e.code, message: e.message } },
        { status },
      );
    }
    if (e instanceof Error && e.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return Response.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create Lead Flow contact" },
      },
      { status: 500 },
    );
  }
}
