/**
 * The end-to-end user journey from the brief, exercised against the real API:
 * sign up → import → view → edit → rescale → favourite → shopping list →
 * cook → "refresh" → sign out → sign back in → everything still there.
 */
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, validAiJson, type TestHarness } from './helpers.js';

let harness: TestHarness;

beforeEach(() => {
  harness = createHarness();
});
afterEach(() => harness.close());

const SOURCE_TEXT = `Creamy garlic pasta, serves 2.
200 g spaghetti, 3 cloves garlic, 150 ml cream, salt to taste, chili flakes (optional).
Boil the pasta, fry the garlic, stir in the cream and toss.`;

describe('full user journey', () => {
  it('survives every step including a refresh and a re-login', async () => {
    const email = `journey-${Date.now()}@example.test`;
    const password = 'a-long-enough-password';
    const agent = request.agent(harness.app);

    // 1. Create an account.
    const registered = await agent.post('/api/auth/register').send({ email, password, displayName: 'Journey' }).expect(201);
    const userId = registered.body.user.id as string;

    // 2. Empty state to begin with.
    expect((await agent.get('/api/recipes').expect(200)).body.total).toBe(0);

    // 3-4. Import and analyse a recipe.
    harness.provider!.push(validAiJson());
    const imported = await agent.post('/api/import/analyze').send({ type: 'text', text: SOURCE_TEXT }).expect(201);
    const recipeId = imported.body.recipe.id as string;
    expect(imported.body.analysis.source).toBe('ai');

    // 5. View the generated recipe.
    const viewed = await agent.get(`/api/recipes/${recipeId}`).expect(200);
    expect(viewed.body.recipe.title).toBe('Creamy Garlic Pasta');
    expect(viewed.body.recipe.ingredients).toHaveLength(5);
    const cream = viewed.body.recipe.ingredients.find((i: { name: string }) => i.name === 'heavy cream');
    expect(cream.estimated).toBe(true); // clearly marked as AI-estimated

    // 6-8. Edit an ingredient (confirming the estimate) and save.
    const edited = {
      ...viewed.body.recipe,
      version: viewed.body.recipe.version,
      ingredients: viewed.body.recipe.ingredients.map((ingredient: { name: string; quantity: number | null }) =>
        ingredient.name === 'heavy cream' ? { ...ingredient, quantity: 200, estimated: false } : ingredient,
      ),
    };
    const saved = await agent.put(`/api/recipes/${recipeId}`).send(edited).expect(200);
    const savedCream = saved.body.recipe.ingredients.find((i: { name: string }) => i.name === 'heavy cream');
    expect(savedCream.quantity).toBe(200);
    expect(savedCream.estimated).toBe(false);

    // 7. Change servings (2 → 6) and check the maths.
    const scaled = await agent.get(`/api/recipes/${recipeId}/scaled?servings=6`).expect(200);
    expect(scaled.body.factor).toBe(3);
    const scaledPasta = scaled.body.ingredients.find((i: { name: string }) => i.name === 'spaghetti');
    expect(scaledPasta.scaledQuantity).toBe(600);
    const scaledSalt = scaled.body.ingredients.find((i: { name: string }) => i.name === 'salt');
    expect(scaledSalt.scaledQuantity).toBeNull();

    // 9. Favourite it.
    await agent.post(`/api/recipes/${recipeId}/favorite`).send({ favorite: true }).expect(200);
    expect((await agent.get('/api/recipes?favorite=true').expect(200)).body.items).toHaveLength(1);

    // 10. Add the (scaled) ingredients to the shopping list.
    const shopping = await agent.post('/api/shopping-list/from-recipe').send({ recipeId, servings: 6 }).expect(201);
    const listedPasta = shopping.body.items.find((i: { name: string }) => i.name === 'spaghetti');
    expect(listedPasta.quantity).toBe(600);

    // 11-12. Cook: walk through the steps.
    await agent.put(`/api/cooking/${recipeId}`).send({ currentStep: 0, servings: 6 }).expect(200);
    await agent.put(`/api/cooking/${recipeId}`).send({ currentStep: 1, completedSteps: [0] }).expect(200);
    await agent.put(`/api/cooking/${recipeId}`).send({ currentStep: 2, completedSteps: [0, 1] }).expect(200);

    // 13-14. "Refresh": a brand-new client with the same session cookie.
    const afterRefresh = request.agent(harness.app);
    await afterRefresh.post('/api/auth/login').send({ email, password }).expect(200);
    const resumed = await afterRefresh.get(`/api/cooking/${recipeId}`).expect(200);
    expect(resumed.body.session.currentStep).toBe(2);
    expect(resumed.body.session.completedSteps).toEqual([0, 1]);
    expect(resumed.body.session.servings).toBe(6);

    // 15. Log out.
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
    await agent.get(`/api/recipes/${recipeId}`).expect(401);

    // 16-17. Log back in — everything is still there.
    const again = request.agent(harness.app);
    const relogin = await again.post('/api/auth/login').send({ email, password }).expect(200);
    expect(relogin.body.user.id).toBe(userId);

    const recipes = await again.get('/api/recipes').expect(200);
    expect(recipes.body.total).toBe(1);
    expect(recipes.body.items[0].isFavorite).toBe(true);

    const finalRecipe = await again.get(`/api/recipes/${recipeId}`).expect(200);
    expect(finalRecipe.body.recipe.ingredients.find((i: { name: string }) => i.name === 'heavy cream').quantity).toBe(200);

    const finalList = await again.get('/api/shopping-list').expect(200);
    expect(finalList.body.items.length).toBeGreaterThan(0);

    const finalSession = await again.get(`/api/cooking/${recipeId}`).expect(200);
    expect(finalSession.body.session.currentStep).toBe(2);
  });
});
