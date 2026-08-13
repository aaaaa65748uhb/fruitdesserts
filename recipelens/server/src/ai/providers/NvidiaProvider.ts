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
import { AIProviderError, type ProviderOptions } from './AIProvider.js';

export const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * There is deliberately no default model for NVIDIA.
 *
 * NVIDIA retires models on a published schedule, and a retired one answers
 * HTTP 410 however correct everything else is. Any name written here is
 * therefore a future outage with a date on it — and one that is hard to spot,
 * because it looks like a working configuration. AI_MODEL must be set, and the
 * deployed server lists what the key can currently use via
 * GET /api/diagnostics/ai.
 */
export const NVIDIA_MODEL_REQUIRED =
  'AI_MODEL must name a model your NVIDIA key can use — NVIDIA retires models on a schedule, so there is no safe default. ' +
  'Settings → Test AI connection lists the ones available to your key.';

export class NvidiaProvider extends OpenAIProvider {
  override readonly name: string = 'nvidia';

  constructor(options: ProviderOptions) {
    const model = options.model?.trim();
    if (!model) throw new AIProviderError('not_configured', NVIDIA_MODEL_REQUIRED);
    super({ ...options, baseUrl: options.baseUrl?.trim() || NVIDIA_DEFAULT_BASE_URL, model });
  }

  /**
   * A whole recipe does not fit in NIM's small default completion budget, and
   * a reasoning model spends part of the same budget thinking before it writes
   * anything — so the room has to cover both, or the recipe is cut off mid-way.
   */
  protected override get defaultMaxTokens(): number {
    return 8192;
  }
}
