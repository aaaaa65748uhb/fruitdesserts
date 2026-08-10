/**
 * Provider abstraction. RecipeLens talks only to this interface, so swapping
 * or adding a vendor means adding one file — nothing else changes.
 *
 * Implementations live next to this file: OpenAIProvider, AnthropicProvider,
 * GeminiProvider. All of them run server-side only.
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

/** A single request to the model: system rules + user material. */
export interface CompletionRequest {
  system: string;
  user: string;
  /** data: URLs; ignored by providers/models without vision. */
  images?: string[];
  /** Ask the provider for strict JSON where the API supports it. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
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
  /** Recipe extraction from whatever the source made available. */
  analyzeRecipe(input: AnalyzeRecipeInput, options?: AnalyzeOptions): Promise<AIProviderResult>;
  /** Every other recipe AI task (nutrition, substitutions, chat, …). */
  complete(request: CompletionRequest, options?: AnalyzeOptions): Promise<AIProviderResult>;
}

export interface ProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  temperature?: number;
}

/** Parsed `data:` URL, in the shape image APIs need. */
export interface InlineImage {
  mediaType: string;
  base64: string;
  dataUrl: string;
}

export function parseDataUrl(dataUrl: string): InlineImage | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  return { mediaType: match[1], base64: match[2], dataUrl: dataUrl.trim() };
}
