/**
 * Provider for any OpenAI-compatible /chat/completions endpoint
 * (OpenAI, Groq, Together, OpenRouter, vLLM, LM Studio…).
 *
 * The API key lives here and nowhere else: it is read from the server
 * configuration and never returned to a client or written to a log.
 */
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompt.js';
import { AIProviderError, type AIProvider, type AIProviderResult, type AnalyzeOptions, type AnalyzeRecipeInput } from './AIProvider.js';

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  temperature?: number;
}

interface ChatChoice {
  message?: { content?: string | null };
  finish_reason?: string | null;
}

interface ChatResponse {
  choices?: ChatChoice[];
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string };
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible';
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly temperature: number;
  /** Set once the endpoint tells us it cannot honour response_format. */
  private jsonModeUnsupported = false;

  constructor(options: OpenAICompatibleOptions) {
    if (!options.apiKey) throw new AIProviderError('not_configured', 'AI_API_KEY is missing.');
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.temperature = options.temperature ?? 0.2;
  }

  async analyzeRecipe(input: AnalyzeRecipeInput, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    const userPrompt = buildUserPrompt(input, options.repairHint);
    const content: string | ContentPart[] = input.images?.length
      ? [
          { type: 'text', text: userPrompt },
          ...input.images.slice(0, 4).map((url): ContentPart => ({ type: 'image_url', image_url: { url } })),
        ]
      : userPrompt;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    };
    if (!this.jsonModeUnsupported) body.response_format = { type: 'json_object' };

    let response = await this.send(body, options.signal);

    // Some compatible endpoints reject response_format — retry once without it.
    if (response.status === 400 && !this.jsonModeUnsupported) {
      const text = await response.text();
      if (/response_format|json_object/i.test(text)) {
        this.jsonModeUnsupported = true;
        delete body.response_format;
        response = await this.send(body, options.signal);
      } else {
        throw new AIProviderError('bad_response', `AI provider rejected the request (HTTP 400).`, { status: 400, retryable: false });
      }
    }

    if (!response.ok) throw this.toError(response.status, await safeText(response));

    let payload: ChatResponse;
    try {
      payload = (await response.json()) as ChatResponse;
    } catch (cause) {
      throw new AIProviderError('bad_response', 'AI provider returned a non-JSON response envelope.', { cause });
    }

    const text = payload.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new AIProviderError('bad_response', 'AI provider returned an empty completion.', { retryable: true });
    }

    return {
      text,
      model: payload.model ?? this.model,
      finishReason: payload.choices?.[0]?.finish_reason ?? null,
      usage: payload.usage
        ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens }
        : null,
    };
  }

  private async send(body: unknown, external?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const onAbort = () => controller.abort(new Error('aborted'));
    external?.addEventListener('abort', onAbort, { once: true });

    try {
      return await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new AIProviderError('timeout', `AI request timed out after ${this.timeoutMs} ms.`, { cause, retryable: true });
      }
      throw new AIProviderError('unavailable', 'Could not reach the AI provider.', { cause, retryable: true });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    }
  }

  private toError(status: number, detail: string): AIProviderError {
    // `detail` is provider text; it is only used for classification, never logged verbatim.
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
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
