import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, registerUser, type TestHarness, type TestUser } from './helpers.js';

let harness: TestHarness;
let user: TestUser;

const sampleRecipe = {
  title: 'Tomato Soup',
  description: 'Simple and warming.',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 'easy',
  cuisine: null,
  imageUrl: null,
  sourceUrl: null,
  sourceType: 'manual',
  tags: ['soup'],
  equipment: ['pot'],
  notes: null,
  missingInfo: [],
  confidence: null,
  ingredients: [
    { name: 'tomatoes', quantity: 500, unit: 'g', note: null, optional: false, estimated: false, scalable: true, group: null, position: 0 },
    { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false, scalable: false, group: null, position: 1 },
  ],
  steps: [
    { position: 0, instruction: 'Chop the tomatoes.', durationSeconds: null, temperatureC: null, estimated: false },
    { position: 1, instruction: 'Simmer for 20 minutes.', durationSeconds: 1200, temperatureC: null, estimated: false },
  ],
};

beforeEach(async () => {
  harness = createHarness();
  user = await registerUser(harness.app);
});
afterEach(() => harness.close());

describe('recipe CRUD', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const id = created.body.recipe.id as string;
    expect(created.body.recipe.ingredients).toHaveLength(2);
    expect(created.body.recipe.version).toBe(1);

    const read = await user.agent.get(`/api/recipes/${id}`).expect(200);
    expect(read.body.recipe.title).toBe('Tomato Soup');

    const updated = await user.agent
      .put(`/api/recipes/${id}`)
      .send({
        ...sampleRecipe,
        title: 'Roasted Tomato Soup',
        servings: 4,
        version: 1,
        ingredients: [{ ...sampleRecipe.ingredients[0], quantity: 1000 }],
      })
      .expect(200);
    expect(updated.body.recipe.title).toBe('Roasted Tomato Soup');
    expect(updated.body.recipe.ingredients).toHaveLength(1);
    expect(updated.body.recipe.version).toBe(2);

    await user.agent.delete(`/api/recipes/${id}`).expect(200);
    await user.agent.get(`/api/recipes/${id}`).expect(404);
  });

  it('rejects malformed data', async () => {
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, title: '' }).expect(422);
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, ingredients: [] }).expect(422);
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, servings: -3 }).expect(422);
    await user.agent
      .post('/api/recipes')
      .send({ ...sampleRecipe, steps: [{ position: 0, instruction: '', durationSeconds: null, temperatureC: null, estimated: false }] })
      .expect(422);
  });

  it('refuses non-http URLs that would end up in an anchor or image tag', async () => {
    await user.agent
      .post('/api/recipes')
      .send({ ...sampleRecipe, sourceUrl: 'javascript:alert(document.cookie)' })
      .expect(422);
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, imageUrl: 'data:text/html,<script>x</script>' }).expect(422);
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, sourceUrl: 'https://example.test/recipe' }).expect(201);
  });

  it('detects concurrent edits with a version conflict', async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const id = created.body.recipe.id as string;

    await user.agent.put(`/api/recipes/${id}`).send({ ...sampleRecipe, title: 'First edit', version: 1 }).expect(200);
    const conflict = await user.agent
      .put(`/api/recipes/${id}`)
      .send({ ...sampleRecipe, title: 'Second edit from a stale tab', version: 1 })
      .expect(409);
    expect(conflict.body.error.code).toBe('VERSION_CONFLICT');

    const current = await user.agent.get(`/api/recipes/${id}`).expect(200);
    expect(current.body.recipe.title).toBe('First edit');
  });

  it('stores the SQL-injection style title verbatim instead of executing it', async () => {
    const nasty = "'; DROP TABLE recipes; --";
    const created = await user.agent.post('/api/recipes').send({ ...sampleRecipe, title: nasty }).expect(201);
    expect(created.body.recipe.title).toBe(nasty);
    const list = await user.agent.get('/api/recipes').expect(200);
    expect(list.body.total).toBe(1);
  });
});

