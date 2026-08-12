/**
 * NVIDIA Build (NIM) provider.
 *
 * Exercised over real HTTP against a fixture that speaks NVIDIA's
 * OpenAI-compatible chat-completions shape. This proves the request we send is
 * the one NVIDIA expects and that its answers parse; it does not and cannot
 * prove the live credentials work — that check runs on the deployed server via
 * GET /api/diagnostics/ai.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { NvidiaProvider, NVIDIA_DEFAULT_BASE_URL, NVIDIA_DEFAULT_MODEL } from '../src/ai/providers/NvidiaProvider.js';
import { createProvider, PROVIDER_DEFAULTS } from '../src/ai/providers/factory.js';
import { loadConfig } from '../src/config/env.js';
import { createHarness, registerUser, startFixtureServer, TEST_ENV, validAiJson } from './helpers.js';

const MODEL = 'meta/llama-4-maverick-17b-128e-instruct';

function nvidiaConfig(overrides: Record<string, string | undefined> = {}) {
  return loadConfig({
    ...TEST_ENV,
    AI_PROVIDER: 'nvidia',
    AI_API_BASE_URL: undefined,
    AI_MODEL: undefined,
    ...overrides,
  } as NodeJS.ProcessEnv).ai;
}

describe('NVIDIA provider wiring', () => {
  it('is built from AI_PROVIDER=nvidia with NVIDIA defaults', () => {
    const provider = createProvider(nvidiaConfig());
    expect(provider).toBeInstanceOf(NvidiaProvider);
    expect(provider.name).toBe('nvidia');
    expect(provider.endpoint).toBe('integrate.api.nvidia.com');
    expect(provider.model).toBe(NVIDIA_DEFAULT_MODEL);
    expect(PROVIDER_DEFAULTS.nvidia.baseUrl).toBe(NVIDIA_DEFAULT_BASE_URL);
  });

  it('lets the environment override the endpoint and the model', () => {
    const provider = createProvider(
      nvidiaConfig({ AI_API_BASE_URL: 'https://integrate.api.nvidia.com/v1', AI_MODEL: MODEL }),
    );
    expect(provider.model).toBe(MODEL);
    expect(provider.endpoint).toBe('integrate.api.nvidia.com');
  });

  it('never falls back to OpenAI when only AI_PROVIDER is set', () => {
    const provider = createProvider(nvidiaConfig());
    expect(provider.endpoint).not.toContain('openai');
  });

  it('reads the key from the environment and refuses to build without one', () => {
    const config = nvidiaConfig({ AI_API_KEY: undefined });
    expect(config.configured).toBe(false);
    expect(() => createProvider(config)).toThrow(/AI_API_KEY/);
  });
});

describe('NVIDIA provider over HTTP', () => {
  it('sends an OpenAI-compatible request with a bearer key and a token budget', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-abc',
          object: 'chat.completion',
          model: MODEL,
          choices: [{ index: 0, message: { role: 'assistant', content: validAiJson() }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 700, completion_tokens: 400, total_tokens: 1100 },
        }),
      );
    });
    try {
      const provider = new NvidiaProvider({ apiKey: 'nvapi-test-key', baseUrl: fixture.url, model: MODEL, timeoutMs: 8000 });
      const result = await provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(80) });

      expect(result.text).toContain('Creamy Garlic Pasta');
      expect(result.model).toBe(MODEL);
      expect(fixture.requests[0].url).toBe('/chat/completions');
      expect(fixture.requests[0].headers.authorization).toBe('Bearer nvapi-test-key');

      const body = JSON.parse(fixture.requests[0].body);
      expect(body.model).toBe(MODEL);
      expect(body.max_tokens).toBe(4096); // a recipe does not fit in NIM's default
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
    } finally {
      await fixture.close();
    }
  });

  it('drops JSON mode and retries when the model does not support it', async () => {
    let call = 0;
    const fixture = await startFixtureServer((_req, res) => {
      call += 1;
      if (call === 1) {
        // NIM answers 400/422 with its own wording when a model lacks JSON mode.
        res.writeHead(422, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ detail: 'guided json / response_format is not supported by this model' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: MODEL, choices: [{ message: { content: validAiJson() } }] }));
    });
    try {
      const provider = new NvidiaProvider({ apiKey: 'k', baseUrl: fixture.url, model: MODEL, timeoutMs: 8000 });
      const result = await provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(80) });

      expect(result.text).toContain('Creamy Garlic Pasta');
      expect(JSON.parse(fixture.requests[0].body).response_format).toBeDefined();
      expect(JSON.parse(fixture.requests[1].body).response_format).toBeUndefined();
    } finally {
      await fixture.close();
    }
  });

  it('reports a rejected key as an auth failure without echoing it', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ detail: 'invalid api key nvapi-secret-123' }));
    });
    try {
      const provider = new NvidiaProvider({ apiKey: 'nvapi-secret-123', baseUrl: fixture.url, model: MODEL, timeoutMs: 8000 });
      await provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(80) });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { code: string }).code).toBe('auth');
      expect(`${(error as Error).message}`).not.toContain('nvapi-secret-123');
    } finally {
      await fixture.close();
    }
  });
});

describe('GET /api/diagnostics/ai', () => {
  it('performs a real provider round trip and reports what answered', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: MODEL, choices: [{ message: { content: '{"ok": true}' } }] }));
    });
    const harness = createHarness({
      provider: new NvidiaProvider({ apiKey: 'nvapi-test', baseUrl: fixture.url, model: MODEL, timeoutMs: 8000 }),
    });
    try {
      const user = await registerUser(harness.app);
      const response = await user.agent.get('/api/diagnostics/ai').expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.provider).toBe('nvidia');
      expect(response.body.model).toBe(MODEL);
      expect(typeof response.body.latencyMs).toBe('number');
      // The request really left the process.
      expect(fixture.requests).toHaveLength(1);
      // Nothing secret comes back.
      expect(JSON.stringify(response.body)).not.toContain('nvapi-test');
    } finally {
      harness.close();
      await fixture.close();
    }
  });

  it('surfaces a bad key as a clear failure instead of a fake success', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"detail":"invalid api key"}');
    });
    const harness = createHarness({
      provider: new NvidiaProvider({ apiKey: 'wrong', baseUrl: fixture.url, model: MODEL, timeoutMs: 8000 }),
    });
    try {
      const user = await registerUser(harness.app);
      const response = await user.agent.get('/api/diagnostics/ai').expect(502);
      expect(response.body.error.code).toBe('AI_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/credentials/i);
    } finally {
      harness.close();
      await fixture.close();
    }
  });

  it('answers 503 when no provider is configured, and needs a session', async () => {
    const bare = createHarness({ provider: null, env: { AI_API_KEY: undefined } });
    try {
      await request(bare.app).get('/api/diagnostics/ai').expect(401);
      const user = await registerUser(bare.app);
      const response = await user.agent.get('/api/diagnostics/ai').expect(503);
      expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
    } finally {
      bare.close();
    }
  });
});
