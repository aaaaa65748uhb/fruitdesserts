/**
 * Addresses typed on a phone.
 *
 * A Hebrew (or any RTL) soft keyboard wraps Latin text in directional marks.
 * They are invisible, so the address looks right, reads right, and used to be
 * rejected as malformed — the worst kind of validation error, because there is
 * nothing on screen to correct.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isLikelyEmail, normalizeEmail } from '../src/shared.js';
import { createHarness, type TestHarness } from './helpers.js';

const LRM = '\u200E';
const RLM = '\u200F';
const ZWSP = '\u200B';

let harness: TestHarness;
beforeEach(() => {
  harness = createHarness();
});
afterEach(() => harness.close());

describe('normalizeEmail', () => {
  it('drops the marks a right-to-left keyboard adds', () => {
    expect(normalizeEmail(`${LRM}cook@example.com${LRM}`)).toBe('cook@example.com');
    expect(normalizeEmail(`${RLM}cook@example.com`)).toBe('cook@example.com');
    expect(normalizeEmail(`cook@example.com${ZWSP}`)).toBe('cook@example.com');
    expect(normalizeEmail('\u202Bcook@example.com\u202C')).toBe('cook@example.com');
  });

  it('unwraps what a contact picker or a link hands over', () => {
    expect(normalizeEmail('mailto:cook@example.com')).toBe('cook@example.com');
    expect(normalizeEmail('Guy Ezra <cook@example.com>')).toBe('cook@example.com');
  });

  it('handles ordinary whitespace, including the non-breaking kind', () => {
    expect(normalizeEmail('  cook@example.com  ')).toBe('cook@example.com');
    expect(normalizeEmail(' cook@example.com ')).toBe('cook@example.com');
  });

  it('leaves a clean address exactly as it was', () => {
    expect(normalizeEmail('cook+recipes@example.co.uk')).toBe('cook+recipes@example.co.uk');
  });

  it('does not turn nonsense into an address', () => {
    expect(isLikelyEmail(`${LRM}not an address${LRM}`)).toBe(false);
    expect(isLikelyEmail('cook@localhost')).toBe(false);
    expect(isLikelyEmail('')).toBe(false);
  });
});

describe('signing up with an address a phone produced', () => {
  const password = 'correct-horse-battery';

  it('accepts it, and signs in with the plain form afterwards', async () => {
    await request(harness.app)
      .post('/api/auth/register')
      .send({ email: `${LRM}phone.user@example.test${LRM}`, password, displayName: 'Phone' })
      .expect(201);

    // Stored clean, so the address typed on a laptop finds the same account.
    expect(harness.ctx.users.findByEmail('phone.user@example.test')).toBeTruthy();

    await request(harness.app)
      .post('/api/auth/login')
      .send({ email: 'phone.user@example.test', password })
      .expect(200);

    // …and the marked-up form still signs in too.
    await request(harness.app)
      .post('/api/auth/login')
      .send({ email: `${RLM}phone.user@example.test`, password })
      .expect(200);
  });

  it('still refuses something that is not an address', async () => {
    const response = await request(harness.app)
      .post('/api/auth/register')
      .send({ email: `${LRM}definitely-not-an-email${LRM}`, password })
      .expect(422);
    expect(JSON.stringify(response.body)).toMatch(/valid email/i);
  });
});
