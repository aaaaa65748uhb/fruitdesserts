/**
 * Typed API client.
 *
 * Every call funnels through `request`, so loading, error and retry behaviour
 * is identical everywhere and the server's error envelope
 * ({ error: { code, message, recovery, retryable } }) is preserved.
 */
import type { Ingredient, RecipeDraft, Step } from '../shared.js';

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
}

/** Anything that wants to know a session went away (e.g. the auth provider). */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = 90_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new ApiError(0, 'TIMEOUT', 'The request took too long. Check your connection and try again.', { retryable: true });
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

export const api = {
  auth: {
    me: () => request<{ user: ApiUser }>('/auth/me'),
    login: (email: string, password: string) => request<{ user: ApiUser }>('/auth/login', { method: 'POST', body: { email, password } }),
    register: (email: string, password: string, displayName?: string) =>
      request<{ user: ApiUser }>('/auth/register', { method: 'POST', body: { email, password, displayName } }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    updateProfile: (displayName: string) => request<{ user: ApiUser }>('/auth/me', { method: 'PATCH', body: { displayName } }),
  },
  health: () => request<{ status: string; database: string; ai: { configured: boolean; provider: string | null; model: string | null } }>('/health'),
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
  import: {
    capabilities: () => request<ImportCapabilities>('/import/capabilities'),
    analyze: (
      body:
        | { type: 'url'; url: string; language?: string }
        | { type: 'text'; text: string; title?: string }
        | { type: 'image'; images: string[]; ocrText?: string; note?: string }
        | { type: 'video'; filename?: string; durationSeconds?: number; sizeBytes?: number; captions?: string[]; transcript?: string; frames?: string[] },
      signal?: AbortSignal,
    ) => request<ImportResult>('/import/analyze', { method: 'POST', body, signal, timeoutMs: 120_000 }),
  },
};
