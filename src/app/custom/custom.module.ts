import { NgModule } from '@angular/core';
import { ClaudeApiService } from '../core/services/claude-api.service';
import { OpenRouterApiService } from '../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../core/services/google-gemini-api.service';
import { OllamaApiService } from '../core/services/ollama-api.service';
import { OpenAICompatibleApiService } from '../core/services/openai-compatible-api.service';
import { ClaudeApiProxyService } from './services/claude-api-proxy.service';
import { OpenRouterApiProxyService } from './services/openrouter-api-proxy.service';
import { GeminiApiProxyService } from './services/gemini-api-proxy.service';
import { OllamaApiProxyService } from './services/ollama-api-proxy.service';
import { OpenAIApiProxyService } from './services/openai-api-proxy.service';
import { ProxySettingsService } from './services/proxy-settings.service';

@NgModule({
  providers: [
    ProxySettingsService,
    { provide: ClaudeApiService, useClass: ClaudeApiProxyService },
    { provide: OpenRouterApiService, useClass: OpenRouterApiProxyService },
    { provide: GoogleGeminiApiService, useClass: GeminiApiProxyService },
    { provide: OllamaApiService, useClass: OllamaApiProxyService },
    { provide: OpenAICompatibleApiService, useClass: OpenAIApiProxyService }
  ]
})
export class CustomModule {}
