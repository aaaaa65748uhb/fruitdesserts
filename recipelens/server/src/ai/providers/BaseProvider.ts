/**
 * Shared plumbing for every provider: prompt assembly, time-boxed requests and
 * a single place where HTTP status codes become AIProviderError codes.
 *
 * The API key is held here and never leaves the server: it is not returned by
 * any route, not logged, and not part of any error message.
 */
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt.js';
import {
  AIProviderError,
  type AIProvider,
  type AIProviderResult,
  type AnalyzeOptions,
  type AnalyzeRecipeInput,
  type CompletionRequest,
  type ProviderOptions,
} from './AIProvider.js';

export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  readonly model: string;

  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;
  protected readonly fetchImpl: typeof fetch;
  protected readonly temperature: number;

  constructor(options: ProviderOptions, defaultBaseUrl: string) {
    if (!options.apiKey) throw new AIProviderError('not_configured', 'AI_API_KEY is missing.');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl?.trim() || defaultBaseUrl).replace(/\/+$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.temperature = options.temperature ?? 0.2;
  }

  /** Recipe extraction is one specific completion. */
  async analyzeRecipe(input: AnalyzeRecipeInput, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    return this.complete(
      {
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(input, options.repairHint),
        images: input.images,
        json: true,
      },
      options,
    );
  }

  abstract complete(request: CompletionRequest, options?: AnalyzeOptions): Promise<AIProviderResult>;

  /** POST JSON with a hard timeout and uniform transport error mapping. */
  protected async post(url: string, body: unknown, headers: Record<string, string>, external?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const onAbort = () => controller.abort(new Error('aborted'));
    external?.addEventListener('abort', onAbort, { once: true });

    try {
      return await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted && !external?.aborted) {
        throw new AIProviderError('timeout', `AI request timed out after ${this.timeoutMs} ms.`, { cause, retryable: true });
      }
      throw new AIProviderError('unavailable', 'Could not reach the AI provider.', { cause, retryable: true });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    }
  }

  protected toError(status: number, detail: string): AIProviderError {
    // `detail` is provider text: used for classification only, never surfaced.
    if (status === 401 || status === 403) {
      return new AIProviderError('auth', 'The configured AI credentials were rejected by the provider.', {
        status,
        retryable: false,
      });
    }
    if (status === 429) {
      return new AIProviderError('rate_limited', 'The AI provider rate-limited this request.', { status, retryable: true });
    }
    if (status >= 500) {
      return new AIProviderError('unavailable', `The AI provider is unavailable (HTTP ${status}).`, { status, retryable: true });
    }
    return new AIProviderError('bad_response', `The AI provider rejected the request (HTTP ${status}).`, {
      status,
      retryable: false,
      cause: detail.slice(0, 200),
    });
  }

  protected async readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new AIProviderError('bad_response', 'AI provider returned a non-JSON response envelope.', { cause });
    }
  }

  protected requireText(text: string | null | undefined): string {
    if (!text || !text.trim()) {
      throw new AIProviderError('bad_response', 'AI provider returned an empty completion.', { retryable: true });
    }
    return text;
  }
}

export async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
