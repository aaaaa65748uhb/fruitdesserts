import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, registerUser, startFixtureServer, validAiJson, type TestHarness, type TestUser } from './helpers.js';

let harness: TestHarness;
let user: TestUser;

const PASTED_RECIPE = `Shakshuka for two.
Ingredients: 2 tbsp olive oil, 1 onion, 3 cloves garlic, 400 g chopped tomatoes, 4 eggs, salt to taste.
Method: fry the onion and garlic, add the tomatoes, simmer for 10 minutes, crack in the eggs and cover until set.`;

const JSON_LD_PAGE = `<!doctype html>
<html><head>
<title>Best Banana Bread</title>
<meta property="og:title" content="Best Banana Bread" />
<meta property="og:image" content="https://cdn.example.test/banana.jpg" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Best Banana Bread",
  "description": "Moist banana bread.",
  "recipeYield": "8 servings",
  "prepTime": "PT15M",
  "cookTime": "PT55M",
  "recipeCuisine": "American",
  "keywords": "baking, banana",
  "image": "https://cdn.example.test/banana.jpg",
  "recipeIngredient": ["3 ripe bananas", "1 1/2 cups all-purpose flour", "100 g butter, melted", "salt to taste"],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Heat the oven to 175 C." },
    { "@type": "HowToStep", "text": "Mash the bananas and mix with the melted butter." },
    { "@type": "HowToStep", "text": "Fold in the flour and bake for 55 minutes." }
  ]
}
</script>
</head><body><p>Enjoy.</p></body></html>`;

const PLAIN_PAGE = `<!doctype html><html><head>
<title>Grandma's soup</title>
<meta property="og:description" content="A rich chicken soup with carrots, celery and noodles that simmers for two hours." />
</head><body><p>Simmer a whole chicken with carrots, celery, onion and noodles for two hours, season with salt and pepper, then serve hot.</p></body></html>`;

beforeEach(async () => {
  harness = createHarness();
  user = await registerUser(harness.app);
});
afterEach(() => harness.close());

describe('capabilities', () => {
  it('reports the configured provider', async () => {
    const response = await user.agent.get('/api/import/capabilities').expect(200);
    expect(response.body.ai.configured).toBe(true);
    expect(response.body.ai.provider).toBe('mock');
    expect(response.body).not.toHaveProperty('apiKey');
  });

  it('reports AI as unavailable when no credentials are configured', async () => {
    const bare = createHarness({ provider: null, env: { AI_API_KEY: undefined } });
    try {
      const bareUser = await registerUser(bare.app);
      const response = await bareUser.agent.get('/api/import/capabilities').expect(200);
      expect(response.body.ai.configured).toBe(false);
      expect(response.body.ai.reason).toMatch(/AI_API_KEY/);
    } finally {
      bare.close();
    }
  });
});

