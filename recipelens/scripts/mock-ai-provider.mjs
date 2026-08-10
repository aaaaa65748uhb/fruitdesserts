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

/** Task-specific answers, chosen from the system prompt the server sends. */
const NUTRITION = {
  calories: 612, protein: 18.4, carbs: 74, fat: 26, fiber: 3.1, sugar: 4.2, sodium: 480,
  basis: 'per-serving', confidence: 0.6, unaccounted: ['salt'], notes: 'Salt was not quantified.',
};

const SUBSTITUTIONS = {
  ingredient: 'heavy cream',
  options: [
    {
      replacement: 'Greek yoghurt',
      quantity: 150,
      unit: 'ml',
      why: 'It brings a similar body and richness to the sauce.',
      changes: 'Tangier, and it splits if boiled — stir it in off the heat.',
      suitability: 0.8,
    },
  ],
};

const CUSTOMIZATION = {
  title: 'High-protein creamy garlic pasta',
  description: 'The same dish with more protein.',
  ingredients: [
    { name: 'protein pasta', quantity: 200, unit: 'g', note: null, optional: false, estimated: false },
    { name: 'Greek yoghurt', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true },
    { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false },
  ],
  steps: [
    { instruction: 'Boil the protein pasta until al dente.', durationSeconds: 480, temperatureC: null, estimated: false },
    { instruction: 'Stir the yoghurt through off the heat.', durationSeconds: null, temperatureC: null, estimated: false },
  ],
  changes: ['Swapped wheat pasta for protein pasta.', 'Replaced the cream with Greek yoghurt.'],
  warnings: ['Yoghurt splits if it boils.'],
};

const CHAT = {
  answer: 'Yes — swap the 150 ml of cream for the same amount of evaporated milk and add it off the heat.',
  suggestions: ['Add it off the heat'],
  outsideRecipe: false,
};

function answerFor(body) {
  const system = String(body?.messages?.[0]?.content ?? '');
  if (system.includes('estimate nutrition')) return NUTRITION;
  if (system.includes('ingredient substitutions')) return SUBSTITUTIONS;
  if (system.includes('You adapt one specific recipe')) return CUSTOMIZATION;
  if (system.includes('answer questions about one specific recipe')) return CHAT;
  return RECIPE;
}

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
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      body = {};
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        model: 'mock-recipe-model',
        choices: [{ message: { role: 'assistant', content: JSON.stringify(answerFor(body)) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 512, completion_tokens: 320 },
      }),
    );
  });
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`mock-ai-provider listening on http://127.0.0.1:${address.port}/v1`);
});
