/**
 * Google Sign-In: verification of the ID token the client obtains from Google.
 *
 * The token is checked server-side against Google's published keys — signature,
 * issuer, audience and expiry — because a client-supplied identity is never
 * trusted on its own. Nothing here needs (or stores) a client secret.
 */
import { createPublicKey, createVerify, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';

export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

interface KeyCache {
  keys: Jwk[];
  expiresAt: number;
}

export interface VerifyGoogleOptions {
  clientId: string;
  jwksUrl?: string;
  fetchImpl?: typeof fetch;
  /** Injected in tests so expiry can be exercised deterministically. */
  now?: () => number;
}

const cache = new Map<string, KeyCache>();

async function loadKeys(url: string, fetchImpl: typeof fetch): Promise<Jwk[]> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  } catch (cause) {
    throw new ApiError(502, 'SOURCE_UNREACHABLE', 'Could not reach Google to verify the sign-in.', { cause, retryable: true });
  }
  if (!response.ok) {
    throw new ApiError(502, 'SOURCE_UNREACHABLE', 'Google did not return its signing keys.', { retryable: true });
  }

  const payload = (await response.json()) as { keys?: Jwk[] };
  const keys = payload.keys ?? [];
  // Google rotates these; cache for the lifetime the response advertises.
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cache.set(url, { keys, expiresAt: Date.now() + Math.min(Math.max(maxAge, 60), 86400) * 1000 });
  return keys;
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

const invalidToken = (detail: string) =>
  new ApiError(401, 'UNAUTHORIZED', 'That Google sign-in could not be verified.', { details: { reason: detail } });

/** Verifies a Google ID token and returns the identity it asserts. */
export async function verifyGoogleIdToken(idToken: string, options: VerifyGoogleOptions): Promise<GoogleIdentity> {
  const now = options.now ?? Date.now;
  const parts = idToken.split('.');
  if (parts.length !== 3) throw invalidToken('malformed token');

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = decodeSegment(headerB64) as { alg?: string; kid?: string };
    claims = decodeSegment(payloadB64) as Record<string, unknown>;
  } catch {
    throw invalidToken('malformed token');
  }

  if (header.alg !== 'RS256') throw invalidToken('unsupported algorithm');

  const keys = await loadKeys(options.jwksUrl ?? GOOGLE_JWKS_URL, options.fetchImpl ?? fetch);
  const candidates = keys.filter((key) => key.kty === 'RSA' && (!header.kid || !key.kid || key.kid === header.kid));
  if (candidates.length === 0) throw invalidToken('no matching signing key');

  const signed = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, 'base64url');

  const verified = candidates.some((jwk) => {
    try {
      const key = createPublicKey({ key: jwk as import('node:crypto').JsonWebKey, format: 'jwk' });
      const verifier = createVerify('RSA-SHA256');
      verifier.update(signed);
      verifier.end();
      return verifier.verify(key, signature);
    } catch {
      return false;
    }
  });
  if (!verified) throw invalidToken('signature check failed');

  const issuer = String(claims.iss ?? '');
  if (!GOOGLE_ISSUERS.includes(issuer)) throw invalidToken('unexpected issuer');

  const audience = String(claims.aud ?? '');
  const expected = Buffer.from(options.clientId);
  const actual = Buffer.from(audience);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalidToken('token was issued for another app');

  const exp = Number(claims.exp ?? 0);
  if (!Number.isFinite(exp) || exp * 1000 <= now()) throw invalidToken('token expired');

  const nbf = Number(claims.nbf ?? 0);
  if (Number.isFinite(nbf) && nbf > 0 && nbf * 1000 > now() + 60_000) throw invalidToken('token not valid yet');

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) throw invalidToken('token carries no email address');

  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  if (!emailVerified) throw invalidToken('Google has not verified that email address');

  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  if (!sub) throw invalidToken('token carries no subject');

  return {
    sub,
    email,
    emailVerified,
    name: typeof claims.name === 'string' ? claims.name.slice(0, 80) : null,
    picture: typeof claims.picture === 'string' && /^https:\/\//.test(claims.picture) ? claims.picture.slice(0, 2048) : null,
  };
}

/** Test hook: forget cached signing keys. */
export function clearGoogleKeyCache(): void {
  cache.clear();
}
