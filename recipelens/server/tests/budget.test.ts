/**
 * How long an import may take, and what happens when it takes longer.
 *
 * A slow model on modest hosting can outlast any single HTTP request. Two
 * things must then hold: the server stops on its own schedule rather than
 * retrying forever, and the recipe it did produce is still reachable — a
 * client that stopped waiting must not be told the import failed, and must not
 * end up with two copies when it asks again.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecipeAIService } from '../src/ai/RecipeAIService.js';
import type { AIProvider, AIProviderResult } from '../src/ai/providers/AIProvider.js';
import { loadConfig } from '../src/config/env.js';
import { createHarness, registerUser, TEST_ENV, validAiJson, type TestHarness } from './helpers.js';

/** Answers slowly, and always with something the validator rejects. */
class SlowProvider implements AIProvider {
  readonly name = 'slow';
  readonly model = 'slow-model';
  readonly endpoint = 'slow.invalid';
  calls = 0;

  constructor(private readonly delayMs: number) {}

  async analyzeRecipe(): Promise<AIProviderResult> {
    return this.answer();
  }
  async complete(): Promise<AIProviderResult> {
    return this.answer();
  }
  private async answer(): Promise<AIProviderResult> {
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return { text: 'not json at all', model: this.model, finishReason: 'stop' };
  }
}

describe('the analysis budget', () => {
  it('stops retrying once the time is spent, instead of counting attempts', async () => {
    const provider = new SlowProvider(120);
    // Room for one attempt, not for the retry that would follow it.
    const service = new RecipeAIService(provider, { maxRetries: 3, budgetMs: 100 });

    await expect(service.analyze({ sourceType: 'text', pastedText: 'x'.repeat(80) })).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
    expect(provider.calls).toBe(1);
  });

  it('still uses every attempt when there is time for them', async () => {
    const provider = new SlowProvider(1);
    const service = new RecipeAIService(provider, { maxRetries: 2, budgetMs: 30_000 });

    await expect(service.analyze({ sourceType: 'text', pastedText: 'x'.repeat(80) })).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
    });
    expect(provider.calls).toBe(3);
  });

  it('is configured from the environment, below what the client waits for', () => {
    const config = loadConfig(TEST_ENV as NodeJS.ProcessEnv);
    expect(config.ai.totalBudgetMs).toBeLessThan(240_000); // web/src/lib/api.ts
    expect(config.ai.totalBudgetMs).toBeGreaterThanOrEqual(config.ai.timeoutMs);

    const custom = loadConfig({ ...TEST_ENV, AI_TOTAL_BUDGET_MS: '90000' } as NodeJS.ProcessEnv);
    expect(custom.ai.totalBudgetMs).toBe(90_000);
  });
});

describe('an import nobody was still waiting for', () => {
  let harness: TestHarness;
  beforeEach(() => {
    harness = createHarness();
  });
  afterEach(() => harness.close());

  const source = { type: 'text' as const, text: 'Mash 100 g butter with 2 grated garlic cloves. Chill 30 minutes. Serves 2.' };

  it('can be collected from the progress feed afterwards', async () => {
    harness.provider!.push(validAiJson());
    const user = await registerUser(harness.app);
    const requestId = 'abcdef0123456789';

    const created = await user.agent.post('/api/import/analyze').set('x-request-id', requestId).send(source).expect(201);

    const progress = await user.agent.get(`/api/import/progress/${requestId}`).expect(200);
    expect(progress.body.finished).toBe(true);
    expect(progress.body.recipeId).toBe(created.body.recipe.id);
    // The whole recipe, so a client that timed out needs no second request.
    expect(progress.body.recipe.title).toBe(created.body.recipe.title);
  });

  it('is not analysed twice when the same request is sent again', async () => {
    harness.provider!.push(validAiJson());
    const user = await registerUser(harness.app);
    const requestId = 'fedcba9876543210';

    const first = await user.agent.post('/api/import/analyze').set('x-request-id', requestId).send(source).expect(201);
    // No second scripted answer is queued: reaching the model would throw.
    const second = await user.agent.post('/api/import/analyze').set('x-request-id', requestId).send(source).expect(200);

    expect(second.body.recipe.id).toBe(first.body.recipe.id);
    expect(harness.provider!.calls).toHaveLength(1);

    const list = await user.agent.get('/api/recipes').expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('keeps one user\'s progress away from another', async () => {
    harness.provider!.push(validAiJson());
    const owner = await registerUser(harness.app);
    const stranger = await registerUser(harness.app);
    const requestId = '0f1e2d3c4b5a6978';

    await owner.agent.post('/api/import/analyze').set('x-request-id', requestId).send(source).expect(201);

    const peek = await stranger.agent.get(`/api/import/progress/${requestId}`).expect(200);
    expect(peek.body.known).toBe(false);
    expect(peek.body.recipe).toBeNull();
  });
});
