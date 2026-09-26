import { describe, expect, test } from "bun:test";
import { isJwtUnexpired } from "./jwt";

function fakeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("isJwtUnexpired", () => {
  test("true when exp is more than 60s ahead", () => {
    const now = 1_700_000_000_000;
    const token = fakeJwt(Math.floor(now / 1000) + 120);
    expect(isJwtUnexpired(token, now)).toBe(true);
  });

  test("false when exp is within 60s or past", () => {
    const now = 1_700_000_000_000;
    expect(isJwtUnexpired(fakeJwt(Math.floor(now / 1000) + 30), now)).toBe(false);
    expect(isJwtUnexpired(fakeJwt(Math.floor(now / 1000) - 10), now)).toBe(false);
  });

  test("false for garbage tokens", () => {
    expect(isJwtUnexpired("not-a-jwt")).toBe(false);
    expect(isJwtUnexpired("a.b.c")).toBe(false);
  });
});
