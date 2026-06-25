import { describe, expect, it } from "vitest";
import { decodeJwt, hasJwtStructure, isJwtDecodeError } from "./decode";

/**
 * Encodes a UTF-8 string as base64url without padding.
 *
 * @param value - String to encode.
 */
function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds a JWT string from header and payload objects for tests.
 *
 * @param header - JWT header object.
 * @param payload - JWT payload object.
 */
function makeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.signature`;
}

describe("hasJwtStructure", () => {
  it("accepts three base64url segments", () => {
    expect(hasJwtStructure("aaa.bbb.ccc")).toBe(true);
  });

  it("rejects wrong segment count", () => {
    expect(hasJwtStructure("aaa.bbb")).toBe(false);
  });
});

describe("decodeJwt", () => {
  it("decodes a valid JWT header and payload", () => {
    const token = makeJwt(
      { alg: "HS256", typ: "JWT" },
      { sub: "user-1", exp: 4_102_444_800 }
    );
    const result = decodeJwt(token, 0);

    expect(isJwtDecodeError(result)).toBe(false);
    if (isJwtDecodeError(result)) {
      return;
    }

    expect(result.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(result.payload.sub).toBe("user-1");
    expect(result.warnings).toEqual([]);
  });

  it("warns when exp is in the past", () => {
    const token = makeJwt({ alg: "HS256" }, { exp: 1 });
    const result = decodeJwt(token, 2_000);

    expect(isJwtDecodeError(result)).toBe(false);
    if (isJwtDecodeError(result)) {
      return;
    }

    expect(result.warnings).toContain("Expired.");
  });

  it("returns an error for malformed segments", () => {
    const result = decodeJwt("not-a-jwt");
    expect(isJwtDecodeError(result)).toBe(true);
    if (!isJwtDecodeError(result)) {
      return;
    }
    expect(result.error).toMatch(/three base64url segments/i);
  });
});
