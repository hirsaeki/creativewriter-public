import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OpenAICompatibleApiService, OpenAICompatibleResponse } from '../../core/services/openai-compatible-api.service';
import { ProxySettingsService } from './proxy-settings.service';

@Injectable({
  providedIn: 'root'
})
export class OpenAIApiProxyService extends OpenAICompatibleApiService {
  private proxySettingsService = inject(ProxySettingsService);

  protected getAuthHeaders(): Record<string, string> {
    const authToken = this.proxySettingsService.getOpenAICompatibleAuthToken();
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
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<OpenAICompatibleResponse> {
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
