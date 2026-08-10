import type { Express } from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createContext, type AppContext } from '../src/context.js';
import type { AIProvider, AIProviderResult, AnalyzeOptions, AnalyzeRecipeInput } from '../src/ai/providers/AIProvider.js';

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: ':memory:',
  SESSION_SECRET: 'test-secret-value-that-is-long-enough-1234567890',
  WEB_ORIGIN: 'http://localhost:5173',
  AI_API_KEY: 'test-key',
  AI_API_BASE_URL: 'https://ai.example.test/v1',
  AI_MODEL: 'test-model',
  AI_MAX_RETRIES: '2',
} as const;

/**
 * Scripted provider: every behaviour we need to test (good answer, malformed
 * JSON, missing fields, transport failure) is expressed as a queued response.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  readonly calls: Array<{ input: AnalyzeRecipeInput; options: AnalyzeOptions }> = [];
  private queue: Array<string | Error | (() => Promise<string>)> = [];

  constructor(responses: Array<string | Error | (() => Promise<string>)> = []) {
    this.queue = [...responses];
  }

  push(...responses: Array<string | Error | (() => Promise<string>)>): this {
    this.queue.push(...responses);
    return this;
  }

  async analyzeRecipe(input: AnalyzeRecipeInput, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    this.calls.push({ input, options });
    const next = this.queue.shift();
    if (next === undefined) throw new Error('MockProvider: no scripted response left');
    if (next instanceof Error) throw next;
    const text = typeof next === 'function' ? await next() : next;
    return { text, model: this.model, finishReason: 'stop' };
  }
}

export interface TestHarness {
  app: Express;
  ctx: AppContext;
  provider: MockProvider | null;
  close: () => void;
}

export function createHarness(
  options: { provider?: AIProvider | null; env?: Record<string, string | undefined> } = {},
): TestHarness {
  const config = loadConfig({ ...TEST_ENV, ...options.env } as NodeJS.ProcessEnv);
  const provider = options.provider === undefined ? new MockProvider() : options.provider;
  const ctx = createContext({ config, provider, allowPrivateNetworkFetch: true });
  const app = createApp(ctx);
  return {
    app,
    ctx,
    provider: provider instanceof MockProvider ? provider : null,
    close: () => ctx.db.close(),
  };
}

export interface TestUser {
  agent: ReturnType<typeof request.agent>;
  id: string;
  email: string;
  password: string;
}

let userCounter = 0;

export async function registerUser(app: Express, overrides: Partial<{ email: string; password: string; displayName: string }> = {}): Promise<TestUser> {
  userCounter += 1;
  const email = overrides.email ?? `user${userCounter}-${Date.now()}@example.test`;
  const password = overrides.password ?? 'correct-horse-battery';
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/register')
    .send({ email, password, displayName: overrides.displayName ?? `User ${userCounter}` })
    .expect(201);
  return { agent, id: response.body.user.id as string, email, password };
}

/** A minimal, schema-valid AI answer used as the "happy path" fixture. */
export function validAiJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: 'Creamy Garlic Pasta',
    description: 'A quick weeknight pasta.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    difficulty: 'easy',
    cuisine: 'Italian',
    tags: ['pasta', 'quick'],
    equipment: ['large pot'],
    notes: null,
    missingInfo: [],
    confidence: 0.8,
    ingredients: [
      { name: 'spaghetti', quantity: 200, unit: 'g', note: null, optional: false, estimated: false },
      { name: 'garlic', quantity: 3, unit: 'cloves', note: 'thinly sliced', optional: false, estimated: false },
      { name: 'heavy cream', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true },
      { name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false },
      { name: 'chili flakes', quantity: 1, unit: 'tsp', note: null, optional: true, estimated: false },
    ],
    steps: [
      { instruction: 'Boil the spaghetti in salted water until al dente.', durationSeconds: 540, temperatureC: null, estimated: false },
      { instruction: 'Fry the garlic in olive oil until fragrant.', durationSeconds: 120, temperatureC: null, estimated: false },
      { instruction: 'Add the cream, then toss the pasta through the sauce.', durationSeconds: null, temperatureC: null, estimated: false },
    ],
    ...overrides,
  });
}

/** Starts a throwaway HTTP server for source-extraction / provider tests. */
export async function startFixtureServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void>; requests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: string }> }> {
  const requests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: string }> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests.push({ url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
