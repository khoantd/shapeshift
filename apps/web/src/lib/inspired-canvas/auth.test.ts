import { describe, expect, test } from "bun:test";
import { isJwtUnexpired, jwtSub } from "./jwt";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("isJwtUnexpired", () => {
  test("true when exp is more than 60s ahead", () => {
    const now = 1_700_000_000_000;
    const token = fakeJwt({ exp: Math.floor(now / 1000) + 120 });
    expect(isJwtUnexpired(token, now)).toBe(true);
  });

  test("false when exp is within 60s or past", () => {
    const now = 1_700_000_000_000;
    expect(isJwtUnexpired(fakeJwt({ exp: Math.floor(now / 1000) + 30 }), now)).toBe(false);
    expect(isJwtUnexpired(fakeJwt({ exp: Math.floor(now / 1000) - 10 }), now)).toBe(false);
  });

  test("false for garbage tokens", () => {
    expect(isJwtUnexpired("not-a-jwt")).toBe(false);
    expect(isJwtUnexpired("a.b.c")).toBe(false);
  });
});

describe("jwtSub", () => {
  test("returns sub claim", () => {
    expect(jwtSub(fakeJwt({ sub: "user-123", exp: 9_999_999_999 }))).toBe("user-123");
  });

  test("null when missing", () => {
    expect(jwtSub(fakeJwt({ exp: 9_999_999_999 }))).toBeNull();
    expect(jwtSub("nope")).toBeNull();
  });
});