describe('import from pasted text', () => {
  it('analyses, validates and saves the recipe', async () => {
    harness.provider!.push(validAiJson());
    const response = await user.agent.post('/api/import/analyze').send({ type: 'text', text: PASTED_RECIPE }).expect(201);

    expect(response.body.recipe.title).toBe('Creamy Garlic Pasta');
    expect(response.body.recipe.sourceType).toBe('text');
    expect(response.body.analysis.source).toBe('ai');
    expect(harness.provider!.calls).toHaveLength(1);
    expect(harness.provider!.calls[0].input.pastedText).toContain('Shakshuka');

    const saved = await user.agent.get(`/api/recipes/${response.body.recipe.id}`).expect(200);
    expect(saved.body.recipe.ingredients).toHaveLength(5);
  });

  it('reuses a recent identical analysis instead of paying for a second one', async () => {
    harness.provider!.push(validAiJson());
    await user.agent.post('/api/import/analyze').send({ type: 'text', text: PASTED_RECIPE }).expect(201);
    const second = await user.agent.post('/api/import/analyze').send({ type: 'text', text: PASTED_RECIPE }).expect(201);

    expect(harness.provider!.calls).toHaveLength(1);
    expect(second.body.analysis.cached).toBe(true);
  });

  it('rejects a snippet that is too short to be a recipe', async () => {
    const response = await user.agent.post('/api/import/analyze').send({ type: 'text', text: 'yum' }).expect(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(harness.provider!.calls).toHaveLength(0);
  });

  it('surfaces a controlled error and records the failure when the AI misbehaves', async () => {
    harness.provider!.push('not json', 'still not json', 'nope');
    const response = await user.agent.post('/api/import/analyze').send({ type: 'text', text: PASTED_RECIPE }).expect(502);

    expect(response.body.error.code).toBe('AI_INVALID_RESPONSE');
    expect(response.body.error).not.toHaveProperty('stack');
    expect((await user.agent.get('/api/recipes').expect(200)).body.items).toHaveLength(0);

    const history = await user.agent.get('/api/import/history').expect(200);
    expect(history.body.analyses[0].status).toBe('failed');
    expect(history.body.analyses[0].errorCode).toBe('AI_INVALID_RESPONSE');
  });

  it('answers 503 with a clear reason when the server has no AI credentials', async () => {
    const bare = createHarness({ provider: null, env: { AI_API_KEY: undefined } });
    try {
      const bareUser = await registerUser(bare.app);
      const response = await bareUser.agent.post('/api/import/analyze').send({ type: 'text', text: PASTED_RECIPE }).expect(503);
      expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
      expect(response.body.error.details.reason).toMatch(/AI_API_KEY/);
      expect(response.body.error.recovery).toContain('Create the recipe manually');
    } finally {
      bare.close();
    }
  });
});

describe('import from a URL', () => {
  it('imports a schema.org recipe without calling the AI at all', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(JSON_LD_PAGE);
    });
    try {
      const response = await user.agent.post('/api/import/analyze').send({ type: 'url', url: fixture.url }).expect(201);

      expect(harness.provider!.calls).toHaveLength(0);
      expect(response.body.analysis.provider).toBe('structured-data');
      const recipe = response.body.recipe;
      expect(recipe.title).toBe('Best Banana Bread');
      expect(recipe.servings).toBe(8);
      expect(recipe.prepMinutes).toBe(15);
      expect(recipe.cookMinutes).toBe(55);
      expect(recipe.imageUrl).toBe('https://cdn.example.test/banana.jpg');
      expect(recipe.steps).toHaveLength(3);
      expect(recipe.steps[0].temperatureC).toBe(175);

      const flour = recipe.ingredients.find((i: { name: string }) => i.name.includes('flour'));
      expect(flour.quantity).toBeCloseTo(1.5);
      expect(flour.unit).toBe('cup');
      const salt = recipe.ingredients.find((i: { name: string }) => i.name === 'salt');
      expect(salt.quantity).toBeNull();
      expect(salt.scalable).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it('falls back to the AI when the page has no structured recipe', async () => {
    harness.provider!.push(validAiJson());
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PLAIN_PAGE);
    });
    try {
      const response = await user.agent.post('/api/import/analyze').send({ type: 'url', url: fixture.url }).expect(201);
      expect(harness.provider!.calls).toHaveLength(1);
      expect(harness.provider!.calls[0].input.title).toBe("Grandma's soup");
      expect(response.body.recipe.sourceUrl).toContain('127.0.0.1');
    } finally {
      await fixture.close();
    }
  });

  it('rejects a malformed link and an unsupported scheme', async () => {
    expect((await user.agent.post('/api/import/analyze').send({ type: 'url', url: 'nonsense' }).expect(400)).body.error.code).toBe(
      'BAD_REQUEST',
    );
    expect(
      (await user.agent.post('/api/import/analyze').send({ type: 'url', url: 'ftp://example.test/x' }).expect(400)).body.error.code,
    ).toBe('SOURCE_UNSUPPORTED');
  });

  it('blocks requests to internal addresses (SSRF guard)', async () => {
    const guarded = createHarness();
    // The guard is only relaxed for fixtures; here it runs as in production.
    guarded.ctx.allowPrivateNetworkFetch = false;
    try {
      const guardedUser = await registerUser(guarded.app);
      const response = await guardedUser.agent
        .post('/api/import/analyze')
        .send({ type: 'url', url: 'http://127.0.0.1:9/admin' })
        .expect(400);
      expect(response.body.error.code).toBe('SOURCE_UNSUPPORTED');
    } finally {
      guarded.close();
    }
  });

  it('explains what to do when the source refuses automated access', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(403);
      res.end('nope');
    });
    try {
      const response = await user.agent.post('/api/import/analyze').send({ type: 'url', url: fixture.url }).expect(403);
      expect(response.body.error.code).toBe('SOURCE_UNSUPPORTED');
      expect(response.body.error.recovery).toEqual(
        expect.arrayContaining(['Upload a screenshot', 'Paste the recipe text instead']),
      );
    } finally {
      await fixture.close();
    }
  });

  it('reports a dead link as not found', async () => {
    const fixture = await startFixtureServer((_req, res) => {
      res.writeHead(404);
      res.end('gone');
    });
    try {
      const response = await user.agent.post('/api/import/analyze').send({ type: 'url', url: fixture.url }).expect(404);
      expect(response.body.error.code).toBe('SOURCE_UNREACHABLE');
    } finally {
      await fixture.close();
    }
  });
});

