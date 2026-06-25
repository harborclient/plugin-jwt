import type { HttpResponse } from "@harborclient/sdk";
import {
  decodeJwt,
  hasJwtStructure,
  isJwtDecodeError,
  stripBearerPrefix,
} from "./decode";

/**
 * Source location for a JWT found in an HTTP response.
 */
export type JwtCandidateSource = "header" | "body";

/**
 * A JWT string discovered in a response with a display label and stable id.
 */
export interface JwtCandidate {
  id: string;
  raw: string;
  label: string;
  source: JwtCandidateSource;
}

const JWT_REGEX =
  /(?:Bearer\s+)?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;

const KNOWN_JSON_KEYS = new Set([
  "access_token",
  "id_token",
  "token",
  "jwt",
  "refresh_token",
]);

const HEADER_NAMES: Array<{ name: string; label: string }> = [
  { name: "authorization", label: "Authorization" },
  { name: "www-authenticate", label: "WWW-Authenticate" },
  { name: "x-access-token", label: "X-Access-Token" },
  { name: "x-auth-token", label: "X-Auth-Token" },
  { name: "id-token", label: "Id-Token" },
];

const MAX_JSON_DEPTH = 10;

/**
 * Returns true when the token decodes to valid JWT header and payload objects.
 *
 * @param token - Candidate JWT string.
 */
function isStructurallyValidJwt(token: string): boolean {
  if (!hasJwtStructure(token)) {
    return false;
  }
  const result = decodeJwt(token);
  return !isJwtDecodeError(result);
}

/**
 * Adds a candidate when the token passes structural validation.
 *
 * @param candidates - Mutable candidate list.
 * @param raw - Token string to validate and append.
 * @param label - Human-readable source label.
 * @param source - Header or body origin.
 */
function tryAddCandidate(
  candidates: JwtCandidate[],
  raw: string,
  label: string,
  source: JwtCandidateSource
): void {
  const normalized = stripBearerPrefix(raw);
  if (!isStructurallyValidJwt(normalized)) {
    return;
  }
  candidates.push({
    id: `${source}:${label}:${normalized}`,
    raw: normalized,
    label,
    source,
  });
}

/**
 * Finds a response header value by case-insensitive name.
 *
 * @param headers - Response header rows from the plugin context.
 * @param name - Header name to match.
 */
function findHeaderValue(
  headers: Array<{ key: string; value: string }>,
  name: string
): string | undefined {
  const row = headers.find(
    (header) => header.key.toLowerCase() === name.toLowerCase()
  );
  return row?.value;
}

/**
 * Extracts JWT candidates from auth-related response headers.
 *
 * @param headers - Response header rows.
 */
function extractFromHeaders(
  headers: Array<{ key: string; value: string }>
): JwtCandidate[] {
  const candidates: JwtCandidate[] = [];

  for (const { name, label } of HEADER_NAMES) {
    const value = findHeaderValue(headers, name);
    if (!value) {
      continue;
    }

    if (name === "www-authenticate") {
      const matches = value.matchAll(JWT_REGEX);
      for (const match of matches) {
        tryAddCandidate(candidates, match[1], label, "header");
      }
      continue;
    }

    tryAddCandidate(candidates, value, label, "header");
  }

  return candidates;
}

/**
 * Extracts JWT candidates from a whole response body string.
 *
 * @param body - Raw response body.
 */
function extractWholeBody(body: string): JwtCandidate[] {
  const candidates: JwtCandidate[] = [];
  const trimmed = body.trim();
  if (!trimmed) {
    return candidates;
  }

  tryAddCandidate(candidates, trimmed, "Body", "body");
  return candidates;
}

/**
 * Walks a parsed JSON value and collects JWT-shaped strings.
 *
 * @param value - Parsed JSON node.
 * @param path - JSONPath-style prefix for labels.
 * @param depth - Current recursion depth.
 * @param candidates - Mutable candidate list.
 */
function walkJsonValue(
  value: unknown,
  path: string,
  depth: number,
  candidates: JwtCandidate[]
): void {
  if (depth > MAX_JSON_DEPTH) {
    return;
  }

  if (typeof value === "string") {
    const pathSegments = path.split(".");
    const fieldKey = pathSegments[pathSegments.length - 1] ?? path;
    const label =
      pathSegments.length === 2 && KNOWN_JSON_KEYS.has(fieldKey.toLowerCase())
        ? `Body · ${fieldKey}`
        : `Body · ${path}`;
    tryAddCandidate(candidates, value, label, "body");
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkJsonValue(item, `${path}[${index}]`, depth + 1, candidates);
    });
    return;
  }

  if (typeof value === "object" && value != null) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path === "$" ? `$.${key}` : `${path}.${key}`;
      walkJsonValue(nested, nextPath, depth + 1, candidates);
    }
  }
}

/**
 * Extracts JWT candidates from a JSON response body.
 *
 * @param body - Raw response body.
 */
function extractFromJsonBody(body: string): JwtCandidate[] {
  const candidates: JwtCandidate[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return candidates;
  }

  walkJsonValue(parsed, "$", 0, candidates);
  return candidates;
}

/**
 * Extracts JWT candidates from raw text using regex fallback.
 *
 * @param body - Raw response body.
 */
function extractByRegex(body: string): JwtCandidate[] {
  const candidates: JwtCandidate[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(JWT_REGEX)) {
    const token = match[1];
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    tryAddCandidate(candidates, token, "Body · match", "body");
  }

  return candidates;
}

/**
 * Extracts JWT candidates from the response body using layered strategies.
 *
 * @param body - Raw response body.
 */
function extractFromBody(body: string): JwtCandidate[] {
  const whole = extractWholeBody(body);
  if (whole.length > 0) {
    return whole;
  }

  const fromJson = extractFromJsonBody(body);
  if (fromJson.length > 0) {
    return fromJson;
  }

  return extractByRegex(body);
}

/**
 * Deduplicates candidates by raw token string while preserving first label.
 *
 * @param candidates - Candidate list with possible duplicates.
 */
function dedupeCandidates(candidates: JwtCandidate[]): JwtCandidate[] {
  const byRaw = new Map<string, JwtCandidate>();
  for (const candidate of candidates) {
    if (!byRaw.has(candidate.raw)) {
      byRaw.set(candidate.raw, candidate);
    }
  }
  return [...byRaw.values()];
}

/**
 * Scans an HTTP response for JWTs in headers and body.
 *
 * @param response - Last response from the plugin tab context, if any.
 */
export function extractJwtCandidates(
  response: HttpResponse | null
): JwtCandidate[] {
  if (!response) {
    return [];
  }

  const candidates = [
    ...extractFromHeaders(response.headers),
    ...extractFromBody(response.body),
  ];
  return dedupeCandidates(candidates);
}

/**
 * Truncates a JWT for compact list display.
 *
 * @param token - Full JWT string.
 */
export function truncateJwt(token: string): string {
  if (token.length <= 16) {
    return token;
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
