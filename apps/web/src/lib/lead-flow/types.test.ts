import { describe, expect, test } from "bun:test";
import { placeContactRequestSchema, toInboundLeadPayload } from "./types";

const base = {
  name: "Nguyen Van A",
  email: "A@Example.COM",
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
  test("maps place to company and lowercases email", () => {
    const input = placeContactRequestSchema.parse(base);
    const payload = toInboundLeadPayload(input, "ch-35ed1c04");
    expect(payload).toEqual({
      name: "Nguyen Van A",
      email: "a@example.com",
      company: "Cafe ABC",
      channel_id: "ch-35ed1c04",
      phone: "+84901234567",
      notes: "Met on site",
      address: "123 Nguyen Hue, HCMC",
      source: "shapeshift-places",
      custom_fields: {
        placeId: "ChIJ_test",
        placeName: "Cafe ABC",
        mapsUri: "https://maps.example.com/place",
      },
    });
  });

  test("omits empty optional fields", () => {
    const input = placeContactRequestSchema.parse({
      name: "B",
      email: "b@example.com",
      placeId: "p1",
      placeName: "Shop",
    });
    const payload = toInboundLeadPayload(input, "ch-x");
    expect(payload.phone).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.address).toBeUndefined();
    expect(payload.custom_fields).toEqual({ placeId: "p1", placeName: "Shop" });
  });
});
