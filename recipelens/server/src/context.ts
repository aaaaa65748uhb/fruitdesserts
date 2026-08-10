/**
 * Application container: one place that wires configuration, database,
 * repositories and the AI service together. Routes receive it via
 * `req.app.locals.ctx`, which keeps them free of module-level singletons and
 * makes every test able to build an isolated instance.
 */
import type { AppConfig } from './config/env.js';
import { openDatabase, type Db } from './db/index.js';
import { UserRepo } from './db/users.js';
import { RecipeRepo } from './db/recipes.js';
import { CollectionRepo } from './db/collections.js';
import { ShoppingRepo } from './db/shopping.js';
import { CookingRepo } from './db/cooking.js';
import { AnalysisRepo } from './db/analyses.js';
import { ProgressTracker } from './lib/progress.js';
import { RecipeAIService } from './ai/RecipeAIService.js';
import { createProvider } from './ai/providers/factory.js';
import type { AIProvider } from './ai/providers/AIProvider.js';

export interface AppContext {
  config: AppConfig;
  db: Db;
  users: UserRepo;
  recipes: RecipeRepo;
  collections: CollectionRepo;
  shopping: ShoppingRepo;
  cooking: CookingRepo;
  analyses: AnalysisRepo;
  /** Live import progress, keyed by the client's request id. */
  progress: ProgressTracker;
  /** Null when the server has no AI credentials — routes answer 503. */
  ai: RecipeAIService | null;
  /** Reason the AI is unavailable, safe to show to an operator. */
  aiDisabledReason: string | null;
  /** Test/dev hook: lets fixtures serve HTTP from 127.0.0.1. */
  allowPrivateNetworkFetch: boolean;
  fetchImpl: typeof fetch;
}

export interface CreateContextOptions {
  config: AppConfig;
  db?: Db;
  /** Overrides the provider built from configuration (used by tests). */
  provider?: AIProvider | null;
  fetchImpl?: typeof fetch;
  allowPrivateNetworkFetch?: boolean;
}

export function createContext(options: CreateContextOptions): AppContext {
  const { config } = options;
  const db = options.db ?? openDatabase(config.databaseFile);

  let ai: RecipeAIService | null = null;
  let aiDisabledReason: string | null = config.ai.disabledReason;

  let provider: AIProvider | null = null;
  if (options.provider !== undefined) {
    provider = options.provider;
  } else if (config.ai.configured) {
    try {
      provider = createProvider(config.ai, options.fetchImpl);
    } catch (error) {
      // A bad AI_PROVIDER value must not stop the server: the rest of the app
      // keeps working and the AI routes report the configuration problem.
      provider = null;
      aiDisabledReason = error instanceof Error ? error.message : 'The AI provider could not be created.';
    }
  }

  if (provider) {
    ai = new RecipeAIService(provider, { maxRetries: config.ai.maxRetries });
    aiDisabledReason = null;
  }

  return {
    config,
    db,
    users: new UserRepo(db),
    recipes: new RecipeRepo(db),
    collections: new CollectionRepo(db),
    shopping: new ShoppingRepo(db),
    cooking: new CookingRepo(db),
    analyses: new AnalysisRepo(db),
    progress: new ProgressTracker(),
    ai,
    aiDisabledReason,
    allowPrivateNetworkFetch: options.allowPrivateNetworkFetch ?? config.isTest,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}
