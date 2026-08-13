/** Google Gemini generateContent API. */
import { BaseProvider, safeText } from './BaseProvider.js';
import {
  parseDataUrl,
  type AIProviderResult,
  type AnalyzeOptions,
  type CompletionRequest,
  type ProviderOptions,
} from './AIProvider.js';

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiProvider extends BaseProvider {
  readonly name = 'gemini';

  constructor(options: ProviderOptions) {
    super(options, 'https://generativelanguage.googleapis.com/v1beta');
  }

  override async complete(request: CompletionRequest, options: AnalyzeOptions = {}): Promise<AIProviderResult> {
    const images = (request.images ?? []).map(parseDataUrl).filter((i): i is NonNullable<typeof i> => i !== null);
    const parts: Part[] = [
      { text: request.user },
      ...images.slice(0, 4).map((image): Part => ({ inline_data: { mime_type: image.mediaType, data: image.base64 } })),
    ];

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: request.temperature ?? this.temperature,
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
        ...(request.json ? { responseMimeType: 'application/json' } : {}),
      },
    };

    // The key travels in a header rather than the query string so it cannot
    // end up in an intermediary's access log.
    const response = await this.post(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      body,
      { 'x-goog-api-key': this.apiKey },
      options.signal,
      options.timeoutMs,
    );

    if (!response.ok) throw this.toError(response.status, await safeText(response));

    const payload = await this.readJson<GenerateContentResponse>(response);
    const text = this.requireText(
      payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    );

    return {
      text,
      model: payload.modelVersion ?? this.model,
      finishReason: payload.candidates?.[0]?.finishReason ?? null,
      usage: payload.usageMetadata
        ? { promptTokens: payload.usageMetadata.promptTokenCount, completionTokens: payload.usageMetadata.candidatesTokenCount }
        : null,
    };
  }
}
