/**
 * RecipeAIService — the single place where recipe analysis happens.
 *
 * Frontend → API route → RecipeAIService → AIProvider → configured model.
 * The route never touches a provider, and the browser never sees a key.
 *
 * Pipeline: provider text → JSON recovery → schema validation → normalisation
 *           → RecipeDraft. Invalid answers are retried with the validator's
 *           complaint attached; a still-invalid answer becomes a controlled
 *           error, never a fabricated recipe.
 */
import { createHash } from 'node:crypto';
import type { ZodType } from 'zod';
import { ApiError } from '../lib/errors.js';
import { aiRecipeSchema, normalizeAiRecipe, type RecipeDraft, type SourceType } from '../shared.js';
import { parseJsonLoose } from './json.js';
import { sourceTextLength } from './prompt.js';
import { AIProviderError, type AIProvider, type AnalyzeRecipeInput } from './providers/AIProvider.js';

export interface AnalysisOutcome {
  draft: RecipeDraft;
  attempts: number;
  durationMs: number;
  model: string;
  provider: string;
  /** True when the JSON needed syntactic repair before it parsed. */
  repaired: boolean;
  /** True when the result was served from the recent-analysis cache. */
  cached: boolean;
}

export interface RecipeAIServiceOptions {
  maxRetries?: number;
  /** Minimum characters of readable source text before the model is called. */
  minSourceChars?: number;
}

const DEFAULT_MIN_SOURCE_CHARS = 40;

export class RecipeAIService {
  private readonly provider: AIProvider;
  private readonly maxRetries: number;
  private readonly minSourceChars: number;
  /** De-duplicates identical analyses that are already running. */
  private readonly inFlight = new Map<string, Promise<AnalysisOutcome>>();

  constructor(provider: AIProvider, options: RecipeAIServiceOptions = {}) {
    this.provider = provider;
    this.maxRetries = options.maxRetries ?? 2;
    this.minSourceChars = options.minSourceChars ?? DEFAULT_MIN_SOURCE_CHARS;
  }

  get providerName(): string {
    return this.provider.name;
  }

  get model(): string {
    return this.provider.model;
  }

  get endpoint(): string {
    return this.provider.endpoint;
  }

  /** Models this key can use, or null where the vendor exposes no catalogue. */
  async availableModels(options: { signal?: AbortSignal } = {}): Promise<string[] | null> {
    if (!this.provider.listModels) return null;
    try {
      return await this.provider.listModels(options);
    } catch (error) {
      throw toApiError(error);
    }
  }

