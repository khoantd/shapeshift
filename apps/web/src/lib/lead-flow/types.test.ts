import { describe, expect, test } from "bun:test";
import {
  buildLeadFlowSourceId,
  placeContactRequestSchema,
  toInboundLeadPayload,
} from "./types";

const base = {
  name: "Nguyen Van A",
  email: "A@Example.COM",
  role: "decision_maker" as const,
  phone: "+84901234567",
  notes: "Met on site",
  placeId: "ChIJ_test",
  placeName: "Cafe ABC",
  formattedAddress: "123 Nguyen Hue, HCMC",
  mapsUri: "https://maps.example.com/place",
};

describe("placeContactRequestSchema", () => {
  test("accepts a valid payload", () => {
    const parsed = placeContactRequestSchema.parse(base);
    expect(parsed.email).toBe("A@Example.COM");
    expect(parsed.placeName).toBe("Cafe ABC");
    expect(parsed.role).toBe("decision_maker");
  });

  test("rejects unknown role code", () => {
    expect(placeContactRequestSchema.safeParse({ ...base, role: "Manager" }).success).toBe(false);
  });

  test("rejects missing email", () => {
    const { email: _, ...rest } = base;
    expect(placeContactRequestSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects empty name", () => {
    expect(placeContactRequestSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });
});

describe("toInboundLeadPayload", () => {
  test("maps to new inbound lead shape", () => {
    const input = placeContactRequestSchema.parse(base);
    const payload = toInboundLeadPayload(input, {
      channelId: "ch-35ed1c04",
      sourceCampaign: "shapeshift-places",
      sourceIdSuffix: "fixed-suffix",
      timestamp: "2026-04-03T12:00:00.000Z",
    });
    expect(payload).toEqual({
      channel_id: "ch-35ed1c04",
      source_id: "shapeshift-places:ChIJ_test:fixed-suffix",
      name: "Nguyen Van A",
      company: "Cafe ABC",
      email: "a@example.com",
      phone: "+84901234567",
      source_campaign: "shapeshift-places",
      timestamp: "2026-04-03T12:00:00.000Z",
      role: "decision_maker",
    });
  });

  test("omits optional phone and role", () => {
    const input = placeContactRequestSchema.parse({
      name: "B",
      email: "b@example.com",
      placeId: "p1",
      placeName: "Shop",
    });
    const payload = toInboundLeadPayload(input, {
      channelId: "ch-x",
      sourceIdSuffix: "s1",
      timestamp: "2026-04-03T12:00:00.000Z",
      sourceCampaign: "shapeshift-places",
    });
    expect(payload.phone).toBeUndefined();
    expect(payload.role).toBeUndefined();
    expect(payload.source_id).toBe("shapeshift-places:p1:s1");
    expect(payload.company).toBe("Shop");
  });

  test("buildLeadFlowSourceId prefixes place id", () => {
    expect(buildLeadFlowSourceId("place-1", "abc")).toBe("shapeshift-places:place-1:abc");
  });
});
