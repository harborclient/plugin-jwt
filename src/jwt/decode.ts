/**
 * Result of successfully decoding a JWT header and payload.
 */
export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  warnings: string[];
}

/**
 * Decode failure with a user-facing message.
 */
export interface JwtDecodeError {
  error: string;
}

/**
 * Decoded JWT or a structured decode error.
 */
export type JwtDecodeResult = DecodedJwt | JwtDecodeError;

const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const CLOCK_SKEW_MS = 60_000;

/**
 * Returns true when a value looks like a JWT decode error result.
 *
 * @param result - Decode output from {@link decodeJwt}.
 */
export function isJwtDecodeError(
  result: JwtDecodeResult
): result is JwtDecodeError {
  return "error" in result;
}

/**
 * Decodes a base64url string to UTF-8 text.
 *
 * @param value - Base64url segment from a JWT.
 */
export function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLength);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Returns true when the string has exactly three base64url JWT segments.
 *
 * @param token - Candidate JWT string.
 */
export function hasJwtStructure(token: string): boolean {
  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return false;
  }
  return parts.every(
    (part) => part.length > 0 && JWT_SEGMENT_PATTERN.test(part)
  );
}

/**
 * Strips an optional Bearer prefix and surrounding whitespace.
 *
 * @param value - Header or body value that may include a Bearer prefix.
 */
export function stripBearerPrefix(value: string): string {
  return value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/**
 * Parses a numeric JWT time claim (seconds since epoch) to milliseconds.
 *
 * @param claim - Claim value from header or payload.
 */
function claimToMs(claim: unknown): number | null {
  if (typeof claim === "number" && Number.isFinite(claim)) {
    return claim * 1000;
  }
  return null;
}

/**
 * Collects non-blocking validation warnings from decoded header and payload claims.
 *
 * @param header - Parsed JWT header object.
 * @param payload - Parsed JWT payload object.
 * @param nowMs - Current time for expiry checks.
 */
function collectWarnings(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  nowMs: number
): string[] {
  const warnings: string[] = [];

  if (typeof header.alg !== "string" || header.alg.trim() === "") {
    warnings.push("No alg claim in header.");
  }

  const expMs = claimToMs(payload.exp);
  if (expMs != null && expMs <= nowMs) {
    warnings.push("Expired.");
  }

  const nbfMs = claimToMs(payload.nbf);
  if (nbfMs != null && nbfMs > nowMs) {
    warnings.push("Not yet valid.");
  }

  const iatMs = claimToMs(payload.iat);
  if (iatMs != null && iatMs > nowMs + CLOCK_SKEW_MS) {
    warnings.push("Issued in the future.");
  }

  return warnings;
}

/**
 * Decodes a JWT string into header and payload objects without verifying the signature.
 *
 * @param token - Raw JWT string, optionally prefixed with Bearer.
 * @param nowMs - Current time for expiry warnings; defaults to Date.now().
 */
export function decodeJwt(
  token: string,
  nowMs: number = Date.now()
): JwtDecodeResult {
  const raw = stripBearerPrefix(token);
  if (!hasJwtStructure(raw)) {
    return { error: "Malformed JWT: expected three base64url segments." };
  }

  const [encodedHeader, encodedPayload] = raw.split(".");

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    const parsedHeader = JSON.parse(base64UrlDecode(encodedHeader)) as unknown;
    if (
      typeof parsedHeader !== "object" ||
      parsedHeader == null ||
      Array.isArray(parsedHeader)
    ) {
      return { error: "Malformed JWT: header is not a JSON object." };
    }
    header = parsedHeader as Record<string, unknown>;
  } catch {
    return { error: "Malformed JWT: header could not be decoded." };
  }

  try {
    const parsedPayload = JSON.parse(
      base64UrlDecode(encodedPayload)
    ) as unknown;
    if (
      typeof parsedPayload !== "object" ||
      parsedPayload == null ||
      Array.isArray(parsedPayload)
    ) {
      return { error: "Malformed JWT: payload is not a JSON object." };
    }
    payload = parsedPayload as Record<string, unknown>;
  } catch {
    return { error: "Malformed JWT: payload could not be decoded." };
  }

  return {
    header,
    payload,
    warnings: collectWarnings(header, payload, nowMs),
  };
}

/**
 * Formats a JWT time claim as a locale date/time string when numeric.
 *
 * @param claim - Claim value from the payload.
 */
export function formatJwtTimeClaim(claim: unknown): string | null {
  const ms = claimToMs(claim);
  if (ms == null) {
    return null;
  }
  return new Date(ms).toLocaleString();
}
