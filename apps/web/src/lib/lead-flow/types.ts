import { z } from "zod";

export const placeContactRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  placeId: z.string().trim().min(1).max(256),
  placeName: z.string().trim().min(1).max(500),
  formattedAddress: z.string().trim().max(1000).optional(),
  mapsUri: z.string().url().optional(),
});

export type PlaceContactRequest = z.infer<typeof placeContactRequestSchema>;

export const leadFlowInboundLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  channel_id: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
  address: z.string().optional(),
  source: z.string().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export type LeadFlowInboundLead = z.infer<typeof leadFlowInboundLeadSchema>;

export const leadFlowCreateResponseSchema = z.object({
  id: z.string().min(1),
  created: z.boolean().optional(),
});

export type LeadFlowCreateResponse = z.infer<typeof leadFlowCreateResponseSchema>;

/** Map a Places contact form payload to Lead Flow inbound lead body. */
export function toInboundLeadPayload(
  input: PlaceContactRequest,
  channelId: string,
): LeadFlowInboundLead {
  const custom_fields: Record<string, unknown> = {
    placeId: input.placeId,
    placeName: input.placeName,
  };
  if (input.mapsUri) custom_fields.mapsUri = input.mapsUri;

  return {
    name: input.name,
    email: input.email.toLowerCase(),
    company: input.placeName,
    channel_id: channelId,
    phone: input.phone || undefined,
    notes: input.notes || undefined,
    address: input.formattedAddress || undefined,
    source: "shapeshift-places",
    custom_fields,
  };
}
