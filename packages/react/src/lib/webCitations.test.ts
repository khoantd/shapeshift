import { describe, expect, test } from "bun:test";
import {
  CITE_PROTOCOL,
  encodeWebCitations,
  faviconUrlFor,
  parseCiteHref,
  resolveCiteSources,
  sourcesLabel,
} from "./webCitations";

describe("encodeWebCitations", () => {
  test("encodes consecutive [web:N] clusters as cite links", () => {
    const out = encodeWebCitations("Claim.[web:2][web:1] More.");
    expect(out).toBe(`Claim.[sources](${CITE_PROTOCOL}2,1) More.`);
  });

  test("encodes a single citation", () => {
    expect(encodeWebCitations("See [web:3].")).toBe(`See [sources](${CITE_PROTOCOL}3).`);
  });

  test("leaves unrelated brackets alone", () => {
    expect(encodeWebCitations("Use [web] and [link](https://x.test)")).toBe(
      "Use [web] and [link](https://x.test)",
    );
  });

  test("encodes multiple separate clusters", () => {
    const out = encodeWebCitations("[web:1] then [web:3][web:2]");
    expect(out).toBe(`[sources](${CITE_PROTOCOL}1) then [sources](${CITE_PROTOCOL}3,2)`);
  });

  test("encodes [web:0] and [page:N] (Perplexity low preset)", () => {
    expect(encodeWebCitations("See [web:0].")).toBe(`See [sources](${CITE_PROTOCOL}0).`);
    expect(encodeWebCitations("From page [page:1][page:0].")).toBe(
      `From page [sources](${CITE_PROTOCOL}1,0).`,
    );
  });
});

describe("parseCiteHref", () => {
  test("parses cite protocol indices", () => {
    expect(parseCiteHref(`${CITE_PROTOCOL}2,1`)).toEqual([2, 1]);
  });

  test("returns null for non-cite hrefs", () => {
    expect(parseCiteHref("https://example.com")).toBeNull();
    expect(parseCiteHref(undefined)).toBeNull();
  });

  test("keeps 0-based indices and drops invalid", () => {
    expect(parseCiteHref(`${CITE_PROTOCOL}0,2,abc,-1`)).toEqual([0, 2]);
  });
});

describe("resolveCiteSources", () => {
  const sources = [
    { title: "A", url: "https://a.example/1" },
    { title: "B", url: "https://b.example/2" },
    { title: "A again", url: "https://a.example/1" },
  ];

  test("resolves 1-based indices in citation order when sources lack ids", () => {
    expect(resolveCiteSources([2, 1], sources)).toEqual([
      { title: "B", url: "https://b.example/2" },
      { title: "A", url: "https://a.example/1" },
    ]);
  });

  test("skips missing indices and dedupes by url", () => {
    // 1 and 3 share the same url; 9 is out of range; duplicate 1 ignored
    expect(resolveCiteSources([1, 9, 1, 3], sources)).toEqual([
      { title: "A", url: "https://a.example/1" },
    ]);
  });

  test("resolves by explicit search-result id including 0", () => {
    const withIds = [
      { id: 0, title: "Zero", url: "https://z.example/0" },
      { id: 3, title: "Three", url: "https://t.example/3" },
      { id: 6, title: "Six", url: "https://s.example/6" },
    ];
    expect(resolveCiteSources([0, 6, 3], withIds)).toEqual([
      { id: 0, title: "Zero", url: "https://z.example/0" },
      { id: 6, title: "Six", url: "https://s.example/6" },
      { id: 3, title: "Three", url: "https://t.example/3" },
    ]);
  });
});

describe("faviconUrlFor", () => {
  test("builds google s2 favicon url from hostname", () => {
    expect(faviconUrlFor("https://www.dell.com/path")).toBe(
      "https://www.google.com/s2/favicons?domain=www.dell.com&sz=32",
    );
  });

  test("returns null for invalid urls", () => {
    expect(faviconUrlFor("not-a-url")).toBeNull();
  });
});

describe("sourcesLabel", () => {
  test("pluralizes", () => {
    expect(sourcesLabel(1)).toBe("1 source");
    expect(sourcesLabel(22)).toBe("22 sources");
  });
});
