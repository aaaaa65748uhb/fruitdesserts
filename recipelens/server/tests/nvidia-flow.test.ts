/**
 * The whole product flow driven through the NVIDIA provider class:
 *
 *   TikTok link → backend source extraction → NvidiaProvider (real HTTP)
 *   → JSON recovery → Zod validation → normalisation → SQLite → API response
 *
 * Both fixtures behave like the real thing: the social page exposes only
 * OpenGraph metadata, and the model answers the way Llama models usually do —
 * JSON wrapped in a markdown fence, with a stray sentence in front.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NvidiaProvider } from '../src/ai/providers/NvidiaProvider.js';
import { createHarness, registerUser, startFixtureServer, type TestHarness, type TestUser } from './helpers.js';

const MODEL = 'meta/llama-4-maverick-17b-128e-instruct';

/** What a NIM Llama model realistically returns: prose + a fenced object. */
const LLAMA_STYLE_ANSWER = `Here is the recipe in the requested format:

\`\`\`json
{
  "title": "One-Pan Garlic Butter Chicken",
  "description": "A quick weeknight chicken dinner from a TikTok video.",
  "servings": 4,
  "prepMinutes": 10,
  "cookMinutes": 20,
  "difficulty": "easy",
  "cuisine": null,
  "tags": ["chicken", "one-pan"],
  "equipment": ["large skillet"],
  "notes": null,
  "missingInfo": ["oven temperature"],
  "confidence": 0.62,
  "ingredients": [
    {"name": "chicken thighs", "quantity": 600, "unit": "g", "note": "boneless", "optional": false, "estimated": false},
    {"name": "butter", "quantity": 50, "unit": "g", "note": null, "optional": false, "estimated": true},
    {"name": "garlic", "quantity": 4, "unit": "cloves", "note": "minced", "optional": false, "estimated": false},
    {"name": "salt", "quantity": null, "unit": null, "note": "to taste", "optional": false, "estimated": false}
  ],
  "steps": [
    {"instruction": "Season the chicken thighs on both sides.", "durationSeconds": null, "temperatureC": null, "estimated": false},
    {"instruction": "Sear the chicken in the butter until golden.", "durationSeconds": 480, "temperatureC": null, "estimated": true},
    {"instruction": "Add the garlic and cook until fragrant, then serve.", "durationSeconds": 60, "temperatureC": null, "estimated": false}
  ]
}
\`\`\`

Let me know if you would like it adjusted.`;

let harness: TestHarness;
let user: TestUser;
let nvidia: Awaited<ReturnType<typeof startFixtureServer>>;
let social: Awaited<ReturnType<typeof startFixtureServer>>;

beforeEach(async () => {
  nvidia = await startFixtureServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        model: MODEL,
        choices: [{ message: { role: 'assistant', content: LLAMA_STYLE_ANSWER }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 900, completion_tokens: 520 },
      }),
    );
  });

  // A social video page: OpenGraph only, no machine-readable recipe.
  social = await startFixtureServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <meta property="og:title" content="One-pan garlic butter chicken 🧈🔥" />
      <meta property="og:description" content="600g chicken thighs, butter, 4 cloves garlic. Sear, add garlic, done. Serves 4." />
      <meta property="og:image" content="https://cdn.example.test/thumb.jpg" />
      </head><body><p>Follow for more</p></body></html>`);
  });

  harness = createHarness({
    provider: new NvidiaProvider({ apiKey: 'nvapi-test-key', baseUrl: nvidia.url, model: MODEL, timeoutMs: 15000 }),
  });
  user = await registerUser(harness.app);
});

afterEach(async () => {
  harness.close();
  await nvidia.close();
  await social.close();
});

describe('shared link → NVIDIA → validated recipe → database', () => {
  it('imports a social video link end to end', async () => {
    const response = await user.agent.post('/api/import/analyze').send({ type: 'url', url: social.url }).expect(201);

    // The AI call really went to the NVIDIA-shaped endpoint.
    expect(nvidia.requests).toHaveLength(1);
    expect(nvidia.requests[0].url).toBe('/chat/completions');
    expect(nvidia.requests[0].headers.authorization).toBe('Bearer nvapi-test-key');
    const sent = JSON.parse(nvidia.requests[0].body);
    expect(sent.model).toBe(MODEL);
    // The page's own words were what we asked the model about.
    expect(JSON.stringify(sent.messages)).toContain('garlic');

    // Prose + fences were recovered, then validated.
    const recipe = response.body.recipe;
    expect(recipe.title).toBe('One-Pan Garlic Butter Chicken');
    expect(recipe.servings).toBe(4);
    expect(recipe.ingredients).toHaveLength(4);
    expect(recipe.steps).toHaveLength(3);
    expect(response.body.analysis.provider).toBe('nvidia');
    expect(response.body.analysis.model).toBe(MODEL);

    // Honesty rules survived the round trip.
    expect(recipe.ingredients.find((i: { name: string }) => i.name === 'butter').estimated).toBe(true);
    const salt = recipe.ingredients.find((i: { name: string }) => i.name === 'salt');
    expect(salt.quantity).toBeNull();
    expect(salt.scalable).toBe(false);
    expect(recipe.missingInfo).toContain('oven temperature');

    // It is in the database, readable through the API the app uses.
    const stored = await user.agent.get(`/api/recipes/${recipe.id}`).expect(200);
    expect(stored.body.recipe.title).toBe('One-Pan Garlic Butter Chicken');

    // Scaling works on what NVIDIA returned.
    const scaled = await user.agent.get(`/api/recipes/${recipe.id}/scaled?servings=8`).expect(200);
    expect(scaled.body.factor).toBe(2);
    expect(scaled.body.ingredients.find((i: { name: string }) => i.name === 'chicken thighs').scaledQuantity).toBe(1200);
    expect(scaled.body.ingredients.find((i: { name: string }) => i.name === 'salt').scaledQuantity).toBeNull();

    // And it reaches the shopping list at the servings being cooked, written
    // the way a shopper reads it: 1200 g becomes 1.2 kg.
    const shopping = await user.agent
      .post('/api/shopping-list/from-recipe')
      .send({ recipeId: recipe.id, servings: 8 })
      .expect(201);
    const chicken = shopping.body.items.find((i: { name: string }) => i.name === 'chicken thighs');
    expect(chicken.quantity).toBe(1.2);
    expect(chicken.unit).toBe('kg');
    expect(chicken.displayText).toBe('1.2 kg');

    // The analysis was recorded against the right provider and model.
    const history = await user.agent.get('/api/import/history').expect(200);
    expect(history.body.analyses[0].provider).toBe('nvidia');
    expect(history.body.analyses[0].status).toBe('success');
  });

  it('reuses the stored analysis instead of paying NVIDIA twice for one link', async () => {
    await user.agent.post('/api/import/analyze').send({ type: 'url', url: social.url }).expect(201);
    const second = await user.agent.post('/api/import/analyze').send({ type: 'url', url: social.url }).expect(201);

    expect(nvidia.requests).toHaveLength(1);
    expect(second.body.analysis.cached).toBe(true);
  });

  it('imports pasted text through the same provider', async () => {
    const response = await user.agent
      .post('/api/import/analyze')
      .send({
        type: 'text',
        text: '600 g chicken thighs, 50 g butter, 4 cloves garlic, salt. Sear the chicken, add garlic, serve. Serves 4.',
      })
      .expect(201);

    expect(response.body.recipe.title).toBe('One-Pan Garlic Butter Chicken');
    expect(response.body.analysis.provider).toBe('nvidia');
  });
});
