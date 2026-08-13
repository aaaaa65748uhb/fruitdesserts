/**
 * Typed API client.
 *
 * Every call funnels through `request`, so loading, error and retry behaviour
 * is identical everywhere and the server's error envelope
 * ({ error: { code, message, recovery, retryable } }) is preserved.
 */
import type { ChatAnswer, Customization, CustomizationGoal, Ingredient, Nutrition, RecipeDraft, Step, Substitution } from '../shared.js';
import { apiBaseUrl, isNative, tokenStore } from './runtime.js';

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
}

export interface Recipe extends RecipeDraft {
  id: string;
  userId: string;
  isFavorite: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string[];
  sourceType: string;
  sourceUrl: string | null;
  isFavorite: boolean;
  ingredientCount: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  checked: boolean;
  recipeId: string | null;
  displayText: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  recipeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CookingSession {
  id: string;
  recipeId: string;
  currentStep: number;
  completedSteps: number[];
  servings: number | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ImportCapabilities {
  ai: { configured: boolean; provider: string | null; model: string | null; reason: string | null };
  sources: { url: boolean; text: boolean; image: boolean; video: boolean };
  limits: { maxUploadBytes: number; maxImages: number };
  notes: string[];
}

export interface ImportProgress {
  known: boolean;
  phases: Array<{ phase: string; label: string; at: number }>;
  finished: boolean;
  error: string | null;
  /** Set once the import produced a recipe, even if nobody was still waiting. */
  recipeId?: string | null;
  recipe?: Recipe | null;
}

export interface ImportResult {
  recipe: Recipe;
  analysis: {
    id: string;
    source: 'ai' | 'cache' | 'structured-data';
    provider: string;
    model: string;
    attempts: number;
    durationMs: number;
    cached: boolean;
    repaired?: boolean;
  };
  warnings: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly recovery?: string[];
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, extra: { details?: unknown; recovery?: string[]; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.recovery = extra.recovery;
    this.retryable = extra.retryable ?? status >= 500;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Anything that wants to know a session went away (e.g. the auth provider). */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = 90_000 } = options;
  const extraHeaders = options.headers ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (isNative) {
    // The APK cannot use cookies across origins, so it carries a bearer token
    // and tells the server to issue one on sign-in.
    headers['x-recipelens-client'] = 'native';
    const token = await tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let base: string;
  try {
    base = apiBaseUrl();
  } catch (error) {
    clearTimeout(timer);
    throw new ApiError(0, 'NOT_CONFIGURED', error instanceof Error ? error.message : 'This build has no backend address.');
  }

  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new ApiError(
        0,
        'TIMEOUT',
        'The server did not answer in time. A server that has been idle can take a minute to wake up — try again.',
        { retryable: true },
      );
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach RecipeLens. Check your connection and try again.', {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = (payload as { error?: { code?: string; message?: string; details?: unknown; recovery?: string[]; retryable?: boolean } })?.error;
    if (response.status === 401) {
      for (const listener of unauthorizedListeners) listener();
    }
    throw new ApiError(
      response.status,
      envelope?.code ?? 'UNKNOWN',
      envelope?.message ?? 'Something went wrong. Please try again.',
      { details: envelope?.details, recovery: envelope?.recovery, retryable: envelope?.retryable },
    );
  }

  return payload as T;
}

export interface RecipeInput extends Omit<RecipeDraft, 'ingredients' | 'steps'> {
  ingredients: Ingredient[];
  steps: Step[];
  version?: number;
}

/** Native builds receive a bearer token alongside the user; store it. */
async function keepToken(response: { user: ApiUser; token?: string }): Promise<{ user: ApiUser }> {
  if (isNative && response.token) await tokenStore.set(response.token);
  return { user: response.user };
}

export interface AiDiagnostics {
  ok: boolean;
  check: 'ping' | 'deep';
  provider: string;
  configuredModel: string;
  endpoint: string;
  model?: string;
  attempts?: number;
  latencyMs?: number;
  checkedAt: string;
  extracted?: { title: string; ingredientCount: number; stepCount: number };
  failure?: { code: string; message: string; status: number };
  /** What this key may actually use, straight from the vendor's catalogue. */
  availableModels?: string[] | null;
  modelsError?: string | null;
  modelIsAvailable?: boolean | null;
  /** Redacted provider text — what the model's endpoint actually objected to. */
  recentFailures: Array<{
    at: string;
    stage: string;
    status: number | null;
    detail: string;
  }>;
}

function isAiDiagnostics(value: unknown): value is AiDiagnostics {
  const candidate = value as AiDiagnostics | null;
  return Boolean(candidate && typeof candidate.ok === 'boolean' && Array.isArray(candidate.recentFailures));
}

export const api = {
  auth: {
    me: () => request<{ user: ApiUser }>('/auth/me'),
    login: (email: string, password: string) =>
      request<{ user: ApiUser; token?: string }>('/auth/login', { method: 'POST', body: { email, password } }).then(keepToken),
    register: (email: string, password: string, displayName?: string) =>
      request<{ user: ApiUser; token?: string }>('/auth/register', { method: 'POST', body: { email, password, displayName } }).then(
        keepToken,
      ),
    googleConfig: () => request<{ configured: boolean; clientId: string | null }>('/auth/google/config'),
    google: (idToken: string) =>
      request<{ user: ApiUser; token?: string }>('/auth/google', { method: 'POST', body: { idToken } }).then(keepToken),
    logout: async () => {
      try {
        return await request<{ ok: true }>('/auth/logout', { method: 'POST' });
      } finally {
        await tokenStore.set(null);
      }
    },
    updateProfile: (displayName: string) => request<{ user: ApiUser }>('/auth/me', { method: 'PATCH', body: { displayName } }),
  },
  health: () =>
    request<{
      status: string;
      database: string;
      ai: { configured: boolean; provider: string | null; model: string | null };
      google?: { configured: boolean };
    }>('/health'),
  diagnostics: {
    /**
     * Real round trip to the configured model; `deep` runs a full extraction.
     * A failed check answers with an error status *and* the diagnosis, so both
     * outcomes are returned in the same shape rather than one of them throwing.
     */
    ai: async (deep = false): Promise<AiDiagnostics> => {
      try {
        return await request<AiDiagnostics>(`/diagnostics/ai${deep ? '?deep=1' : ''}`, { timeoutMs: 120_000 });
      } catch (error) {
        if (error instanceof ApiError && isAiDiagnostics(error.details)) return error.details;
        throw error;
      }
    },
  },
  recipes: {
    list: (params: { search?: string; favorite?: boolean; collectionId?: string; tag?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.favorite) query.set('favorite', 'true');
      if (params.collectionId) query.set('collectionId', params.collectionId);
      if (params.tag) query.set('tag', params.tag);
      const suffix = query.toString();
      return request<{ items: RecipeListItem[]; total: number }>(`/recipes${suffix ? `?${suffix}` : ''}`);
    },
    get: (id: string) => request<{ recipe: Recipe; collectionIds: string[] }>(`/recipes/${id}`),
    create: (input: RecipeInput) => request<{ recipe: Recipe }>('/recipes', { method: 'POST', body: input }),
    update: (id: string, input: RecipeInput) => request<{ recipe: Recipe }>(`/recipes/${id}`, { method: 'PUT', body: input }),
    remove: (id: string) => request<{ ok: true }>(`/recipes/${id}`, { method: 'DELETE' }),
    setFavorite: (id: string, favorite: boolean) =>
      request<{ id: string; isFavorite: boolean }>(`/recipes/${id}/favorite`, { method: 'POST', body: { favorite } }),
  },
  shopping: {
    list: () => request<{ items: ShoppingItem[]; counts: { total: number; checked: number } }>('/shopping-list'),
    add: (item: { name: string; quantity?: number | null; unit?: string | null; note?: string | null }) =>
      request<{ added: ShoppingItem[]; merged: ShoppingItem[]; items: ShoppingItem[] }>('/shopping-list', { method: 'POST', body: item }),
    fromRecipe: (input: { recipeId: string; servings?: number; includeOptional?: boolean; ingredientIds?: string[] }) =>
      request<{ added: ShoppingItem[]; merged: ShoppingItem[]; items: ShoppingItem[] }>('/shopping-list/from-recipe', {
        method: 'POST',
        body: input,
      }),
    update: (id: string, patch: { name?: string; quantity?: number | null; unit?: string | null; checked?: boolean }) =>
      request<{ item: ShoppingItem }>(`/shopping-list/${id}`, { method: 'PATCH', body: patch }),
    remove: (id: string) => request<{ ok: true }>(`/shopping-list/${id}`, { method: 'DELETE' }),
    clear: (onlyChecked: boolean) => request<{ ok: true; removed: number }>('/shopping-list/clear', { method: 'POST', body: { onlyChecked } }),
  },
  collections: {
    list: () => request<{ collections: Collection[] }>('/collections'),
    create: (name: string, description?: string | null) =>
      request<{ collection: Collection }>('/collections', { method: 'POST', body: { name, description: description ?? null } }),
    update: (id: string, name: string, description?: string | null) =>
      request<{ collection: Collection }>(`/collections/${id}`, { method: 'PATCH', body: { name, description: description ?? null } }),
    remove: (id: string) => request<{ ok: true }>(`/collections/${id}`, { method: 'DELETE' }),
    addRecipe: (id: string, recipeId: string) =>
      request<{ collection: Collection }>(`/collections/${id}/recipes`, { method: 'POST', body: { recipeId } }),
    removeRecipe: (id: string, recipeId: string) =>
      request<{ collection: Collection }>(`/collections/${id}/recipes/${recipeId}`, { method: 'DELETE' }),
  },
  cooking: {
    active: () => request<{ sessions: CookingSession[] }>('/cooking'),
    get: (recipeId: string) => request<{ session: CookingSession | null }>(`/cooking/${recipeId}`),
    save: (recipeId: string, patch: { currentStep?: number; completedSteps?: number[]; servings?: number | null; completed?: boolean }) =>
      request<{ session: CookingSession }>(`/cooking/${recipeId}`, { method: 'PUT', body: patch }),
    reset: (recipeId: string) => request<{ ok: true }>(`/cooking/${recipeId}`, { method: 'DELETE' }),
  },
  assist: {
    nutrition: (recipeId: string, servings?: number) =>
      request<{ nutrition: Nutrition; disclaimer: string }>(`/assist/${recipeId}/nutrition`, {
        method: 'POST',
        body: { servings },
        timeoutMs: 120_000,
      }),
    substitutions: (recipeId: string, ingredientId: string, reason?: string) =>
      request<{ ingredient: { id: string; name: string }; substitutions: Substitution[]; disclaimer: string }>(
        `/assist/${recipeId}/substitutions`,
        { method: 'POST', body: { ingredientId, reason }, timeoutMs: 120_000 },
      ),
    customize: (recipeId: string, goals: CustomizationGoal[], options: { notes?: string; save?: boolean } = {}) =>
      request<{ customization: Customization; goals: CustomizationGoal[]; recipe: Recipe | null; disclaimer: string }>(
        `/assist/${recipeId}/customize`,
        { method: 'POST', body: { goals, ...options }, timeoutMs: 180_000 },
      ),
    chat: (recipeId: string, question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) =>
      request<ChatAnswer>(`/assist/${recipeId}/chat`, { method: 'POST', body: { question, history }, timeoutMs: 120_000 }),
  },
  import: {
    capabilities: () => request<ImportCapabilities>('/import/capabilities'),
    progress: (requestId: string) =>
      request<ImportProgress>(`/import/progress/${requestId}`, { timeoutMs: 15_000 }),
    analyze: (
      body:
        | { type: 'url'; url: string; language?: string }
        | { type: 'text'; text: string; title?: string }
        | { type: 'image'; images: string[]; ocrText?: string; note?: string }
        | { type: 'video'; filename?: string; durationSeconds?: number; sizeBytes?: number; captions?: string[]; transcript?: string; frames?: string[] },
      signal?: AbortSignal,
      requestId?: string,
    ) =>
      request<ImportResult>('/import/analyze', {
        method: 'POST',
        body,
        signal,
        // Deliberately more patient than the server's own AI budget
        // (AI_TOTAL_BUDGET_MS), so the client is never the first to give up on
        // work the server is still doing.
        timeoutMs: 240_000,
        headers: requestId ? { 'x-request-id': requestId } : undefined,
      }),
  },
};
