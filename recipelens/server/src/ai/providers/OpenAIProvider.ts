/**
 * Any OpenAI-compatible /chat/completions endpoint
 * (OpenAI, Groq, Together, OpenRouter, vLLM, LM Studio…).
 */
import { BaseProvider, safeText } from './BaseProvider.js';
import {
  AIProviderError,
  parseDataUrl,
  type AIProviderResult,
  type AnalyzeOptions,
  type CompletionRequest,
  type ProviderOptions,
} from './AIProvider.js';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export class OpenAIProvider extends BaseProvider {
  readonly name: string = 'openai';
  /** Set once the endpoint tells us it cannot honour response_format. */
  private jsonModeUnsupported = false;

  /** Subclasses raise this where the endpoint's own default is too small. */
  protected get defaultMaxTokens(): number | null {
    return null;
  }

  constructor(options: ProviderOptions) {
    super(options, 'https://api.openai.com/v1');
  }

  override async complete(request: CompletionRequest, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    const images = (request.images ?? []).map(parseDataUrl).filter((i): i is NonNullable<typeof i> => i !== null);
    const content: string | ContentPart[] = images.length
      ? [
          { type: 'text', text: request.user },
          ...images.slice(0, 4).map((image): ContentPart => ({ type: 'image_url', image_url: { url: image.dataUrl } })),
        ]
      : request.user;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? this.temperature,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content },
      ],
    };
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;
    if (maxTokens) body.max_tokens = maxTokens;
    if (request.json && !this.jsonModeUnsupported) body.response_format = { type: 'json_object' };

    const url = `${this.baseUrl}/chat/completions`;
    let response = await this.post(url, body, { authorization: `Bearer ${this.apiKey}` }, options.signal);

    // Some compatible endpoints reject response_format — retry once without it.
    if ((response.status === 400 || response.status === 422) && body.response_format) {
      const text = await safeText(response);
      if (/response_format|json_object|json[_ ]?schema|guided|structured/i.test(text)) {
        this.jsonModeUnsupported = true;
        delete body.response_format;
        response = await this.post(url, body, { authorization: `Bearer ${this.apiKey}` }, options.signal);
      } else {
        throw this.toError(response.status, text);
      }
    }

    if (!response.ok) throw this.toError(response.status, await safeText(response));

    const payload = await this.readJson<ChatResponse>(response);
    const text = this.requireText(payload.choices?.[0]?.message?.content);

    return {
      text,
      model: payload.model ?? this.model,
      finishReason: payload.choices?.[0]?.finish_reason ?? null,
      usage: payload.usage
        ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens }
        : null,
    };
  }
}

/** Kept so existing configuration that names the compatible provider works. */
export class OpenAICompatibleProvider extends OpenAIProvider {
  override readonly name = 'openai-compatible';
}

export { AIProviderError };
