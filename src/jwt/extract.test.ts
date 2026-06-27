import { describe, expect, it } from 'vitest';
import type { HttpResponse } from '@harborclient/sdk';
import { extractJwtCandidates } from './extract';

/**
 * Encodes a UTF-8 string as base64url without padding.
 *
 * @param value - String to encode.
 */
function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds a JWT string from header and payload objects for tests.
 *
 * @param header - JWT header object.
 * @param payload - JWT payload object.
 */
function makeJwt(header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.signature`;
}

const sampleToken = makeJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '123', exp: 4_102_444_800 });
const sampleIdToken = makeJwt({ alg: 'RS256', typ: 'JWT' }, { sub: '456', exp: 4_102_444_800 });

/**
 * Builds a minimal HttpResponse for extraction tests.
 *
 * @param body - Response body string.
 * @param headers - Optional header rows.
 */
function makeResponse(
  body: string,
  headers: Array<{ key: string; value: string }> = []
): HttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers,
    body,
    durationMs: 10,
    sizeBytes: body.length
  };
}

describe('extractJwtCandidates', () => {
  it('returns empty list for null response', () => {
    expect(extractJwtCandidates(null)).toEqual([]);
  });

  it('extracts access_token from OAuth JSON body', () => {
    const response = makeResponse(
      JSON.stringify({
        access_token: sampleToken,
        token_type: 'Bearer'
      })
    );

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('Body · access_token');
    expect(candidates[0]?.raw).toBe(sampleToken);
  });

  it('extracts bearer token from Authorization header', () => {
    const response = makeResponse('', [{ key: 'Authorization', value: `Bearer ${sampleToken}` }]);

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('Authorization');
    expect(candidates[0]?.source).toBe('header');
  });

  it('extracts nested JWT from JSON body', () => {
    const response = makeResponse(
      JSON.stringify({
        data: {
          session: {
            token: sampleToken
          }
        }
      })
    );

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('Body · $.data.session.token');
  });

  it('extracts a bare JWT body', () => {
    const response = makeResponse(sampleToken);
    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('Body');
  });

  it('rejects opaque refresh_token values', () => {
    const response = makeResponse(
      JSON.stringify({
        access_token: sampleToken,
        refresh_token: 'opaque-not-a-jwt'
      })
    );

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.raw).toBe(sampleToken);
  });

  it('dedupes the same token from header and body', () => {
    const response = makeResponse(JSON.stringify({ access_token: sampleToken }), [
      { key: 'Authorization', value: `Bearer ${sampleToken}` }
    ]);

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(1);
  });

  it('finds multiple distinct tokens', () => {
    const response = makeResponse(
      JSON.stringify({
        access_token: sampleToken,
        id_token: sampleIdToken
      })
    );

    const candidates = extractJwtCandidates(response);
    expect(candidates).toHaveLength(2);
  });
});
