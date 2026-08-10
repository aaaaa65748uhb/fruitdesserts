/**
 * Google sign-in, verified against a locally generated RSA key pair and a
 * fixture JWKS endpoint — so the signature, audience, issuer and expiry checks
 * are exercised for real without contacting Google.
 */
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearGoogleKeyCache } from '../src/lib/googleIdToken.js';
import { createHarness, registerUser, type TestHarness } from './helpers.js';
import { startFixtureServer } from './helpers.js';

const CLIENT_ID = '1234567890-recipelens.apps.googleusercontent.com';

let keyPair: { publicKey: KeyObject; privateKey: KeyObject };
let jwks: { url: string; close: () => Promise<void> };
let harness: TestHarness;

function base64url(value: object | string): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function makeIdToken(claims: Record<string, unknown>, options: { kid?: string; alg?: string; key?: KeyObject } = {}): string {
  const header = base64url({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'test-key', typ: 'JWT' });
  const payload = base64url({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-user-1',
    email: 'cook@example.test',
    email_verified: true,
    name: 'Google Cook',
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    ...claims,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(options.key ?? keyPair.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

beforeEach(async () => {
  clearGoogleKeyCache();
  keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = keyPair.publicKey.export({ format: 'jwk' });
  jwks = await startFixtureServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=60' });
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }));
  });
  harness = createHarness({ env: { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_JWKS_URL: `${jwks.url}/certs` } });
});

afterEach(async () => {
  harness.close();
  await jwks.close();
  clearGoogleKeyCache();
});

describe('POST /api/auth/google', () => {
  it('creates an account from a valid ID token and starts a session', async () => {
    const agent = request.agent(harness.app);
    const response = await agent.post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(200);

    expect(response.body.user.email).toBe('cook@example.test');
    expect(response.body.user.displayName).toBe('Google Cook');
    expect(response.body).not.toHaveProperty('token'); // browsers keep the cookie

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('cook@example.test');
  });

  it('returns the same account on a second sign-in', async () => {
    const first = await request(harness.app).post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(200);
    const second = await request(harness.app).post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(200);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('links a Google identity to an existing password account with the same email', async () => {
    const existing = await registerUser(harness.app, { email: 'cook@example.test' });
    const response = await request(harness.app).post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(200);
    expect(response.body.user.id).toBe(existing.id);
  });

  it('issues a bearer token to the Android client', async () => {
    const response = await request(harness.app)
      .post('/api/auth/google')
      .set('x-recipelens-client', 'native')
      .send({ idToken: makeIdToken({}) })
      .expect(200);

    expect(typeof response.body.token).toBe('string');
    const me = await request(harness.app).get('/api/auth/me').set('authorization', `Bearer ${response.body.token}`).expect(200);
    expect(me.body.user.email).toBe('cook@example.test');
  });

  it('rejects a token signed by somebody else', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = makeIdToken({}, { key: attacker.privateKey });
    const response = await request(harness.app).post('/api/auth/google').send({ idToken: forged }).expect(401);
    expect(response.body.error.details.reason).toBe('signature check failed');
  });

  it('rejects a token minted for another app', async () => {
    const response = await request(harness.app)
      .post('/api/auth/google')
      .send({ idToken: makeIdToken({ aud: 'someone-else.apps.googleusercontent.com' }) })
      .expect(401);
    expect(response.body.error.details.reason).toBe('token was issued for another app');
  });

  it('rejects an expired token', async () => {
    const response = await request(harness.app)
      .post('/api/auth/google')
      .send({ idToken: makeIdToken({ exp: Math.floor(Date.now() / 1000) - 60 }) })
      .expect(401);
    expect(response.body.error.details.reason).toBe('token expired');
  });

  it('rejects an unexpected issuer and an unverified email', async () => {
    expect(
      (
        await request(harness.app)
          .post('/api/auth/google')
          .send({ idToken: makeIdToken({ iss: 'https://evil.example' }) })
          .expect(401)
      ).body.error.details.reason,
    ).toBe('unexpected issuer');

    expect(
      (
        await request(harness.app)
          .post('/api/auth/google')
          .send({ idToken: makeIdToken({ email_verified: false }) })
          .expect(401)
      ).body.error.details.reason,
    ).toBe('Google has not verified that email address');
  });

  it('refuses the "none" algorithm', async () => {
    const header = base64url({ alg: 'none', kid: 'test-key', typ: 'JWT' });
    const payload = base64url({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'x', email: 'x@y.test', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 });
    const response = await request(harness.app).post('/api/auth/google').send({ idToken: `${header}.${payload}.` }).expect(401);
    expect(response.body.error.details.reason).toBe('unsupported algorithm');
  });

  it('reports a clear 503 when Google sign-in is not configured', async () => {
    const bare = createHarness();
    try {
      const response = await request(bare.app).post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(503);
      expect(response.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
      expect(response.body.error.details.reason).toMatch(/GOOGLE_CLIENT_ID/);
    } finally {
      bare.close();
    }
  });

  it('a Google account cannot be signed into with a guessed password', async () => {
    await request(harness.app).post('/api/auth/google').send({ idToken: makeIdToken({}) }).expect(200);
    await request(harness.app).post('/api/auth/login').send({ email: 'cook@example.test', password: 'anything-at-all' }).expect(401);
  });
});
