import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSessionToken } from '../src/lib/tokens.js';
import { SESSION_COOKIE } from '../src/middleware/auth.js';
import { createHarness, registerUser, TEST_ENV, type TestHarness } from './helpers.js';

let harness: TestHarness;

beforeEach(() => {
  harness = createHarness();
});
afterEach(() => harness.close());

describe('registration', () => {
  it('creates an account and starts a session', async () => {
    const response = await request(harness.app)
      .post('/api/auth/register')
      .send({ email: 'Chef@Example.test', password: 'a-good-password', displayName: 'Chef' })
      .expect(201);

    expect(response.body.user.email).toBe('Chef@Example.test');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('never stores the password in clear text', async () => {
    await request(harness.app).post('/api/auth/register').send({ email: 'a@b.test', password: 'super-secret-pw' }).expect(201);
    const row = harness.ctx.users.findByEmail('a@b.test')!;
    expect(row.password_hash).not.toContain('super-secret-pw');
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
  });

  it('rejects a weak password and a malformed email', async () => {
    await request(harness.app).post('/api/auth/register').send({ email: 'x@y.test', password: 'short' }).expect(422);
    await request(harness.app).post('/api/auth/register').send({ email: 'not-an-email', password: 'a-good-password' }).expect(422);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await request(harness.app).post('/api/auth/register').send({ email: 'dup@example.test', password: 'a-good-password' }).expect(201);
    const response = await request(harness.app)
      .post('/api/auth/register')
      .send({ email: 'DUP@example.test', password: 'a-good-password' })
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});

describe('login', () => {
  it('signs in with correct credentials and persists the session', async () => {
    const user = await registerUser(harness.app);
    const agent = request.agent(harness.app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.id).toBe(user.id);
  });

  it('rejects a wrong password with a generic message', async () => {
    const user = await registerUser(harness.app);
    const response = await request(harness.app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'definitely-wrong' })
      .expect(401);
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('gives the same answer for an unknown account', async () => {
    const response = await request(harness.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'definitely-wrong' })
      .expect(401);
    expect(response.body.error.message).toBe('Invalid email or password.');
  });
});

describe('sessions', () => {
  it('refuses unauthenticated access to protected routes', async () => {
    await request(harness.app).get('/api/auth/me').expect(401);
    await request(harness.app).get('/api/recipes').expect(401);
    await request(harness.app).get('/api/shopping-list').expect(401);
    await request(harness.app).post('/api/import/analyze').send({ type: 'text', text: 'x'.repeat(40) }).expect(401);
  });

  it('drops the cookie on logout', async () => {
    const user = await registerUser(harness.app);
    await user.agent.get('/api/auth/me').expect(200);
    await user.agent.post('/api/auth/logout').expect(200);
    await user.agent.get('/api/auth/me').expect(401);
  });

  it('rejects a tampered token', async () => {
    const user = await registerUser(harness.app);
    const forged = createSessionToken({ sub: user.id, tv: 1 }, 'the-wrong-secret-000000000000000000', 3600);
    await request(harness.app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${forged}`).expect(401);
  });

  it('rejects an expired token', async () => {
    const user = await registerUser(harness.app);
    const expired = createSessionToken({ sub: user.id, tv: 1 }, TEST_ENV.SESSION_SECRET, -10);
    await request(harness.app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${expired}`).expect(401);
  });

  it('invalidates existing sessions after logout-everywhere', async () => {
    const user = await registerUser(harness.app);
    const other = request.agent(harness.app);
    await other.post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);

    await user.agent.post('/api/auth/logout-all').expect(200);
    await other.get('/api/auth/me').expect(401);
  });

  it('allows a write from the page this server itself served', async () => {
    const user = await registerUser(harness.app);
    // Same-origin: the Origin header matches the host the request arrived on,
    // which is what happens once the app is deployed under any real hostname.
    const response = await user.agent
      .post('/api/collections')
      .set('Host', 'recipelens.example.com')
      .set('Origin', 'http://recipelens.example.com')
      .send({ name: 'Deployed' });
    expect(response.status).toBe(201);
  });

  it('blocks cross-site state changes', async () => {
    const user = await registerUser(harness.app);
    await user.agent
      .post('/api/recipes')
      .set('Origin', 'https://evil.example')
      .send({ title: 'x', ingredients: [], steps: [] })
      .expect(403);
  });
});