  /** Stable fingerprint of the input, used for caching and de-duplication. */
  static fingerprint(input: AnalyzeRecipeInput): string {
    const canonical = JSON.stringify({
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      captions: input.captions ?? [],
      transcript: input.transcript ?? null,
      ocrText: input.ocrText ?? null,
      pastedText: input.pastedText ?? null,
      images: (input.images ?? []).map((i) => createHash('sha256').update(i).digest('hex')),
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Analyse a source. Concurrent identical calls share one provider request so
   * a double-tapped Import button cannot bill two analyses.
   */
  async analyze(input: AnalyzeRecipeInput, options: { signal?: AbortSignal } = {}): Promise<AnalysisOutcome> {
    const key = RecipeAIService.fingerprint(input);
    const running = this.inFlight.get(key);
    if (running) return running;

    const promise = this.runAnalysis(input, options).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  private async runAnalysis(input: AnalyzeRecipeInput, options: { signal?: AbortSignal }): Promise<AnalysisOutcome> {
    const hasImages = (input.images?.length ?? 0) > 0;
    if (!hasImages && sourceTextLength(input) < this.minSourceChars) {
      throw new ApiError(
        422,
        'INSUFFICIENT_SOURCE_DATA',
        'Unable to extract enough information from this source.',
        {
          recovery: ['Upload the video', 'Upload a screenshot', 'Paste the recipe text'],
          retryable: false,
        },
      );
    }

    const started = Date.now();
    let repairHint: string | null = null;
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      let text: string;
      let model = this.provider.model;
      try {
        const result = await this.provider.analyzeRecipe(input, { repairHint, signal: options.signal });
        text = result.text;
        model = result.model;
      } catch (error) {
        const apiError = toApiError(error);
        lastError = apiError;
        if (!apiError.retryable || attempt > this.maxRetries) throw apiError;
        await delay(backoffMs(attempt));
        continue;
      }

      const parsed = parseJsonLoose(text);
      if (!parsed.ok) {
        repairHint = `The response was not valid JSON (${parsed.error}). Reply with one JSON object only.`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI returned a response that could not be read as JSON.', {
          retryable: true,
        });
        if (attempt > this.maxRetries) break;
        continue;
      }

      const validated = aiRecipeSchema.safeParse(parsed.value);
      if (!validated.success) {
        const issues = validated.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        repairHint = `Schema validation failed: ${issues}`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI response did not match the required recipe structure.', {
          details: { issues },
          retryable: true,
        });
        if (attempt > this.maxRetries) break;
        continue;
      }

      try {
        const draft = normalizeAiRecipe(validated.data, {
          sourceType: input.sourceType as SourceType,
          sourceUrl: input.sourceUrl ?? null,
        });
        return {
          draft,
          attempts: attempt,
          durationMs: Date.now() - started,
          model,
          provider: this.provider.name,
          repaired: parsed.repaired,
          cached: false,
        };
      } catch (error) {
        // Normalisation only fails when the payload is unusable (e.g. every
        // ingredient row was blank) — ask once more, then give up.
        repairHint = `The recipe could not be normalised: ${error instanceof Error ? error.message : 'unknown error'}`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI response did not contain a usable recipe.', {
          retryable: true,
        });
        if (attempt > this.maxRetries) break;
      }
    }

    throw (
      lastError ??
      new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI response could not be validated.', { retryable: true })
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Assistant tasks                                                          */
  /* ------------------------------------------------------------------------ */

  /**
   * One completion, parsed and validated against `schema`, with the same
   * retry-with-the-validator's-complaint behaviour as recipe extraction.
   * `map` turns the tolerant AI payload into the strict domain value.
   */
  async runStructured<TRaw, TValue>(
    task: string,
    system: string,
    user: string,
    schema: ZodType<TRaw>,
    map: (raw: TRaw) => TValue,
    options: { signal?: AbortSignal; temperature?: number; maxTokens?: number } = {},
  ): Promise<StructuredOutcome<TValue>> {
    const started = Date.now();
    let repairHint: string | null = null;
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      let text: string;
      let model = this.provider.model;
      try {
        const result = await this.provider.complete(
          {
            system,
            user: repairHint ? `${user}\n\n### Correction required\n${repairHint}\nReturn the corrected JSON object only.` : user,
            json: true,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
          { signal: options.signal, repairHint },
        );
        text = result.text;
        model = result.model;
      } catch (error) {
        const apiError = toApiError(error);
        lastError = apiError;
        if (!apiError.retryable || attempt > this.maxRetries) throw apiError;
        await delay(backoffMs(attempt));
        continue;
      }

      const parsed = parseJsonLoose(text);
      if (!parsed.ok) {
        repairHint = `The previous answer was not valid JSON (${parsed.error}). Reply with one JSON object only.`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', `The AI returned an unreadable answer for ${task}.`, {
          retryable: true,
        });
        if (attempt > this.maxRetries) break;
        continue;
      }

      const validated = schema.safeParse(parsed.value);
      if (!validated.success) {
        repairHint = `Schema validation failed: ${validated.error.issues
          .slice(0, 6)
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ')}`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', `The AI answer for ${task} did not match the expected structure.`, {
          retryable: true,
        });
        if (attempt > this.maxRetries) break;
        continue;
      }

      try {
        return {
          value: map(validated.data),
          attempts: attempt,
          durationMs: Date.now() - started,
          model,
          provider: this.provider.name,
        };
      } catch (error) {
        repairHint = `The answer could not be normalised: ${error instanceof Error ? error.message : 'unknown error'}`;
        lastError = new ApiError(502, 'AI_INVALID_RESPONSE', `The AI answer for ${task} could not be used.`, { retryable: true });
        if (attempt > this.maxRetries) break;
      }
    }

    throw lastError ?? new ApiError(502, 'AI_INVALID_RESPONSE', `The AI answer for ${task} could not be validated.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Assistant tasks (nutrition, substitutions, customisation, chat)            */
/* -------------------------------------------------------------------------- */

export interface StructuredOutcome<T> {
  value: T;
  attempts: number;
  durationMs: number;
  model: string;
  provider: string;
}

function backoffMs(attempt: number): number {
  return Math.min(2000, 200 * 2 ** (attempt - 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AIProviderError) {
    switch (error.code) {
      case 'timeout':
        return new ApiError(504, 'AI_TIMEOUT', 'The AI request timed out. Please try again.', { retryable: true });
      case 'rate_limited':
        return new ApiError(429, 'AI_RATE_LIMITED', 'The AI provider is rate limiting requests. Please try again shortly.', {
          retryable: true,
        });
      case 'auth':
        return new ApiError(502, 'AI_UNAVAILABLE', 'The AI provider rejected the server credentials.', { retryable: false });
      case 'not_configured':
        return new ApiError(503, 'AI_NOT_CONFIGURED', 'AI analysis is not configured on this server.', { retryable: false });
      case 'model_unavailable':
        return new ApiError(502, 'AI_MODEL_UNAVAILABLE', error.message, {
          recovery: [
            'Set AI_MODEL on the server to a model the provider still offers',
            'Settings → Test AI connection lists the models this key can use',
          ],
          retryable: false,
        });
      case 'bad_response':
        return new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI provider returned an unusable response.', { retryable: true });
      case 'unavailable':
      default:
        return new ApiError(502, 'AI_UNAVAILABLE', 'The AI provider is currently unavailable.', { retryable: true });
    }
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error while analysing the recipe.', { cause: error });
}
