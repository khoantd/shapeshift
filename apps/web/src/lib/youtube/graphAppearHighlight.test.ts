import { describe, expect, test } from "bun:test";
import { newlyAppearedNodeIds } from "./graphAppearHighlight";

describe("newlyAppearedNodeIds", () => {
  test("returns empty when previous set is empty (initial mount)", () => {
    expect(newlyAppearedNodeIds(new Set(), ["a", "b"])).toEqual([]);
  });

  test("returns only newly added ids", () => {
    expect(newlyAppearedNodeIds(new Set(["a", "b"]), ["a", "b", "c"])).toEqual([
      "c",
    ]);
  });

  test("returns empty when no change", () => {
    expect(newlyAppearedNodeIds(new Set(["a"]), ["a"])).toEqual([]);
  });

  test("ignores removals", () => {
    expect(newlyAppearedNodeIds(new Set(["a", "b"]), ["b"])).toEqual([]);
  });

  test("returns multiple new ids in encounter order", () => {
    expect(
      newlyAppearedNodeIds(new Set(["v"]), ["v", "c1", "t1"]),
    ).toEqual(["c1", "t1"]);
  });
});
