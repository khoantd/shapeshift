import {
  getLeadFlowApiKey,
  getLeadFlowBaseUrl,
  getLeadFlowChannelId,
  leadFlowConfigured,
  missingLeadFlowConfigMessage,
} from "./config";
import { LeadFlowApiError, LeadFlowConfigError } from "./errors";
import {
  leadFlowCreateResponseSchema,
  toInboundLeadPayload,
  type LeadFlowCreateResponse,
  type PlaceContactRequest,
} from "./types";

export async function createInboundLead(
  input: PlaceContactRequest,
  signal?: AbortSignal,
): Promise<LeadFlowCreateResponse> {
  if (!leadFlowConfigured()) {
    throw new LeadFlowConfigError(missingLeadFlowConfigMessage());
  }

  const baseUrl = getLeadFlowBaseUrl();
  const channelId = getLeadFlowChannelId();
  const apiKey = getLeadFlowApiKey();
  const body = toInboundLeadPayload(input, channelId);

  const res = await fetch(`${baseUrl}/api/inbound/leads`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new LeadFlowApiError("Lead Flow returned invalid JSON", res.status || 502);
    }
  }

  if (!res.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Lead Flow request failed (${res.status})`;
    throw new LeadFlowApiError(message, res.status);
  }

  const parsed = leadFlowCreateResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new LeadFlowApiError("Lead Flow response missing lead id", 502);
  }
  return parsed.data;
}
