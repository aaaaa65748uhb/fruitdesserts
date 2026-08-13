import type { AiConfig } from '../../config/env.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { NvidiaProvider, NVIDIA_DEFAULT_BASE_URL } from './NvidiaProvider.js';
import { OpenAICompatibleProvider, OpenAIProvider } from './OpenAIProvider.js';
import { AIProviderError, type AIProvider } from './AIProvider.js';

export const SUPPORTED_PROVIDERS = ['openai', 'openai-compatible', 'nvidia', 'anthropic', 'gemini'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Where each provider points when AI_API_BASE_URL / AI_MODEL are not set.
 * An explicit environment value always wins over these.
 */
export const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  'openai-compatible': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  // No model default: see NvidiaProvider — any name here is a dated outage.
  nvidia: { baseUrl: NVIDIA_DEFAULT_BASE_URL, model: '' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
};

/**
 * Builds the provider named by AI_PROVIDER. Adding a vendor means adding a
 * class and one line here — nothing else in RecipeLens changes.
 */
export function createProvider(config: AiConfig, fetchImpl?: typeof fetch): AIProvider {
  if (!config.apiKey) throw new AIProviderError('not_configured', 'AI_API_KEY is missing.');

  const provider = config.provider.trim().toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];

  const options = {
    apiKey: config.apiKey,
    // Environment first, then the provider's own default endpoint/model.
    baseUrl: config.baseUrl?.trim() || defaults?.baseUrl,
    model: config.model?.trim() || defaults?.model || '',
    timeoutMs: config.timeoutMs,
    fetchImpl,
  };

  switch (provider) {
    case 'nvidia':
      return new NvidiaProvider(options);
    case 'anthropic':
      return new AnthropicProvider(options);
    case 'gemini':
    case 'google':
      return new GeminiProvider(options);
    case 'openai':
      return new OpenAIProvider(options);
    case 'openai-compatible':
    case 'custom':
      return new OpenAICompatibleProvider(options);
    default:
      throw new AIProviderError(
        'not_configured',
        `Unknown AI_PROVIDER "${config.provider}". Supported values: ${SUPPORTED_PROVIDERS.join(', ')}.`,
      );
  }
}
