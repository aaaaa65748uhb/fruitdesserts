/**
 * NVIDIA Build / NIM (https://integrate.api.nvidia.com/v1).
 *
 * NVIDIA exposes an OpenAI-compatible chat-completions API, so the transport is
 * inherited from OpenAIProvider. What differs is the default endpoint, a
 * sensible default token budget (NIM models otherwise cut long recipes short)
 * and the fact that JSON mode is model-dependent — the inherited fallback drops
 * `response_format` and retries when the endpoint rejects it.
 *
 * The key comes from AI_API_KEY on the server and never leaves it.
 */
import { OpenAIProvider } from './OpenAIProvider.js';
import type { ProviderOptions } from './AIProvider.js';

export const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_DEFAULT_MODEL = 'meta/llama-4-maverick-17b-128e-instruct';

export class NvidiaProvider extends OpenAIProvider {
  override readonly name: string = 'nvidia';

  constructor(options: ProviderOptions) {
    super({
      ...options,
      baseUrl: options.baseUrl?.trim() || NVIDIA_DEFAULT_BASE_URL,
      model: options.model?.trim() || NVIDIA_DEFAULT_MODEL,
    });
  }

  /** A whole recipe does not fit in NIM's small default completion budget. */
  protected override get defaultMaxTokens(): number {
    return 4096;
  }
}
