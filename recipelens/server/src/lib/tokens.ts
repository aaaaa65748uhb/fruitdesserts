/**
 * Compact HMAC-signed session tokens (JWT-shaped, HS256).
 * Implemented locally so the auth surface stays small and auditable.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionClaims {
  /** user id */
  sub: string;
  /** token version — bumping it on the user row invalidates old sessions */
  tv: number;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(claims: Omit<SessionClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = { ...claims, iat, exp: iat + ttlSeconds };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export function verifySessionToken(token: string, secret: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad-signature' };

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof claims?.sub !== 'string' || typeof claims?.exp !== 'number' || typeof claims?.tv !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.exp * 1000 <= Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, claims };
}
