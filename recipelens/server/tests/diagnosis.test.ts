/**
 * Making a failing provider diagnosable.
 *
 * A deployment that cannot talk to its model used to report one sentence —
 * "the AI provider returned an unusable response" — with the provider's own
 * explanation discarded. These tests pin down that the explanation survives,
 * that it is stripped of anything credential-shaped on the way, and that the
 * two failure modes we can actually recover from are recovered from.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearProviderFailures, recentProviderFailures, redact } from '../src/ai/failureLog.js';
import { NvidiaProvider } from '../src/ai/providers/NvidiaProvider.js';
import { createHarness, registerUser, startFixtureServer, validAiJson, type TestHarness } from './helpers.js';

const MODEL = 'meta/llama-4-maverick-17b-128e-instruct';

function provider(baseUrl: string) {
  return new NvidiaProvider({ apiKey: 'test-key', baseUrl, model: MODEL, timeoutMs: 5000 });
}

beforeEach(() => clearProviderFailures());

describe('redaction', () => {
  it('removes anything shaped like a credential', () => {
    expect(redact('bad key nvapi-abc123def456ghi')).not.toContain('abc123def456ghi');
    expect(redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9')).toContain('Bearer [redacted]');
    expect(redact('{"api_key":"sk-proj-0123456789abcdef"}')).not.toContain('0123456789abcdef');
  });

  it('leaves an ordinary provider complaint readable', () => {
    const text = redact('{"object":"error","message":"Model meta/llama-4 is not available to this account"}');
    expect(text).toContain('not available to this account');
  });
});

describe('what the provider objected to', () => {
  it('records the status and the provider text when a call is rejected', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'error', message: 'model not found', type: 'invalid_request_error' }));
    });
    try {
      await expect(provider(fixture.url).complete({ system: 's', user: 'u', json: true })).rejects.toThrow();

      const [failure] = recentProviderFailures();
      expect(failure.status).toBe(404);
      expect(failure.detail).toContain('model not found');
      expect(failure.provider).toBe('nvidia');
      expect(failure.model).toBe(MODEL);
    } finally {
      await fixture.close();
    }
  });

  it('never records the key itself', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      // A hostile-shaped body: the provider echoing back what it was sent.
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'bad request', sent: { authorization: 'Bearer test-key-abcdefghijkl' } }));
    });
    try {
      await expect(provider(fixture.url).complete({ system: 's', user: 'u' })).rejects.toThrow();
      const dump = JSON.stringify(recentProviderFailures());
      expect(dump).not.toContain('test-key-abcdefghijkl');
    } finally {
      await fixture.close();
    }
  });

  it('says so when the answer arrives with no assistant text at all', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: MODEL, choices: [{ message: { content: '' }, finish_reason: 'length' }] }));
    });
    try {
      await expect(provider(fixture.url).complete({ system: 's', user: 'u' })).rejects.toThrow(/empty completion/i);
      const [failure] = recentProviderFailures();
      expect(failure.stage).toBe('empty');
      expect(failure.detail).toContain('finish_reason=length');
    } finally {
      await fixture.close();
    }
  });
});

describe('failures worth recovering from', () => {
  it('drops JSON mode and retries, whatever words the endpoint used to refuse it', async () => {
    let seen = 0;
    const fixture = await startFixtureServer((_req, res) => {
      seen += 1;
      if (seen === 1) {
        res.writeHead(400, { 'content-type': 'application/json' });
        // Deliberately worded like nothing we would have thought to match.
        res.end(JSON.stringify({ detail: 'this deployment does not accept that field' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: MODEL, choices: [{ message: { content: validAiJson() }, finish_reason: 'stop' }] }));
    });
    try {
      const result = await provider(fixture.url).complete({ system: 's', user: 'u', json: true });
      expect(result.text).toContain('title');

      const bodies = fixture.requests.map((entry) => JSON.parse(entry.body) as Record<string, unknown>);
      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toHaveProperty('response_format');
      expect(bodies[1]).not.toHaveProperty('response_format');
    } finally {
      await fixture.close();
    }
  });

  it('reads a model that answers in reasoning_content', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          model: MODEL,
          choices: [{ message: { content: null, reasoning_content: validAiJson() }, finish_reason: 'stop' }],
        }),
      );
    });
    try {
      const result = await provider(fixture.url).complete({ system: 's', user: 'u', json: true });
      expect(result.text).toContain('title');
    } finally {
      await fixture.close();
    }
  });
});

describe('GET /api/diagnostics/ai', () => {
  let harness: TestHarness;
  afterEach(() => harness.close());

  it('answers a failed check with the diagnosis attached', async () => {
    harness = createHarness();
    // Queue nothing: the provider throws, which is what a broken key looks like.
    const user = await registerUser(harness.app);
    // The status stays honest; the diagnosis rides along in `details`.
    const response = await user.agent.get('/api/diagnostics/ai').expect(500);

    const diagnosis = response.body.error.details;
    expect(diagnosis.ok).toBe(false);
    expect(diagnosis.check).toBe('ping');
    expect(diagnosis.failure.code).toBeTruthy();
    expect(diagnosis.provider).toBe('mock');
  });

  it('runs a real extraction when asked to go deep', async () => {
    harness = createHarness();
    harness.provider!.push(validAiJson());
    const user = await registerUser(harness.app);
    const response = await user.agent.get('/api/diagnostics/ai?deep=1').expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.check).toBe('deep');
    expect(response.body.extracted.ingredientCount).toBeGreaterThan(0);
    expect(response.body.extracted.stepCount).toBeGreaterThan(0);
    // The check must not leak what it was configured with beyond the host name.
    expect(JSON.stringify(response.body)).not.toContain('test-key');
  });
});
