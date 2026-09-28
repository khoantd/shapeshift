const DEFAULT_BASE_URL = "https://lead-flow-gilt.vercel.app";
const DEFAULT_CHANNEL_ID = "ch-35ed1c04";
const DEFAULT_SOURCE_CAMPAIGN = "shapeshift-places";

export function getLeadFlowApiKey(): string {
  return (process.env.LEAD_FLOW_API_KEY ?? "").trim();
}

export function getLeadFlowBaseUrl(): string {
  const raw = (process.env.LEAD_FLOW_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE_URL;
}

export function getLeadFlowChannelId(): string {
  return (process.env.LEAD_FLOW_CHANNEL_ID ?? "").trim() || DEFAULT_CHANNEL_ID;
}

/** Campaign tag sent as `source_campaign` on inbound leads. */
export function getLeadFlowSourceCampaign(): string {
  return (process.env.LEAD_FLOW_SOURCE_CAMPAIGN ?? "").trim() || DEFAULT_SOURCE_CAMPAIGN;
}

export function leadFlowConfigured(): boolean {
  return Boolean(getLeadFlowApiKey());
}

export function missingLeadFlowConfigMessage(): string {
  return "LEAD_FLOW_API_KEY is not set. Add an inbound API key from Lead Flow (Organization → API keys) to apps/web/.env.";
}
