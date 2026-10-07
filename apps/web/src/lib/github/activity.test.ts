import { describe, expect, test } from "bun:test";
import {
  mapReleaseItem,
  mergeReleases,
  parseRepoFullNames,
} from "./activity";

describe("parseRepoFullNames", () => {
  test("parses comma list and strips github URLs", () => {
    expect(
      parseRepoFullNames(
        "acme/widget,https://github.com/foo/bar,bad,acme/widget",
      ),
    ).toEqual(["acme/widget", "foo/bar"]);
  });

  test("caps length", () => {
    const many = Array.from({ length: 20 }, (_, i) => `org/repo${i}`);
    expect(parseRepoFullNames(many, 3)).toHaveLength(3);
  });
});

describe("mapReleaseItem", () => {
  test("maps a release", () => {
    const r = mapReleaseItem("acme/widget", {
      id: 9,
      tag_name: "v1.0.0",
      name: "One",
      html_url: "https://github.com/acme/widget/releases/tag/v1.0.0",
      published_at: "2026-10-01T00:00:00Z",
      prerelease: false,
    });
    expect(r?.tagName).toBe("v1.0.0");
    expect(r?.repoFullName).toBe("acme/widget");
  });

  test("rejects incomplete", () => {
    expect(mapReleaseItem("a/b", { id: 1 })).toBeNull();
  });
});

describe("mergeReleases", () => {
  test("sorts newest first", () => {
    const older = mapReleaseItem("a/b", {
      id: 1,
      tag_name: "v1",
      html_url: "https://github.com/a/b/releases/tag/v1",
      published_at: "2026-01-01T00:00:00Z",
    })!;
    const newer = mapReleaseItem("c/d", {
      id: 2,
      tag_name: "v2",
      html_url: "https://github.com/c/d/releases/tag/v2",
      published_at: "2026-10-01T00:00:00Z",
    })!;
    expect(
      mergeReleases([
        { repoFullName: "a/b", releases: [older] },
        { repoFullName: "c/d", releases: [newer] },
      ]).map((r) => r.id),
    ).toEqual([2, 1]);
  });
});
