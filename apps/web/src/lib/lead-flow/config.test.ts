import { describe, expect, test } from "bun:test";
import {
  getLeadFlowBaseUrl,
  getLeadFlowChannelId,
  getLeadFlowSourceCampaign,
  leadFlowConfigured,
  missingLeadFlowConfigMessage,
} from "./config";

describe("lead-flow config", () => {
  test("defaults base URL, channel, and campaign when unset", () => {
    const prevBase = process.env.LEAD_FLOW_BASE_URL;
    const prevChannel = process.env.LEAD_FLOW_CHANNEL_ID;
    const prevCampaign = process.env.LEAD_FLOW_SOURCE_CAMPAIGN;
    const prevKey = process.env.LEAD_FLOW_API_KEY;
    try {
      delete process.env.LEAD_FLOW_BASE_URL;
      delete process.env.LEAD_FLOW_CHANNEL_ID;
      delete process.env.LEAD_FLOW_SOURCE_CAMPAIGN;
      delete process.env.LEAD_FLOW_API_KEY;
      expect(getLeadFlowBaseUrl()).toBe("https://lead-flow-gilt.vercel.app");
      expect(getLeadFlowChannelId()).toBe("ch-35ed1c04");
      expect(getLeadFlowSourceCampaign()).toBe("shapeshift-places");
      expect(leadFlowConfigured()).toBe(false);
      expect(missingLeadFlowConfigMessage()).toContain("LEAD_FLOW_API_KEY");
    } finally {
      if (prevBase === undefined) delete process.env.LEAD_FLOW_BASE_URL;
      else process.env.LEAD_FLOW_BASE_URL = prevBase;
      if (prevChannel === undefined) delete process.env.LEAD_FLOW_CHANNEL_ID;
      else process.env.LEAD_FLOW_CHANNEL_ID = prevChannel;
      if (prevCampaign === undefined) delete process.env.LEAD_FLOW_SOURCE_CAMPAIGN;
      else process.env.LEAD_FLOW_SOURCE_CAMPAIGN = prevCampaign;
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
