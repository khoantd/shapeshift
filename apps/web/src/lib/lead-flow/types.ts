import { z } from "zod";
import { getLeadFlowSourceCampaign } from "./config";

/** Lead Flow inbound `role` enum. */
export const CONTACT_ROLES = [
  { code: "influencer", label: "Influencer" },
  { code: "decision_maker", label: "Decision maker" },
  { code: "vip", label: "VIP" },
] as const;

export type ContactRoleCode = (typeof CONTACT_ROLES)[number]["code"];

export const contactRoleCodeSchema = z.enum([
  CONTACT_ROLES[0].code,
  CONTACT_ROLES[1].code,
  CONTACT_ROLES[2].code,
]);

export function contactRoleLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return CONTACT_ROLES.find((r) => r.code === code)?.label ?? code;
}

export const placeContactRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  role: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    contactRoleCodeSchema.optional(),
  ),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  placeId: z.string().trim().min(1).max(256),
  placeName: z.string().trim().min(1).max(500),
  formattedAddress: z.string().trim().max(1000).optional(),
  mapsUri: z.string().url().optional(),
});

export type PlaceContactRequest = z.infer<typeof placeContactRequestSchema>;

/**
 * Lead Flow POST /api/inbound/leads body.
 * Docs highlight channel_id, source_id, phone, name, source_campaign, timestamp, role.
 * Live API also requires company + email.
 */
export const leadFlowInboundLeadSchema = z.object({
  channel_id: z.string().min(1),
  source_id: z.string().min(1),
  name: z.string().min(1),
  company: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source_campaign: z.string().min(1),
  timestamp: z.string().min(1),
  role: contactRoleCodeSchema.optional(),
});

export type LeadFlowInboundLead = z.infer<typeof leadFlowInboundLeadSchema>;

export const leadFlowCreateResponseSchema = z.object({
  id: z.string().min(1),
  created: z.boolean().optional(),
});

export type LeadFlowCreateResponse = z.infer<typeof leadFlowCreateResponseSchema>;

export type InboundLeadOptions = {
  channelId: string;
  sourceCampaign?: string;
  /** Override for tests; defaults to crypto.randomUUID(). */
  sourceIdSuffix?: string;
  /** Override for tests; defaults to now (UTC ISO). */
  timestamp?: string;
};

/** Build a unique inbound source_id: shapeshift-places:{placeId}:{suffix}. */
export function buildLeadFlowSourceId(placeId: string, suffix?: string): string {
  const id = suffix?.trim() || crypto.randomUUID();
  return `shapeshift-places:${placeId}:${id}`;
}

/** Map a Places contact form payload to Lead Flow inbound lead body. */
export function toInboundLeadPayload(
  input: PlaceContactRequest,
  options: InboundLeadOptions | string,
): LeadFlowInboundLead {
  const opts: InboundLeadOptions =
    typeof options === "string" ? { channelId: options } : options;

  const payload: LeadFlowInboundLead = {
    channel_id: opts.channelId,
    source_id: buildLeadFlowSourceId(input.placeId, opts.sourceIdSuffix),
    name: input.name,
    company: input.placeName,
    email: input.email.toLowerCase(),
    source_campaign: opts.sourceCampaign?.trim() || getLeadFlowSourceCampaign(),
    timestamp: opts.timestamp ?? new Date().toISOString(),
  };

  if (input.phone) payload.phone = input.phone;
  if (input.role) payload.role = input.role;

  return payload;
}
