import { describe, expect, test } from "bun:test";
import {
  mapAdvisoryItem,
  parseAdvisoriesListQuery,
  parseGhsaId,
} from "./securityAdvisories";

describe("parseAdvisoriesListQuery", () => {
  test("defaults to published / published / desc / 10", () => {
    expect(parseAdvisoriesListQuery({})).toEqual({
      state: "published",
      sort: "published",
      direction: "desc",
      perPage: 10,
    });
  });

  test("accepts valid filters and clamps perPage", () => {
    expect(
      parseAdvisoriesListQuery({
        state: "closed",
        sort: "updated",
        direction: "asc",
        perPage: "99",
      }),
    ).toEqual({
      state: "closed",
      sort: "updated",
      direction: "asc",
      perPage: 30,
    });
  });

  test("falls back on invalid enums", () => {
    expect(
      parseAdvisoriesListQuery({
        state: "nope",
        sort: "stars",
        direction: "sideways",
        perPage: "abc",
      }),
    ).toEqual({
      state: "published",
      sort: "published",
      direction: "desc",
      perPage: 10,
    });
  });
});

describe("parseGhsaId", () => {
  test("accepts and normalizes GHSA id", () => {
    expect(parseGhsaId("ghsa-abcd-efgh-ijkl")).toEqual({
      ok: true,
      ghsaId: "GHSA-ABCD-EFGH-IJKL",
    });
  });

  test("rejects invalid", () => {
    expect(parseGhsaId("CVE-2024-1234").ok).toBe(false);
    expect(parseGhsaId("").ok).toBe(false);
  });
});

describe("mapAdvisoryItem", () => {
  test("maps a published advisory", () => {
    const a = mapAdvisoryItem({
      ghsa_id: "GHSA-xxxx-yyyy-zzzz",
      cve_id: "CVE-2024-1234",
      html_url: "https://github.com/acme/widget/security/advisories/GHSA-xxxx-yyyy-zzzz",
      summary: "Prototype pollution in foo",
      severity: "high",
      state: "published",
      published_at: "2026-01-15T00:00:00Z",
      updated_at: "2026-01-16T00:00:00Z",
      vulnerabilities: [
        {
          package: { ecosystem: "npm", name: "foo" },
          vulnerable_version_range: "<1.2.3",
          patched_versions: "1.2.3",
        },
      ],
    });
    expect(a).toEqual({
      ghsaId: "GHSA-xxxx-yyyy-zzzz",
      cveId: "CVE-2024-1234",
      htmlUrl:
        "https://github.com/acme/widget/security/advisories/GHSA-xxxx-yyyy-zzzz",
      summary: "Prototype pollution in foo",
      severity: "high",
      state: "published",
      publishedAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-01-16T00:00:00Z",
      vulnerabilities: [
        {
          ecosystem: "npm",
          packageName: "foo",
          vulnerableVersionRange: "<1.2.3",
          patchedVersions: "1.2.3",
        },
      ],
    });
  });

  test("rejects incomplete", () => {
    expect(mapAdvisoryItem({ ghsa_id: "GHSA-xxxx-yyyy-zzzz" })).toBeNull();
  });

  test("null severity when missing", () => {
    const a = mapAdvisoryItem({
      ghsa_id: "GHSA-xxxx-yyyy-zzzz",
      html_url: "https://github.com/a/b/security/advisories/GHSA-xxxx-yyyy-zzzz",
      summary: "Something",
      severity: null,
    });
    expect(a?.severity).toBeNull();
    expect(a?.cveId).toBeNull();
    expect(a?.vulnerabilities).toEqual([]);
  });
});
