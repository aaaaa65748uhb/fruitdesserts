import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, registerUser, type TestHarness, type TestUser } from './helpers.js';

let harness: TestHarness;
let user: TestUser;
let recipeId: string;
let creamIngredientId: string;

const RECIPE = {
  title: 'Creamy Garlic Pasta',
  description: null,
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 15,
  difficulty: 'easy',
  cuisine: 'Italian',
  imageUrl: null,
  sourceUrl: null,
  sourceType: 'manual',
  tags: [],
  equipment: [],
  notes: null,
  missingInfo: [],
  confidence: null,
  ingredients: [
    { name: 'spaghetti', quantity: 200, unit: 'g', note: null, optional: false, estimated: false, scalable: true, group: null, position: 0 },
    { name: 'heavy cream', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true, scalable: true, group: null, position: 1 },
    { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false, scalable: false, group: null, position: 2 },
  ],
  steps: [
    { position: 0, instruction: 'Boil the pasta.', durationSeconds: 480, temperatureC: null, estimated: false },
    { position: 1, instruction: 'Stir in the cream.', durationSeconds: null, temperatureC: null, estimated: false },
  ],
};

beforeEach(async () => {
  harness = createHarness();
  user = await registerUser(harness.app);
  const created = await user.agent.post('/api/recipes').send(RECIPE).expect(201);
  recipeId = created.body.recipe.id;
  creamIngredientId = created.body.recipe.ingredients[1].id;
});
afterEach(() => harness.close());

describe('nutrition estimates', () => {
  it('validates, labels and returns the estimate', async () => {
    harness.provider!.push(
      JSON.stringify({
        calories: 612,
        protein: 18.4,
        carbs: 74,
        fat: 26,
        fiber: '3',
        sugar: null,
        sodium: 480,
        basis: 'per-serving',
        confidence: 0.6,
        unaccounted: ['salt'],
        notes: 'Salt was not quantified.',
      }),
    );

    const response = await user.agent.post(`/api/assist/${recipeId}/nutrition`).send({}).expect(200);

    expect(response.body.nutrition.calories).toBe(612);
    expect(response.body.nutrition.fiber).toBe(3); // string coerced
    expect(response.body.nutrition.sugar).toBeNull(); // never invented
    expect(response.body.nutrition.basis).toBe('per-serving');
    expect(response.body.nutrition.unaccounted).toContain('salt');
    expect(response.body.disclaimer).toMatch(/estimate/i);
  });

  it('retries a malformed answer and then fails in a controlled way', async () => {
    harness.provider!.push('not json', '{"calories": "lots"}', 'still not json');
    const response = await user.agent.post(`/api/assist/${recipeId}/nutrition`).send({}).expect(502);
    expect(response.body.error.code).toBe('AI_INVALID_RESPONSE');
  });

  it('sends the real recipe to the model, not a placeholder', async () => {
    harness.provider!.push(
      JSON.stringify({ calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, sugar: 1, sodium: 1, basis: 'per-serving', confidence: 0.5, unaccounted: [], notes: null }),
    );
    await user.agent.post(`/api/assist/${recipeId}/nutrition`).send({}).expect(200);
    const prompt = harness.provider!.calls[0].input;
    expect(JSON.stringify(prompt)).toContain('spaghetti');
    expect(JSON.stringify(prompt)).toContain('Creamy Garlic Pasta');
  });
});

describe('substitutions', () => {
  it('returns validated options for a real ingredient', async () => {
    harness.provider!.push(
      JSON.stringify({
        ingredient: 'heavy cream',
        options: [
          {
            replacement: 'Greek yoghurt',
            quantity: 150,
            unit: 'ml',
            why: 'It brings the same body and a similar richness to the sauce.',
            changes: 'Slightly tangier, and it can split if boiled — stir it in off the heat.',
            suitability: 0.8,
          },
          { replacement: 'evaporated milk', quantity: 150, unit: 'ml', why: 'Close in fat and sugar content.', changes: null, suitability: 0.7 },
        ],
      }),
    );

    const response = await user.agent
      .post(`/api/assist/${recipeId}/substitutions`)
      .send({ ingredientId: creamIngredientId, reason: 'lactose' })
      .expect(200);

    expect(response.body.ingredient.name).toBe('heavy cream');
    expect(response.body.substitutions).toHaveLength(2);
    expect(response.body.substitutions[0].replacement).toBe('Greek yoghurt');
    expect(response.body.substitutions[0].unit).toBe('ml');
    expect(response.body.substitutions[0].changes).toMatch(/tangier/);
  });

  it('rejects an ingredient that is not in the recipe', async () => {
    await user.agent.post(`/api/assist/${recipeId}/substitutions`).send({ ingredientId: 'not-a-real-id' }).expect(404);
    expect(harness.provider!.calls).toHaveLength(0);
  });
});