describe('authorization', () => {
  it("refuses access to another user's recipe", async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const id = created.body.recipe.id as string;
    const intruder = await registerUser(harness.app);

    await intruder.agent.get(`/api/recipes/${id}`).expect(403);
    await intruder.agent.put(`/api/recipes/${id}`).send({ ...sampleRecipe, title: 'Mine now' }).expect(403);
    await intruder.agent.delete(`/api/recipes/${id}`).expect(403);
    await intruder.agent.post(`/api/recipes/${id}/favorite`).send({ favorite: true }).expect(403);

    const stillThere = await user.agent.get(`/api/recipes/${id}`).expect(200);
    expect(stillThere.body.recipe.title).toBe('Tomato Soup');
  });

  it('keeps recipe lists per user', async () => {
    await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const other = await registerUser(harness.app);
    const list = await other.agent.get('/api/recipes').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('returns 404 for an id that does not exist anywhere', async () => {
    await user.agent.get('/api/recipes/11111111-2222-3333-4444-555555555555').expect(404);
  });
});

describe('favorites, search and scaling', () => {
  it('toggles favorites and filters by them', async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const id = created.body.recipe.id as string;

    await user.agent.post(`/api/recipes/${id}/favorite`).send({ favorite: true }).expect(200);
    const favorites = await user.agent.get('/api/recipes?favorite=true').expect(200);
    expect(favorites.body.items).toHaveLength(1);
    expect(favorites.body.items[0].isFavorite).toBe(true);

    await user.agent.post(`/api/recipes/${id}/favorite`).send({ favorite: false }).expect(200);
    const none = await user.agent.get('/api/recipes?favorite=true').expect(200);
    expect(none.body.items).toHaveLength(0);
  });

  it('searches titles and ingredient names', async () => {
    await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    await user.agent.post('/api/recipes').send({ ...sampleRecipe, title: 'Pancakes' }).expect(201);

    expect((await user.agent.get('/api/recipes?search=tomato').expect(200)).body.items).toHaveLength(2);
    expect((await user.agent.get('/api/recipes?search=pancake').expect(200)).body.items).toHaveLength(1);
    expect((await user.agent.get('/api/recipes?search=sushi').expect(200)).body.items).toHaveLength(0);
  });

  it('scales quantities on the server for 2 → 4 and 4 → 1 servings', async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const id = created.body.recipe.id as string;

    const doubled = await user.agent.get(`/api/recipes/${id}/scaled?servings=4`).expect(200);
    expect(doubled.body.factor).toBe(2);
    expect(doubled.body.ingredients[0].scaledQuantity).toBe(1000);
    expect(doubled.body.ingredients[0].displayText).toBe('1 kg');
    expect(doubled.body.ingredients[1].scaledQuantity).toBeNull(); // salt, to taste

    const single = await user.agent.get(`/api/recipes/${id}/scaled?servings=1`).expect(200);
    expect(single.body.factor).toBe(0.5);
    expect(single.body.ingredients[0].scaledQuantity).toBe(250);

    await user.agent.get(`/api/recipes/${id}/scaled?servings=0`).expect(422);
  });
});

describe('collections', () => {
  it('groups recipes and enforces unique names', async () => {
    const created = await user.agent.post('/api/recipes').send(sampleRecipe).expect(201);
    const recipeId = created.body.recipe.id as string;

    const collection = await user.agent.post('/api/collections').send({ name: 'Weeknight' }).expect(201);
    const collectionId = collection.body.collection.id as string;
    await user.agent.post('/api/collections').send({ name: 'weeknight' }).expect(409);

    await user.agent.post(`/api/collections/${collectionId}/recipes`).send({ recipeId }).expect(201);
    const filtered = await user.agent.get(`/api/recipes?collectionId=${collectionId}`).expect(200);
    expect(filtered.body.items).toHaveLength(1);

    await user.agent.delete(`/api/collections/${collectionId}/recipes/${recipeId}`).expect(200);
    expect((await user.agent.get(`/api/recipes?collectionId=${collectionId}`).expect(200)).body.items).toHaveLength(0);
  });

  it("does not leak another user's collection", async () => {
    const collection = await user.agent.post('/api/collections').send({ name: 'Private' }).expect(201);
    const intruder = await registerUser(harness.app);
    await intruder.agent.patch(`/api/collections/${collection.body.collection.id}`).send({ name: 'Stolen' }).expect(404);
    expect((await intruder.agent.get('/api/collections').expect(200)).body.collections).toHaveLength(0);
  });
});
