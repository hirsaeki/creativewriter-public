import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OllamaApiService, OllamaResponse, OllamaChatResponse } from '../../core/services/ollama-api.service';
import { ProxySettingsService } from './proxy-settings.service';

@Injectable({
  providedIn: 'root'
})
export class OllamaApiProxyService extends OllamaApiService {
  private proxySettingsService = inject(ProxySettingsService);

  protected getAuthHeaders(): Record<string, string> {
    const authToken = this.proxySettingsService.getOllamaAuthToken();
    if (authToken) {
      return { 'Authorization': `Bearer ${authToken}` };
    }
    return {};
  }

  override generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<OllamaResponse | OllamaChatResponse> {
    return super.generateText(prompt, options);
  }

  override generateTextStream(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
  } = {}): Observable<string> {
    return super.generateTextStream(prompt, options);
  }
}