describe('AI customisation', () => {
  const customized = {
    title: 'High-protein creamy garlic pasta',
    description: 'Same dish, more protein.',
    ingredients: [
      { name: 'protein pasta', quantity: 200, unit: 'g', note: null, optional: false, estimated: false },
      { name: 'Greek yoghurt', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true },
      { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false },
    ],
    steps: [
      { instruction: 'Boil the protein pasta.', durationSeconds: 480, temperatureC: null, estimated: false },
      { instruction: 'Stir the yoghurt through off the heat.', durationSeconds: null, temperatureC: null, estimated: false },
    ],
    changes: ['Swapped wheat pasta for protein pasta.', 'Replaced cream with Greek yoghurt.'],
    warnings: ['Yoghurt splits if it boils.'],
  };

  it('returns the adapted recipe with an explanation of the changes', async () => {
    harness.provider!.push(JSON.stringify(customized));
    const response = await user.agent
      .post(`/api/assist/${recipeId}/customize`)
      .send({ goals: ['high-protein'] })
      .expect(200);

    expect(response.body.customization.title).toMatch(/high-protein/i);
    expect(response.body.customization.changes).toHaveLength(2);
    expect(response.body.customization.warnings[0]).toMatch(/split/i);
    expect(response.body.recipe).toBeNull(); // not saved unless asked
    expect(response.body.customization.ingredients[2].scalable).toBe(false); // "to taste"
  });

  it('can save the adaptation as a new recipe without touching the original', async () => {
    harness.provider!.push(JSON.stringify(customized));
    const response = await user.agent
      .post(`/api/assist/${recipeId}/customize`)
      .send({ goals: ['high-protein', 'dairy-free'], save: true })
      .expect(200);

    expect(response.body.recipe.id).not.toBe(recipeId);
    expect(response.body.recipe.tags).toEqual(expect.arrayContaining(['high-protein', 'dairy-free']));

    const original = await user.agent.get(`/api/recipes/${recipeId}`).expect(200);
    expect(original.body.recipe.title).toBe('Creamy Garlic Pasta');

    const list = await user.agent.get('/api/recipes').expect(200);
    expect(list.body.total).toBe(2);
  });

  it('rejects an unknown goal', async () => {
    await user.agent.post(`/api/assist/${recipeId}/customize`).send({ goals: ['make-it-blue'] }).expect(422);
  });
});

describe('recipe chat', () => {
  it('answers questions about the recipe in front of the user', async () => {
    harness.provider!.push(
      JSON.stringify({
        answer: 'Yes — use 150 ml of evaporated milk in place of the cream.',
        suggestions: ['Add it off the heat'],
        outsideRecipe: false,
      }),
    );

    const response = await user.agent
      .post(`/api/assist/${recipeId}/chat`)
      .send({ question: 'Can I use evaporated milk instead of cream?' })
      .expect(200);

    expect(response.body.answer).toMatch(/evaporated milk/);
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.outsideRecipe).toBe(false);
    expect(JSON.stringify(harness.provider!.calls[0].input)).toContain('heavy cream');
  });

  it('passes the conversation so far to the model', async () => {
    harness.provider!.push(JSON.stringify({ answer: 'Yes.', suggestions: [], outsideRecipe: false }));
    await user.agent
      .post(`/api/assist/${recipeId}/chat`)
      .send({
        question: 'And ahead of time?',
        history: [{ role: 'user', content: 'Can I use milk?' }, { role: 'assistant', content: 'Yes, with a roux.' }],
      })
      .expect(200);
    expect(JSON.stringify(harness.provider!.calls[0].input)).toContain('with a roux');
  });

  it('rejects an empty question', async () => {
    await user.agent.post(`/api/assist/${recipeId}/chat`).send({ question: '' }).expect(422);
  });
});

describe('assistant authorization', () => {
  it("refuses to touch another user's recipe", async () => {
    const intruder = await registerUser(harness.app);
    await intruder.agent.post(`/api/assist/${recipeId}/nutrition`).send({}).expect(403);
    await intruder.agent.post(`/api/assist/${recipeId}/chat`).send({ question: 'What is this?' }).expect(403);
    await intruder.agent.post(`/api/assist/${recipeId}/customize`).send({ goals: ['vegan'] }).expect(403);
    expect(harness.provider!.calls).toHaveLength(0);
  });

  it('requires a session', async () => {
    const { default: request } = await import('supertest');
    await request(harness.app).post(`/api/assist/${recipeId}/nutrition`).send({}).expect(401);
  });

  it('reports 503 when no AI provider is configured', async () => {
    const bare = createHarness({ provider: null, env: { AI_API_KEY: undefined } });
    try {
      const bareUser = await registerUser(bare.app);
      const created = await bareUser.agent.post('/api/recipes').send(RECIPE).expect(201);
      const response = await bareUser.agent.post(`/api/assist/${created.body.recipe.id}/nutrition`).send({}).expect(503);
      expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
    } finally {
      bare.close();
    }
  });
});
