import { Injectable } from '@angular/core';
import { Settings } from '../models/settings.interface';

export type AIProvider = 'openrouter' | 'gemini' | 'claude' | 'ollama' | 'replicate' | 'openaiCompatible';

/**
 * Centralized service for validating AI provider availability and configuration.
 * This ensures consistent validation logic across the application.
 */
@Injectable({
  providedIn: 'root'
})
export class AIProviderValidationService {

  /**
   * Check if a specific AI provider is properly configured and available for use.
   *
   * @param provider The provider name (e.g., 'openrouter', 'gemini', 'ollama')
   * @param settings The application settings
   * @returns true if the provider is enabled and has the necessary credentials
   */
  isProviderAvailable(provider: string, settings: Settings): boolean {
    if (!provider || !settings) {
      return false;
    }

    switch (provider.toLowerCase()) {
      case 'openrouter':
        return settings.openRouter.enabled && !!settings.openRouter.apiKey;

      case 'gemini':
        return settings.googleGemini.enabled && !!settings.googleGemini.apiKey;

      case 'claude':
        return settings.claude.enabled && !!settings.claude.apiKey;

      case 'ollama':
        // Ollama uses baseUrl instead of apiKey for validation
        return settings.ollama.enabled && !!settings.ollama.baseUrl;

      case 'replicate':
        return settings.replicate.enabled && !!settings.replicate.apiKey;

      case 'openaicompatible':
        // OpenAI-Compatible uses baseUrl instead of apiKey for validation
        return settings.openAICompatible.enabled && !!settings.openAICompatible.baseUrl;

      default:
        return false;
    }
  }

  /**
   * Get a list of all currently available (configured and enabled) AI providers.
   *
   * @param settings The application settings
   * @returns Array of available provider names
   */
  getAvailableProviders(settings: Settings): AIProvider[] {
    const providers: AIProvider[] = ['openrouter', 'gemini', 'claude', 'ollama', 'replicate', 'openaiCompatible'];
    return providers.filter(provider => this.isProviderAvailable(provider, settings));
  }

  /**
   * Check if at least one AI provider is configured and available.
   *
   * @param settings The application settings
   * @returns true if any provider is available
   */
  hasAnyProviderConfigured(settings: Settings): boolean {
    return this.getAvailableProviders(settings).length > 0;
  }

  /**
   * Validate that the model's provider is available.
   * Used when a specific model (format: "provider:model_id") is selected.
   *
   * @param modelString The model string in format "provider:model_id"
   * @param settings The application settings
   * @returns true if the model's provider is available
   */
  isModelProviderAvailable(modelString: string, settings: Settings): boolean {
    if (!modelString) {
      return false;
    }

    const [provider] = modelString.split(':');
    return this.isProviderAvailable(provider, settings);
  }

  /**
   * Get a user-friendly error message when no providers are configured.
   *
   * @returns Error message to display to users
   */
  getNoProviderConfiguredMessage(): string {
    return 'No AI API configured. Please configure an AI provider in settings.';
  }

  /**
   * Get a list of provider names that need to be configured (not currently available).
   *
   * @param settings The application settings
   * @returns Array of provider names that are not configured
   */
  getUnconfiguredProviders(settings: Settings): AIProvider[] {
    const providers: AIProvider[] = ['openrouter', 'gemini', 'claude', 'ollama', 'replicate', 'openaiCompatible'];
    return providers.filter(provider => !this.isProviderAvailable(provider, settings));
  }
}
