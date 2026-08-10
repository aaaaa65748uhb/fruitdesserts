/**
 * Provider abstraction. RecipeLens talks only to this interface, so swapping
 * or adding a vendor means adding one file — nothing else changes.
 */

export interface AnalyzeRecipeInput {
  /** Where the material came from — steers the prompt, never the content. */
  sourceType: 'url' | 'text' | 'image' | 'video' | 'manual';
  sourceUrl?: string | null;
  /** Post/page title, if the source exposed one. */
  title?: string | null;
  /** Post description / caption text. */
  description?: string | null;
  /** Social caption(s) attached to a video. */
  captions?: string[];
  /** Spoken-word transcript of a video, when available. */
  transcript?: string | null;
  /** Text recovered from screenshots/frames via OCR. */
  ocrText?: string | null;
  /** Text the user pasted by hand. */
  pastedText?: string | null;
  /** Arbitrary source metadata (duration, author, hashtags…). */
  metadata?: Record<string, string | number | null>;
  /** data: URLs of screenshots/frames for vision-capable models. */
  images?: string[];
  /** Locale hint for the answer, e.g. "en" or "he". */
  language?: string | null;
}

export interface AIProviderResult {
  /** Raw assistant text — parsing/validation happens in RecipeAIService. */
  text: string;
  model: string;
  finishReason?: string | null;
  usage?: { promptTokens?: number; completionTokens?: number } | null;
}

export type AIErrorCode = 'timeout' | 'rate_limited' | 'auth' | 'unavailable' | 'bad_response' | 'not_configured';

export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(code: AIErrorCode, message: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, options.cause == null ? undefined : { cause: options.cause });
    this.name = 'AIProviderError';
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? (code === 'timeout' || code === 'rate_limited' || code === 'unavailable');
  }
}

export interface AnalyzeOptions {
  /** Validation feedback from a previous attempt, used to repair the answer. */
  repairHint?: string | null;
  signal?: AbortSignal;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  analyzeRecipe(input: AnalyzeRecipeInput, options?: AnalyzeOptions): Promise<AIProviderResult>;
}
