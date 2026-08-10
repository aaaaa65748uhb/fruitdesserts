import type { AiConfig } from '../../config/env.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAICompatibleProvider, OpenAIProvider } from './OpenAIProvider.js';
import { AIProviderError, type AIProvider } from './AIProvider.js';

export const SUPPORTED_PROVIDERS = ['openai', 'openai-compatible', 'anthropic', 'gemini'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Builds the provider named by AI_PROVIDER. Adding a vendor means adding a
 * class and one line here — nothing else in RecipeLens changes.
 */
export function createProvider(config: AiConfig, fetchImpl?: typeof fetch): AIProvider {
  if (!config.apiKey) throw new AIProviderError('not_configured', 'AI_API_KEY is missing.');

  const options = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || undefined,
    model: config.model,
    timeoutMs: config.timeoutMs,
    fetchImpl,
  };

  switch (config.provider) {
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