describe('import from screenshots and video', () => {
  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('accepts a screenshot and passes it to the model', async () => {
    harness.provider!.push(validAiJson());
    const response = await user.agent
      .post('/api/import/analyze')
      .send({ type: 'image', images: [tinyPng], ocrText: 'Pasta with garlic and cream, serves 2.' })
      .expect(201);

    expect(response.body.recipe.sourceType).toBe('image');
    expect(harness.provider!.calls[0].input.images).toHaveLength(1);
  });

  it('rejects a file that is not an image', async () => {
    const response = await user.agent
      .post('/api/import/analyze')
      .send({ type: 'image', images: ['data:application/pdf;base64,AAAA'] })
      .expect(400);
    expect(response.body.error.message).toMatch(/PNG, JPEG or WebP/);
  });

  it('rejects an oversized upload', async () => {
    const small = createHarness({ env: { MAX_UPLOAD_BYTES: '2048' } });
    try {
      const smallUser = await registerUser(small.app);
      const big = `data:image/png;base64,${'A'.repeat(8000)}`;
      const response = await smallUser.agent.post('/api/import/analyze').send({ type: 'image', images: [big] }).expect(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    } finally {
      small.close();
    }
  });

  it('refuses to invent a recipe from a video with no readable content', async () => {
    const response = await user.agent
      .post('/api/import/analyze')
      .send({ type: 'video', filename: 'clip.mp4', durationSeconds: 42, sizeBytes: 1024 })
      .expect(422);

    expect(response.body.error.code).toBe('INSUFFICIENT_SOURCE_DATA');
    expect(response.body.error.recovery).toEqual(
      expect.arrayContaining(['Upload a screenshot of the recipe', 'Paste the recipe text']),
    );
    expect(harness.provider!.calls).toHaveLength(0);
  });

  it('uses the caption when a video provides one', async () => {
    harness.provider!.push(validAiJson());
    const response = await user.agent
      .post('/api/import/analyze')
      .send({
        type: 'video',
        filename: 'clip.mp4',
        captions: ['200 g spaghetti, 3 cloves garlic, cream. Boil, fry, toss. Serves 2.'],
      })
      .expect(201);

    expect(response.body.warnings.some((w: string) => w.includes('not transcribed'))).toBe(true);
    expect(response.body.recipe.sourceType).toBe('video');
  });
});
