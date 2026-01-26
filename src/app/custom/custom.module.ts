import { ErrorHandler, NgModule } from '@angular/core';
import { ClaudeApiService } from '../core/services/claude-api.service';
import { OpenRouterApiService } from '../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../core/services/google-gemini-api.service';
import { OllamaApiService } from '../core/services/ollama-api.service';
import { OpenAICompatibleApiService } from '../core/services/openai-compatible-api.service';
import { DialogService } from '../core/services/dialog.service';
import { MemoryWarningService } from '../core/services/memory-warning.service';
import { ModelService } from '../core/services/model.service';
import { ClaudeApiProxyService } from './services/claude-api-proxy.service';
import { OpenRouterApiProxyService } from './services/openrouter-api-proxy.service';
import { GeminiApiProxyService } from './services/gemini-api-proxy.service';
import { OllamaApiProxyService } from './services/ollama-api-proxy.service';
import { OpenAIApiProxyService } from './services/openai-api-proxy.service';
import { ProxySettingsService } from './services/proxy-settings.service';
import { CustomGlobalErrorHandlerService } from './services/custom-global-error-handler.service';
import { CustomDialogService } from './services/custom-dialog.service';
import { CustomMemoryWarningService } from './services/custom-memory-warning.service';
import { CustomModelService } from './services/custom-model.service';
import { provideCustomRoutes } from './routing';

@NgModule({
  providers: [
    ProxySettingsService,
    { provide: ClaudeApiService, useClass: ClaudeApiProxyService },
    { provide: OpenRouterApiService, useClass: OpenRouterApiProxyService },
    { provide: GoogleGeminiApiService, useClass: GeminiApiProxyService },
    { provide: OllamaApiService, useClass: OllamaApiProxyService },
    { provide: OpenAICompatibleApiService, useClass: OpenAIApiProxyService },
    { provide: ErrorHandler, useClass: CustomGlobalErrorHandlerService },
    { provide: DialogService, useClass: CustomDialogService },
    { provide: MemoryWarningService, useClass: CustomMemoryWarningService },
    { provide: ModelService, useClass: CustomModelService },
    provideCustomRoutes(),
  ]
})
export class CustomModule {}
