/** Anthropic Messages API (https://api.anthropic.com/v1/messages). */
import { BaseProvider, safeText } from './BaseProvider.js';
import {
  parseDataUrl,
  type AIProviderResult,
  type AnalyzeOptions,
  type CompletionRequest,
  type ProviderOptions,
} from './AIProvider.js';

interface MessagesResponse {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';

  constructor(options: ProviderOptions) {
    super(options, 'https://api.anthropic.com');
  }

  override async complete(request: CompletionRequest, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    const images = (request.images ?? []).map(parseDataUrl).filter((i): i is NonNullable<typeof i> => i !== null);
    const blocks: ContentBlock[] = [
      ...images.slice(0, 4).map(
        (image): ContentBlock => ({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
        }),
      ),
      { type: 'text', text: request.user },
    ];

    const body = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? this.temperature,
      system: request.system,
      messages: [{ role: 'user', content: blocks }],
    };

    const response = await this.post(
      `${this.baseUrl}/v1/messages`,
      body,
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      options.signal,
      options.timeoutMs,
    );

    if (!response.ok) throw this.toError(response.status, await safeText(response));

    const payload = await this.readJson<MessagesResponse>(response);
    const text = this.requireText(
      payload.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n'),
    );

    return {
      text,
      model: payload.model ?? this.model,
      finishReason: payload.stop_reason ?? null,
      usage: payload.usage ? { promptTokens: payload.usage.input_tokens, completionTokens: payload.usage.output_tokens } : null,
    };
  }
}
