/**
 * Cross-origin access for the Android app.
 *
 * The APK's WebView is served from https://localhost, so *every* call it makes
 * is cross-origin: the browser sends a preflight before any request that
 * carries a JSON body or one of our own headers, and refuses the real request
 * unless the preflight names those headers back. A missing name here does not
 * look like a CORS problem on the phone — it looks like "could not reach the
 * server", which is why it is worth pinning down.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type TestHarness } from './helpers.js';

const NATIVE_ORIGIN = 'https://localhost';

let harness: TestHarness;

beforeEach(() => {
  harness = createHarness();
});
afterEach(() => harness.close());

/** Headers the client actually sets — see web/src/lib/api.ts. */
const CLIENT_HEADERS = ['content-type', 'authorization', 'x-recipelens-client', 'x-request-id'];

describe('preflight from the Android app', () => {
  it('allows every header the client sends', async () => {
    const response = await request(harness.app)
      .options('/api/auth/register')
      .set('Origin', NATIVE_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', CLIENT_HEADERS.join(','))
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(NATIVE_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    const allowed = (response.headers['access-control-allow-headers'] ?? '').toLowerCase();
    for (const header of CLIENT_HEADERS) {
      expect(allowed).toContain(header);
    }
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('lets the client read the import request id back', async () => {
    const response = await request(harness.app)
      .options('/api/import/analyze')
      .set('Origin', NATIVE_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect((response.headers['access-control-expose-headers'] ?? '').toLowerCase()).toContain('x-request-id');
  });

  it('stays shut for an origin nobody configured', async () => {
    const response = await request(harness.app)
      .options('/api/auth/register')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('the real request that follows', () => {
  it('signs a native client up and answers with CORS headers', async () => {
    const response = await request(harness.app)
      .post('/api/auth/register')
      .set('Origin', NATIVE_ORIGIN)
      .set('x-recipelens-client', 'native')
      .send({ email: 'phone@example.test', password: 'a-good-password' })
      .expect(201);

    expect(response.headers['access-control-allow-origin']).toBe(NATIVE_ORIGIN);
    // A native client is handed a bearer token instead of a cookie.
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(20);
  });

  it('still blocks a genuine cross-site write', async () => {
    const response = await request(harness.app)
      .post('/api/auth/register')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'nope@example.test', password: 'a-good-password' })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
