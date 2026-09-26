import { describe, expect, test } from "bun:test";
import { parseNewsPatchBody } from "./newsPatch";

describe("parseNewsPatchBody", () => {
  test("parses pin body", () => {
    expect(parseNewsPatchBody({ id: "abc", pinned: true })).toEqual({
      kind: "pin",
      id: "abc",
      pinned: true,
    });
  });

  test("parses read body", () => {
    expect(parseNewsPatchBody({ id: "abc", read: false })).toEqual({
      kind: "read",
      id: "abc",
      read: false,
    });
  });

  test("rejects missing id", () => {
    expect(parseNewsPatchBody({ pinned: true })).toBeNull();
  });

  test("rejects both pinned and read", () => {
    expect(parseNewsPatchBody({ id: "abc", pinned: true, read: true })).toBeNull();
  });

  test("rejects neither field", () => {
    expect(parseNewsPatchBody({ id: "abc" })).toBeNull();
  });

  test("trims id", () => {
    expect(parseNewsPatchBody({ id: "  xyz  ", read: true })).toEqual({
      kind: "read",
      id: "xyz",
      read: true,
    });
  });
});
