# Reverse Proxy Settings Implementation

## Overview

This document describes the reverse proxy configuration feature for AI provider connections in CreativeWriter 2.0.

## Purpose

Allow users to route AI API requests through custom reverse proxies for:
- Corporate network requirements
- API key protection
- Rate limiting / caching
- Custom authentication layers

## Configuration Interface

### ReverseProxyConfig

```typescript
export interface ReverseProxyConfig {
  enabled: boolean;      // Whether to use the proxy
  url: string;           // Proxy base URL (e.g., https://my-proxy.example.com)
  authToken?: string;    // Bearer token for proxy authentication
}
```

## Provider-Specific Implementation

### Providers with Full Proxy Support

These providers support complete URL replacement via `ReverseProxyConfig`:

| Provider | Default Endpoint | Proxy Path |
|----------|-----------------|------------|
| Claude | `api.anthropic.com/v1/messages` | `{proxyUrl}/v1/messages` |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | `{proxyUrl}/chat/completions` |
| Gemini | `/api/gemini/models` (internal proxy) | `{proxyUrl}/models` |

### Providers with Auth Token Only

These providers already support custom `baseUrl`, so only `authToken` is added:

| Provider | Setting | Auth Header |
|----------|---------|-------------|
| Ollama | `baseUrl` + `authToken` | `Authorization: Bearer {token}` |
| OpenAI Compatible | `baseUrl` + `authToken` | `Authorization: Bearer {token}` |

## Settings Structure

### Claude Settings

```typescript
interface ClaudeSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  enabled: boolean;
  proxy?: ReverseProxyConfig;  // NEW
}
```

### OpenRouter Settings

```typescript
interface OpenRouterSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  enabled: boolean;
  proxy?: ReverseProxyConfig;  // NEW
}
```

### GoogleGemini Settings

```typescript
interface GoogleGeminiSettings {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  enabled: boolean;
  contentFilter: { ... };
  proxy?: ReverseProxyConfig;  // NEW
}
```

### Ollama Settings

```typescript
interface OllamaSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  enabled: boolean;
  authToken?: string;  // NEW
}
```

### OpenAICompatible Settings

```typescript
interface OpenAICompatibleSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  enabled: boolean;
  authToken?: string;  // NEW
}
```

## API Service Implementation

### URL Resolution Logic

```typescript
private getApiUrl(): string {
  const settings = this.settingsService.getSettings();

  // If proxy is enabled and URL is set, use proxy
  if (settings.provider.proxy?.enabled && settings.provider.proxy?.url) {
    return `${settings.provider.proxy.url}/path`;
  }

  // Otherwise, use default endpoint
  return 'https://default-api.example.com/path';
}
```

### Header Construction

```typescript
private getHeaders(): Record<string, string> {
  const settings = this.settingsService.getSettings();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Provider-specific headers...
  };

  // Add Bearer token if proxy auth is configured
  if (settings.provider.proxy?.enabled && settings.provider.proxy?.authToken) {
    headers['Authorization'] = `Bearer ${settings.provider.proxy.authToken}`;
  }

  return headers;
}
```

## UI Components

### Settings Location

Proxy settings are displayed in the API Settings section (`/settings` → AI Models tab).

### UI Elements per Provider

1. **Use Reverse Proxy** - Toggle switch
2. **Proxy URL** - Text input (URL type, disabled when toggle is off)
3. **Auth Token** - Password input (optional, disabled when toggle is off)

### Visibility Rules

- Proxy settings section only appears when the provider is enabled
- Input fields are disabled when "Use Reverse Proxy" is toggled off

## Files Modified

| File | Changes |
|------|---------|
| `src/app/core/models/settings.interface.ts` | Add `ReverseProxyConfig`, extend provider interfaces |
| `src/app/core/services/settings.service.ts` | Update merge logic for new properties |
| `src/app/core/services/claude-api.service.ts` | Add `getApiUrl()`, update headers |
| `src/app/core/services/openrouter-api.service.ts` | Add `getApiUrl()`, update headers |
| `src/app/core/services/google-gemini-api.service.ts` | Add `getApiBaseUrl()`, update headers |
| `src/app/core/services/ollama-api.service.ts` | Add Bearer auth to headers |
| `src/app/core/services/openai-compatible-api.service.ts` | Add Bearer auth to headers |
| `src/app/ui/settings/api-settings.component.html` | Add proxy settings UI |
| `src/app/ui/settings/api-settings.component.ts` | Handle proxy settings events |

## Security Considerations

1. **Auth tokens are stored in localStorage** - Same security model as API keys
2. **Use password input type** - Prevents shoulder surfing
3. **CORS requirements** - Proxy server must handle CORS appropriately
4. **HTTPS recommended** - Always use HTTPS for proxy URLs in production

## Backward Compatibility

- All new properties are optional (`?`)
- `loadSettings()` merges with defaults for missing properties
- Existing settings without proxy config continue to work unchanged
