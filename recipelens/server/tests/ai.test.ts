import { describe, expect, it } from 'vitest';
import { parseJsonLoose } from '../src/ai/json.js';
import { RecipeAIService } from '../src/ai/RecipeAIService.js';
import { AIProviderError } from '../src/ai/providers/AIProvider.js';
import { OpenAICompatibleProvider } from '../src/ai/providers/OpenAICompatibleProvider.js';

import { MockProvider, startFixtureServer, validAiJson } from './helpers.js';

const baseInput = {
  sourceType: 'text' as const,
  pastedText:
    'Creamy garlic pasta. Boil 200 g spaghetti. Fry 3 cloves of garlic. Add cream and toss. Serves two people.',
};

describe('JSON recovery', () => {
  it('parses clean JSON unchanged', () => {
    const result = parseJsonLoose('{"a":1}');
    expect(result).toEqual({ ok: true, value: { a: 1 }, repaired: false });
  });

  it('recovers JSON wrapped in prose and code fences', () => {
    const result = parseJsonLoose('Sure! Here you go:\n```json\n{"title":"Soup"}\n```\nHope that helps.');
    expect(result.ok && result.value).toEqual({ title: 'Soup' });
    expect(result.ok && result.repaired).toBe(true);
  });

  it('removes trailing commas', () => {
    const result = parseJsonLoose('{"a":[1,2,],}');
    expect(result.ok && result.value).toEqual({ a: [1, 2] });
  });

  it('closes a truncated object', () => {
    const result = parseJsonLoose('{"title":"Soup","ingredients":[{"name":"water"},{"name":"sal');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { title: string }).title).toBe('Soup');
    }
  });

  it('reports failure instead of guessing', () => {
    expect(parseJsonLoose('not json at all').ok).toBe(false);
    expect(parseJsonLoose('').ok).toBe(false);
  });
});

describe('RecipeAIService', () => {
  it('validates and normalises a good response', async () => {
    const provider = new MockProvider([validAiJson()]);
    const service = new RecipeAIService(provider);
    const outcome = await service.analyze(baseInput);

    expect(outcome.attempts).toBe(1);
    expect(outcome.draft.title).toBe('Creamy Garlic Pasta');
    expect(outcome.draft.servings).toBe(2);
    expect(outcome.draft.ingredients).toHaveLength(5);
    expect(outcome.draft.steps).toHaveLength(3);
  });

  it('keeps AI-estimated values flagged and never fills in nulls', async () => {
    const provider = new MockProvider([validAiJson()]);
    const service = new RecipeAIService(provider);
    const { draft } = await service.analyze(baseInput);

    const cream = draft.ingredients.find((i) => i.name === 'heavy cream')!;
    expect(cream.estimated).toBe(true);

    const salt = draft.ingredients.find((i) => i.name === 'salt')!;
    expect(salt.quantity).toBeNull();
    expect(salt.scalable).toBe(false); // "to taste" must not be multiplied

    const chili = draft.ingredients.find((i) => i.name === 'chili flakes')!;
    expect(chili.optional).toBe(true);
  });

  it('records what the source did not state instead of inventing it', async () => {
    const provider = new MockProvider([
      validAiJson({ servings: null, prepMinutes: null, cookMinutes: null, missingInfo: [] }),
    ]);
    const { draft } = await new RecipeAIService(provider).analyze(baseInput);

    expect(draft.servings).toBeNull();
    expect(draft.missingInfo).toContain('servings');
    expect(draft.missingInfo).toContain('timing');
  });

  it('retries invalid JSON with a repair hint and succeeds', async () => {
    const provider = new MockProvider(['this is not json', validAiJson()]);
    const outcome = await new RecipeAIService(provider).analyze(baseInput);

    expect(outcome.attempts).toBe(2);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].options.repairHint).toMatch(/not valid JSON/i);
  });

  it('retries a schema-invalid response and reports the failing fields', async () => {
    const provider = new MockProvider([JSON.stringify({ title: 'Soup', ingredients: [] }), validAiJson()]);
    const outcome = await new RecipeAIService(provider).analyze(baseInput);

    expect(outcome.attempts).toBe(2);
    expect(provider.calls[1].options.repairHint).toMatch(/Schema validation failed/);
  });

  it('gives a controlled error when every attempt is invalid', async () => {
    const provider = new MockProvider(['nope', 'still nope', '{"bad":true}']);
    const service = new RecipeAIService(provider, { maxRetries: 2 });

    await expect(service.analyze(baseInput)).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      status: 502,
    });
    expect(provider.calls).toHaveLength(3);
  });

  it('maps a provider timeout to a 504', async () => {
    const provider = new MockProvider([
      new AIProviderError('timeout', 'timed out'),
      new AIProviderError('timeout', 'timed out'),
      new AIProviderError('timeout', 'timed out'),
    ]);
    await expect(new RecipeAIService(provider).analyze(baseInput)).rejects.toMatchObject({ code: 'AI_TIMEOUT', status: 504 });
  });

  it('does not retry an authentication failure', async () => {
    const provider = new MockProvider([new AIProviderError('auth', 'bad key')]);
    await expect(new RecipeAIService(provider).analyze(baseInput)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(provider.calls).toHaveLength(1);
  });

  it('refuses to call the model when the source has nothing readable', async () => {
    const provider = new MockProvider([validAiJson()]);
    await expect(new RecipeAIService(provider).analyze({ sourceType: 'text', pastedText: 'yum' })).rejects.toMatchObject({
      code: 'INSUFFICIENT_SOURCE_DATA',
    });
    expect(provider.calls).toHaveLength(0);
  });

  it('de-duplicates concurrent identical analyses into one provider call', async () => {
    let resolveFirst: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const provider = new MockProvider([
      async () => {
        await gate;
        return validAiJson();
      },
      validAiJson(),
    ]);
    const service = new RecipeAIService(provider);

    const a = service.analyze(baseInput);
    const b = service.analyze(baseInput);
    resolveFirst!();
    const [first, second] = await Promise.all([a, b]);

    expect(provider.calls).toHaveLength(1);
    expect(first.draft.title).toBe(second.draft.title);
  });
});

