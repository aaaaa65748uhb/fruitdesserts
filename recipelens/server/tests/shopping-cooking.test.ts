import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, registerUser, type TestHarness, type TestUser } from './helpers.js';

let harness: TestHarness;
let user: TestUser;

function recipe(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Pasta',
    description: null,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    cuisine: null,
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
      { name: 'olive oil', quantity: 2, unit: 'tbsp', note: null, optional: false, estimated: false, scalable: true, group: null, position: 1 },
      { name: 'basil', quantity: null, unit: null, note: 'to taste', optional: true, estimated: false, scalable: false, group: null, position: 2 },
    ],
    steps: [
      { position: 0, instruction: 'Boil the pasta.', durationSeconds: 480, temperatureC: null, estimated: false },
      { position: 1, instruction: 'Toss with oil.', durationSeconds: null, temperatureC: null, estimated: false },
      { position: 2, instruction: 'Serve.', durationSeconds: null, temperatureC: null, estimated: false },
    ],
    ...overrides,
  };
}

beforeEach(async () => {
  harness = createHarness();
  user = await registerUser(harness.app);
});
afterEach(() => harness.close());

describe('shopping list', () => {
  it('adds, checks, edits and removes items', async () => {
    const added = await user.agent.post('/api/shopping-list').send({ name: 'Eggs', quantity: 6, unit: 'piece' }).expect(201);
    const id = added.body.added[0].id as string;
    expect(added.body.added[0].displayText).toBe('6 pieces');

    const checked = await user.agent.patch(`/api/shopping-list/${id}`).send({ checked: true }).expect(200);
    expect(checked.body.item.checked).toBe(true);

    const edited = await user.agent.patch(`/api/shopping-list/${id}`).send({ quantity: 12, name: 'Free-range eggs' }).expect(200);
    expect(edited.body.item.quantity).toBe(12);
    expect(edited.body.item.name).toBe('Free-range eggs');

    await user.agent.delete(`/api/shopping-list/${id}`).expect(200);
    expect((await user.agent.get('/api/shopping-list').expect(200)).body.items).toHaveLength(0);
  });

  it('merges duplicates across compatible units but not incompatible ones', async () => {
    await user.agent.post('/api/shopping-list').send({ name: 'flour', quantity: 200, unit: 'g' }).expect(201);
    await user.agent.post('/api/shopping-list').send({ name: 'Flour', quantity: 0.3, unit: 'kg' }).expect(201);
    await user.agent.post('/api/shopping-list').send({ name: 'flour', quantity: 1, unit: 'cup' }).expect(201);

    const list = await user.agent.get('/api/shopping-list').expect(200);
    const flours = list.body.items.filter((item: { name: string }) => item.name.toLowerCase().includes('flour'));
    expect(flours).toHaveLength(2);
    const grams = flours.find((f: { unit: string }) => f.unit === 'g');
    expect(grams.quantity).toBe(500);
  });

  it('does not merge into an item that is already checked off', async () => {
    const first = await user.agent.post('/api/shopping-list').send({ name: 'milk', quantity: 1, unit: 'l' }).expect(201);
    await user.agent.patch(`/api/shopping-list/${first.body.added[0].id}`).send({ checked: true }).expect(200);
    await user.agent.post('/api/shopping-list').send({ name: 'milk', quantity: 500, unit: 'ml' }).expect(201);

    const list = await user.agent.get('/api/shopping-list').expect(200);
    expect(list.body.items).toHaveLength(2);
  });

  it('adds a recipe scaled to the servings being cooked, merging across recipes', async () => {
    const first = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const second = await user.agent.post('/api/recipes').send(recipe({ title: 'Aglio e olio' })).expect(201);

    await user.agent.post('/api/shopping-list/from-recipe').send({ recipeId: first.body.recipe.id, servings: 4 }).expect(201);
    const afterSecond = await user.agent
      .post('/api/shopping-list/from-recipe')
      .send({ recipeId: second.body.recipe.id, servings: 2 })
      .expect(201);

    const spaghetti = afterSecond.body.items.find((i: { name: string }) => i.name === 'spaghetti');
    expect(spaghetti.quantity).toBe(600); // 400 g (4 servings) + 200 g (2 servings)

    const oil = afterSecond.body.items.find((i: { name: string }) => i.name === 'olive oil');
    expect(oil.quantity).toBe(6); // 4 tbsp + 2 tbsp

    const basil = afterSecond.body.items.find((i: { name: string }) => i.name === 'basil');
    expect(basil.quantity).toBeNull();
  });

  it('can skip optional ingredients', async () => {
    const created = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const response = await user.agent
      .post('/api/shopping-list/from-recipe')
      .send({ recipeId: created.body.recipe.id, includeOptional: false })
      .expect(201);
    expect(response.body.items.some((i: { name: string }) => i.name === 'basil')).toBe(false);
  });

  it('clears checked items only', async () => {
    const a = await user.agent.post('/api/shopping-list').send({ name: 'rice' }).expect(201);
    await user.agent.post('/api/shopping-list').send({ name: 'beans' }).expect(201);
    await user.agent.patch(`/api/shopping-list/${a.body.added[0].id}`).send({ checked: true }).expect(200);

    const cleared = await user.agent.post('/api/shopping-list/clear').send({ onlyChecked: true }).expect(200);
    expect(cleared.body.removed).toBe(1);
    expect((await user.agent.get('/api/shopping-list').expect(200)).body.items).toHaveLength(1);
  });

  it("does not touch another user's list", async () => {
    const mine = await user.agent.post('/api/shopping-list').send({ name: 'secret ingredient' }).expect(201);
    const intruder = await registerUser(harness.app);
    await intruder.agent.patch(`/api/shopping-list/${mine.body.added[0].id}`).send({ checked: true }).expect(404);
    await intruder.agent.delete(`/api/shopping-list/${mine.body.added[0].id}`).expect(404);
    expect((await intruder.agent.get('/api/shopping-list').expect(200)).body.items).toHaveLength(0);
  });
});

