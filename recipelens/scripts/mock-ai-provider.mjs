/**
 * A local, OpenAI-compatible endpoint used for END-TO-END TESTING ONLY.
 *
 * It is a test double for a model provider — it lets the whole stack be
 * exercised (routes, validation, database, UI) on a machine with no AI
 * credentials. It is never used by `npm run start`: production traffic always
 * goes to the provider configured through AI_API_KEY / AI_API_BASE_URL.
 *
 * Usage: node scripts/mock-ai-provider.mjs [port]
 */
import http from 'node:http';

const RECIPE = {
  title: 'Creamy Garlic Pasta',
  description: 'A fast weeknight pasta built on garlic, cream and good spaghetti.',
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 15,
  difficulty: 'easy',
  cuisine: 'Italian',
  tags: ['pasta', 'quick', 'vegetarian'],
  equipment: ['large pot', 'frying pan'],
  notes: null,
  missingInfo: [],
  confidence: 0.82,
  ingredients: [
    { name: 'spaghetti', quantity: 200, unit: 'g', note: null, optional: false, estimated: false },
    { name: 'garlic', quantity: 3, unit: 'cloves', note: 'thinly sliced', optional: false, estimated: false },
    { name: 'heavy cream', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true },
    { name: 'parmesan', quantity: 40, unit: 'g', note: 'finely grated', optional: false, estimated: true },
    { name: 'olive oil', quantity: 2, unit: 'tbsp', note: null, optional: false, estimated: false },
    { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false },
    { name: 'chili flakes', quantity: 1, unit: 'tsp', note: null, optional: true, estimated: false },
  ],
  steps: [
    { instruction: 'Bring a large pot of salted water to the boil and cook the spaghetti until al dente.', durationSeconds: 540, temperatureC: null, estimated: false },
    { instruction: 'Warm the olive oil in a pan and fry the sliced garlic until pale gold.', durationSeconds: 120, temperatureC: null, estimated: false },
    { instruction: 'Pour in the cream, add the parmesan and simmer until it coats a spoon.', durationSeconds: 180, temperatureC: null, estimated: true },
    { instruction: 'Toss the drained pasta through the sauce, season, and serve.', durationSeconds: null, temperatureC: null, estimated: false },
  ],
};

const port = Number(process.argv[2] ?? 0);

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    if (!req.url?.endsWith('/chat/completions')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":{"message":"not found"}}');
      return;
    }
    if (req.headers.authorization !== `Bearer ${process.env.MOCK_AI_KEY ?? 'local-e2e-key'}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":{"message":"invalid api key"}}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        model: 'mock-recipe-model',
        choices: [{ message: { role: 'assistant', content: JSON.stringify(RECIPE) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 512, completion_tokens: 320 },
      }),
    );
  });
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`mock-ai-provider listening on http://127.0.0.1:${address.port}/v1`);
});
