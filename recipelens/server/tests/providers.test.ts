/**
 * Each provider is exercised over a real HTTP round trip against a fixture
 * server, so the request shape, the auth header and the response parsing are
 * verified for real. (No vendor is contacted.)
 */
import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from '../src/ai/providers/AnthropicProvider.js';
import { GeminiProvider } from '../src/ai/providers/GeminiProvider.js';
import { OpenAIProvider } from '../src/ai/providers/OpenAIProvider.js';
import { createProvider } from '../src/ai/providers/factory.js';
import { AIProviderError } from '../src/ai/providers/AIProvider.js';
import type { AiConfig } from '../src/config/env.js';
import { startFixtureServer } from './helpers.js';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const request = { system: 'You are a test.', user: 'Say hello as JSON.', json: true };

function aiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    apiKey: 'k',
    baseUrl: 'https://example.test/v1',
    model: 'm',
    timeoutMs: 5000,
    maxRetries: 1,
    configured: true,
    disabledReason: null,
    ...overrides,
  };
}

describe('AnthropicProvider', () => {
  it('uses the Messages API, the x-api-key header and inline images', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: 'claude-test', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' }));
    });
    try {
      const provider = new AnthropicProvider({ apiKey: 'anthropic-key', baseUrl: fixture.url, model: 'claude-test', timeoutMs: 5000 });
      const result = await provider.complete({ ...request, images: [TINY_PNG] });

      expect(result.text).toBe('{"ok":true}');
      expect(result.model).toBe('claude-test');
      expect(fixture.requests[0].url).toBe('/v1/messages');
      expect(fixture.requests[0].headers['x-api-key']).toBe('anthropic-key');
      expect(fixture.requests[0].headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(fixture.requests[0].body);
      expect(body.system).toBe('You are a test.');
      expect(body.messages[0].content[0].type).toBe('image');
      expect(body.messages[0].content[0].source.media_type).toBe('image/png');
      expect(body.messages[0].content[1].text).toBe('Say hello as JSON.');
    } finally {
      await fixture.close();
    }
  });

  it('maps provider failures onto the shared error codes', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end('{"error":{"message":"slow down"}}');
    });
    try {
      const provider = new AnthropicProvider({ apiKey: 'k', baseUrl: fixture.url, model: 'm', timeoutMs: 5000 });
      await expect(provider.complete(request)).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
    } finally {
      await fixture.close();
    }
  });
});

describe('GeminiProvider', () => {
  it('calls generateContent with the key in a header and JSON mode on', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: 'true}' }] }, finishReason: 'STOP' }],
          modelVersion: 'gemini-test',
        }),
      );
    });
    try {
      const provider = new GeminiProvider({ apiKey: 'google-key', baseUrl: fixture.url, model: 'gemini-test', timeoutMs: 5000 });
      const result = await provider.complete({ ...request, images: [TINY_PNG] });

      expect(result.text).toBe('{"ok":true}'); // parts are concatenated
      expect(fixture.requests[0].url).toBe('/models/gemini-test:generateContent');
      expect(fixture.requests[0].headers['x-goog-api-key']).toBe('google-key');
      // The key must never travel in the query string.
      expect(fixture.requests[0].url).not.toContain('key=');

      const body = JSON.parse(fixture.requests[0].body);
      expect(body.systemInstruction.parts[0].text).toBe('You are a test.');
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/png');
    } finally {
      await fixture.close();
    }
  });

  it('reports an empty candidate list as a bad response', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ candidates: [] }));
    });
    try {
      const provider = new GeminiProvider({ apiKey: 'k', baseUrl: fixture.url, model: 'm', timeoutMs: 5000 });
      await expect(provider.complete(request)).rejects.toMatchObject({ code: 'bad_response' });
    } finally {
      await fixture.close();
    }
  });
});

describe('provider factory', () => {
  it('builds the provider named by AI_PROVIDER', () => {
    expect(createProvider(aiConfig({ provider: 'openai' }))).toBeInstanceOf(OpenAIProvider);
    expect(createProvider(aiConfig({ provider: 'anthropic' }))).toBeInstanceOf(AnthropicProvider);
    expect(createProvider(aiConfig({ provider: 'gemini' }))).toBeInstanceOf(GeminiProvider);
    expect(createProvider(aiConfig({ provider: 'openai-compatible' })).name).toBe('openai-compatible');
  });

  it('rejects an unknown provider by name', () => {
    expect(() => createProvider(aiConfig({ provider: 'llamafile' }))).toThrow(AIProviderError);
    try {
      createProvider(aiConfig({ provider: 'llamafile' }));
    } catch (error) {
      expect((error as Error).message).toMatch(/Supported values/);
    }
  });

  it('refuses to build anything without a key', () => {
    expect(() => createProvider(aiConfig({ apiKey: null }))).toThrow(AIProviderError);
  });

  it('never puts the key into an error message', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(401);
      res.end('{"error":"bad key"}');
    });
    try {
      const provider = new OpenAIProvider({ apiKey: 'super-secret-key', baseUrl: fixture.url, model: 'm', timeoutMs: 5000 });
      await provider.complete(request);
      expect.unreachable('should have thrown');
    } catch (error) {
      const serialised = `${(error as Error).message} ${JSON.stringify((error as Error).cause ?? '')}`;
      expect(serialised).not.toContain('super-secret-key');
    } finally {
      await fixture.close();
    }
  });
});