describe('OpenAICompatibleProvider (real HTTP round trip)', () => {
  it('sends the key server-side and returns the completion', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: 'test-model', choices: [{ message: { content: validAiJson() } }] }));
    });
    try {
      const provider = new OpenAICompatibleProvider({
        apiKey: 'secret-key',
        baseUrl: fixture.url,
        model: 'test-model',
        timeoutMs: 5000,
      });
      const result = await provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(60) });

      expect(result.text).toContain('Creamy Garlic Pasta');
      expect(fixture.requests[0].url).toBe('/chat/completions');
      expect(fixture.requests[0].headers.authorization).toBe('Bearer secret-key');
      const body = JSON.parse(fixture.requests[0].body);
      expect(body.model).toBe('test-model');
      expect(body.messages[0].role).toBe('system');
    } finally {
      await fixture.close();
    }
  });

  it('retries without response_format when the endpoint rejects it', async () => {
    let call = 0;
    const fixture = await startFixtureServer((_req, res) => {
      call += 1;
      if (call === 1) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'response_format is not supported' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
    });
    try {
      const provider = new OpenAICompatibleProvider({ apiKey: 'k', baseUrl: fixture.url, model: 'm', timeoutMs: 5000 });
      const result = await provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(60) });
      expect(result.text).toBe('{"ok":true}');
      expect(JSON.parse(fixture.requests[0].body).response_format).toBeDefined();
      expect(JSON.parse(fixture.requests[1].body).response_format).toBeUndefined();
    } finally {
      await fixture.close();
    }
  });

  it('classifies provider HTTP failures', async () => {
    const cases: Array<{ status: number; code: string }> = [
      { status: 401, code: 'auth' },
      { status: 429, code: 'rate_limited' },
      { status: 503, code: 'unavailable' },
    ];
    for (const testCase of cases) {
      const fixture = await startFixtureServer((_req, res) => {
        res.writeHead(testCase.status, { 'content-type': 'application/json' });
        res.end('{"error":{"message":"nope"}}');
      });
      try {
        const provider = new OpenAICompatibleProvider({ apiKey: 'k', baseUrl: fixture.url, model: 'm', timeoutMs: 5000 });
        await expect(provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(60) })).rejects.toMatchObject({
          code: testCase.code,
        });
      } finally {
        await fixture.close();
      }
    }
  });

  it('aborts and reports a timeout', async () => {
    const fixture = await startFixtureServer(() => {
      /* never responds */
    });
    try {
      const provider = new OpenAICompatibleProvider({ apiKey: 'k', baseUrl: fixture.url, model: 'm', timeoutMs: 150 });
      await expect(provider.analyzeRecipe({ sourceType: 'text', pastedText: 'x'.repeat(60) })).rejects.toMatchObject({
        code: 'timeout',
      });
    } finally {
      await fixture.close();
    }
  });

  it('refuses to construct without an API key', () => {
    expect(() => new OpenAICompatibleProvider({ apiKey: '', baseUrl: 'https://x/v1', model: 'm', timeoutMs: 100 })).toThrow(
      AIProviderError,
    );
  });
});
