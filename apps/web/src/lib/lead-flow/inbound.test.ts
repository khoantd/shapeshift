import { afterEach, describe, expect, mock, test } from "bun:test";
import { LeadFlowApiError, LeadFlowConfigError } from "./errors";
import { createInboundLead } from "./inbound";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("createInboundLead", () => {
  test("throws config error when API key missing", async () => {
    const prev = process.env.LEAD_FLOW_API_KEY;
    try {
      delete process.env.LEAD_FLOW_API_KEY;
      await expect(
        createInboundLead({
          name: "A",
          email: "a@example.com",
          placeId: "p1",
          placeName: "Shop",
        }),
      ).rejects.toBeInstanceOf(LeadFlowConfigError);
    } finally {
      if (prev === undefined) delete process.env.LEAD_FLOW_API_KEY;
      else process.env.LEAD_FLOW_API_KEY = prev;
    }
  });

  test("posts to inbound/leads and returns id", async () => {
    const prevKey = process.env.LEAD_FLOW_API_KEY;
    const prevChannel = process.env.LEAD_FLOW_CHANNEL_ID;
    try {
      process.env.LEAD_FLOW_API_KEY = "lf_test_key";
      process.env.LEAD_FLOW_CHANNEL_ID = "ch-35ed1c04";

      globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toContain("/api/inbound/leads");
        expect(init?.method).toBe("POST");
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer lf_test_key");
        const body = JSON.parse(String(init?.body));
        expect(body.company).toBe("Cafe ABC");
        expect(body.channel_id).toBe("ch-35ed1c04");
        return new Response(JSON.stringify({ id: "lead-123", created: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const result = await createInboundLead({
        name: "Nguyen Van A",
        email: "a@example.com",
        placeId: "ChIJ_test",
        placeName: "Cafe ABC",
      });
      expect(result).toEqual({ id: "lead-123", created: true });
    } finally {
      if (prevKey === undefined) delete process.env.LEAD_FLOW_API_KEY;
      else process.env.LEAD_FLOW_API_KEY = prevKey;
      if (prevChannel === undefined) delete process.env.LEAD_FLOW_CHANNEL_ID;
      else process.env.LEAD_FLOW_CHANNEL_ID = prevChannel;
    }
  });

  test("maps Lead Flow error body to LeadFlowApiError", async () => {
    const prev = process.env.LEAD_FLOW_API_KEY;
    try {
      process.env.LEAD_FLOW_API_KEY = "lf_test_key";
      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;

      try {
        await createInboundLead({
          name: "A",
          email: "a@example.com",
          placeId: "p1",
          placeName: "Shop",
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(LeadFlowApiError);
        expect((e as LeadFlowApiError).message).toBe("email is required");
        expect((e as LeadFlowApiError).status).toBe(400);
      }
    } finally {
      if (prev === undefined) delete process.env.LEAD_FLOW_API_KEY;
      else process.env.LEAD_FLOW_API_KEY = prev;
    }
  });
});