describe('cooking mode', () => {
  it('persists progress so a refresh resumes where the cook left off', async () => {
    const created = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const id = created.body.recipe.id as string;

    expect((await user.agent.get(`/api/cooking/${id}`).expect(200)).body.session).toBeNull();

    await user.agent.put(`/api/cooking/${id}`).send({ currentStep: 1, completedSteps: [0], servings: 4 }).expect(200);

    const resumed = await user.agent.get(`/api/cooking/${id}`).expect(200);
    expect(resumed.body.session.currentStep).toBe(1);
    expect(resumed.body.session.completedSteps).toEqual([0]);
    expect(resumed.body.session.servings).toBe(4);

    const active = await user.agent.get('/api/cooking').expect(200);
    expect(active.body.sessions).toHaveLength(1);
  });

  it('marks a session complete and can reset it', async () => {
    const created = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const id = created.body.recipe.id as string;

    await user.agent.put(`/api/cooking/${id}`).send({ currentStep: 2, completedSteps: [0, 1, 2], completed: true }).expect(200);
    expect((await user.agent.get('/api/cooking').expect(200)).body.sessions).toHaveLength(0);

    await user.agent.delete(`/api/cooking/${id}`).expect(200);
    expect((await user.agent.get(`/api/cooking/${id}`).expect(200)).body.session).toBeNull();
  });

  it('rejects step indexes the recipe does not have', async () => {
    const created = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const id = created.body.recipe.id as string;
    await user.agent.put(`/api/cooking/${id}`).send({ currentStep: 99 }).expect(400);
    await user.agent.put(`/api/cooking/${id}`).send({ completedSteps: [0, 42] }).expect(400);
  });

  it("cannot read another user's cooking session", async () => {
    const created = await user.agent.post('/api/recipes').send(recipe()).expect(201);
    const intruder = await registerUser(harness.app);
    await intruder.agent.get(`/api/cooking/${created.body.recipe.id}`).expect(403);
  });
});
