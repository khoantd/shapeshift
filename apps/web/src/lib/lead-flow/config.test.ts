import { describe, expect, test } from "bun:test";
import {
  getLeadFlowBaseUrl,
  getLeadFlowChannelId,
  leadFlowConfigured,
  missingLeadFlowConfigMessage,
} from "./config";

describe("lead-flow config", () => {
  test("defaults base URL and channel when unset", () => {
    const prevBase = process.env.LEAD_FLOW_BASE_URL;
    const prevChannel = process.env.LEAD_FLOW_CHANNEL_ID;
    const prevKey = process.env.LEAD_FLOW_API_KEY;
    try {
      delete process.env.LEAD_FLOW_BASE_URL;
      delete process.env.LEAD_FLOW_CHANNEL_ID;
      delete process.env.LEAD_FLOW_API_KEY;
      expect(getLeadFlowBaseUrl()).toBe("https://lead-flow-gilt.vercel.app");
      expect(getLeadFlowChannelId()).toBe("ch-35ed1c04");
      expect(leadFlowConfigured()).toBe(false);
      expect(missingLeadFlowConfigMessage()).toContain("LEAD_FLOW_API_KEY");
    } finally {
      if (prevBase === undefined) delete process.env.LEAD_FLOW_BASE_URL;
      else process.env.LEAD_FLOW_BASE_URL = prevBase;
      if (prevChannel === undefined) delete process.env.LEAD_FLOW_CHANNEL_ID;
      else process.env.LEAD_FLOW_CHANNEL_ID = prevChannel;
      if (prevKey === undefined) delete process.env.LEAD_FLOW_API_KEY;
      else process.env.LEAD_FLOW_API_KEY = prevKey;
    }
  });

  test("strips trailing slash on base URL", () => {
    const prev = process.env.LEAD_FLOW_BASE_URL;
    try {
      process.env.LEAD_FLOW_BASE_URL = "https://example.com/lf/";
      expect(getLeadFlowBaseUrl()).toBe("https://example.com/lf");
    } finally {
      if (prev === undefined) delete process.env.LEAD_FLOW_BASE_URL;
      else process.env.LEAD_FLOW_BASE_URL = prev;
    }
  });
});
