import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, from, of, map, catchError, takeUntil, tap, throwError } from 'rxjs';
import { ClaudeApiService, ClaudeRequest, ClaudeResponse, ClaudeModelsResponse } from '../../core/services/claude-api.service';
import { ProxySettingsService } from './proxy-settings.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ReverseProxyConfig } from '../models/proxy-settings.interface';

@Injectable({
  providedIn: 'root'
})
export class ClaudeApiProxyService extends ClaudeApiService {
  private proxySettingsService = inject(ProxySettingsService);
  private proxyHttp = inject(HttpClient);
  private proxySettings = inject(SettingsService);
  private proxyAiLogger = inject(AIRequestLoggerService);

  private readonly PROXY_API_VERSION = '2023-06-01';
  private proxyAbortSubjects = new Map<string, Subject<void>>();
  private proxyRequestMetadata = new Map<string, { logId: string; startTime: number }>();

  private buildProxyUrl(path: string): string {
    const proxyConfig = this.proxySettingsService.getClaudeProxyConfig();
    if (proxyConfig?.url) {
      const baseUrl = proxyConfig.url.endsWith('/') ? proxyConfig.url.slice(0, -1) : proxyConfig.url;
      return `${baseUrl}${path}`;
    }
    return '';
  }

  private buildProxyApiUrl(): string {
    return this.buildProxyUrl('/v1/messages');
  }

  private buildProxyModelsUrl(): string {
    return this.buildProxyUrl('/v1/models');
  }

  private buildProxyHeaders(baseHeaders: Record<string, string>): Record<string, string> {
    const proxyConfig = this.proxySettingsService.getClaudeProxyConfig();
    const headers = { ...baseHeaders };
    if (proxyConfig?.authToken) {
      const headerName = this.getAuthHeaderName(proxyConfig);
      headers[headerName] = `Bearer ${proxyConfig.authToken}`;
    }
    return headers;
  }

  /**
   * Builds common API headers with optional Content-Type.
   * @param apiKey - The Claude API key
   * @param includeContentType - Whether to include Content-Type header (default: true)
   */
  private buildCommonHeaders(apiKey: string, includeContentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      'X-API-Key': apiKey,
      'anthropic-version': this.PROXY_API_VERSION
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  /**
   * Returns the appropriate auth header name based on the proxy configuration.
   * - 'authorization' (default): Uses 'Authorization' header for transparent proxies
   * - 'x-proxy-auth': Uses 'X-Proxy-Auth' header for explicit proxies
   */
  private getAuthHeaderName(proxyConfig: ReverseProxyConfig): string {
    return proxyConfig.authHeaderType === 'x-proxy-auth' ? 'X-Proxy-Auth' : 'Authorization';
  }

  private isProxyEnabled(): boolean {
    const proxyConfig = this.proxySettingsService.getClaudeProxyConfig();
    return !!(proxyConfig?.enabled && proxyConfig.url);
  }

  private generateProxyRequestId(): string {
    return 'claude_proxy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  private cleanupProxy(requestId: string): void {
    this.proxyAbortSubjects.delete(requestId);
    this.proxyRequestMetadata.delete(requestId);
  }

  private convertMessagesToClaudeFormatForProxy(
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[],
    prompt?: string
  ): {role: 'user' | 'assistant', content: string}[] {
    if (!messages || messages.length === 0) {
      return [{ role: 'user', content: prompt || '' }];
    }
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
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
  } = {}): Observable<ClaudeResponse> {
    if (!this.isProxyEnabled()) {
      return super.generateText(prompt, options);
    }

    const settings = this.proxySettings.getSettings();
    const startTime = Date.now();

    if (!settings.claude.enabled || !settings.claude.apiKey) {
      return throwError(() => new Error('Claude API is not enabled or API key is missing'));
    }

    const model = options.model || settings.claude.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || 4096;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);
    const apiUrl = this.buildProxyApiUrl();

    const logId = this.proxyAiLogger.logRequest({
      endpoint: apiUrl,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt
    });

    const headerOptions = this.buildProxyHeaders(this.buildCommonHeaders(settings.claude.apiKey));
    const headers = new HttpHeaders(headerOptions);

    const messages = this.convertMessagesToClaudeFormatForProxy(options.messages, prompt);

    let systemMessage: string | undefined;
    if (options.messages && options.messages.length > 0 && options.messages[0].role === 'system') {
      systemMessage = options.messages[0].content;
    }

    const request: ClaudeRequest = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.claude.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.claude.topP,
      stream: options.stream || false,
      system: systemMessage
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    return this.proxyHttp.post<ClaudeResponse>(apiUrl, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap(response => {
        const endTime = Date.now();
        const metadata = this.proxyRequestMetadata.get(requestId);

        if (metadata) {
          const content = response.content[0]?.text || '';
          const duration = endTime - metadata.startTime;
          this.proxyAiLogger.logSuccess(metadata.logId, content, duration);
        }

        this.cleanupProxy(requestId);
      }),
      catchError(error => {
        const metadata = this.proxyRequestMetadata.get(requestId);
        if (metadata) {
          const duration = Date.now() - metadata.startTime;
          this.proxyAiLogger.logError(metadata.logId, error.message || 'Unknown error', duration);
        }
        this.cleanupProxy(requestId);
        return throwError(() => error);
      })
    );
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
    if (!this.isProxyEnabled()) {
      return super.generateTextStream(prompt, options);
    }

    const settings = this.proxySettings.getSettings();

    if (!settings.claude.enabled || !settings.claude.apiKey) {
      return throwError(() => new Error('Claude API is not enabled or API key is missing'));
    }

    const model = options.model || settings.claude.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || 4096;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);
    const apiUrl = this.buildProxyApiUrl();

    const logId = this.proxyAiLogger.logRequest({
      endpoint: apiUrl,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt
    });

    const messages = this.convertMessagesToClaudeFormatForProxy(options.messages, prompt);

    let systemMessage: string | undefined;
    if (options.messages && options.messages.length > 0 && options.messages[0].role === 'system') {
      systemMessage = options.messages[0].content;
    }

    const request: ClaudeRequest = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.claude.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.claude.topP,
      stream: true,
      system: systemMessage
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    const fetchHeaders = this.buildProxyHeaders(this.buildCommonHeaders(settings.claude.apiKey));

    return new Observable<string>(observer => {
      const startTime = Date.now();
      let accumulatedText = '';
      let aborted = false;

      const abortController = new AbortController();

      const abortSubscription = abortSubject.subscribe(() => {
        aborted = true;
        abortController.abort();
        observer.complete();
        this.cleanupProxy(requestId);
      });

      fetch(apiUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(request),
        signal: abortController.signal
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'content_block_delta') {
                  if (parsed.delta?.type === 'thinking_delta') {
                    continue;
                  }
                  if (parsed.delta?.text) {
                    const chunk = parsed.delta.text;
                    accumulatedText += chunk;
                    observer.next(chunk);
                  }
                }
              } catch {
                // SSE parse errors are non-fatal; skip malformed chunks
              }
            }
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        this.proxyAiLogger.logSuccess(logId, accumulatedText, duration);

        observer.complete();
        this.cleanupProxy(requestId);
        abortSubscription.unsubscribe();
      }).catch(error => {
        if (aborted) return;

        const duration = Date.now() - startTime;
        this.proxyAiLogger.logError(logId, error.message || 'Unknown error', duration);
        observer.error(error);
        this.cleanupProxy(requestId);
        abortSubscription.unsubscribe();
      });

      return () => {
        aborted = true;
        abortController.abort();
        abortSubscription.unsubscribe();
        this.cleanupProxy(requestId);
      };
    }).pipe(takeUntil(abortSubject));
  }

  override abortRequest(requestId: string): void {
    const abortSubject = this.proxyAbortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.next();
      abortSubject.complete();
      this.cleanupProxy(requestId);
    }
    super.abortRequest(requestId);
  }

  override listModels(): Observable<ClaudeModelsResponse> {
    if (!this.isProxyEnabled()) {
      return super.listModels();
    }

    const settings = this.proxySettings.getSettings();

    if (!settings.claude.enabled || !settings.claude.apiKey) {
      return throwError(() => new Error('Claude API is not enabled or API key is missing'));
    }

    const modelsUrl = this.buildProxyModelsUrl();

    const headerOptions = this.buildProxyHeaders(this.buildCommonHeaders(settings.claude.apiKey, false));
    const headers = new HttpHeaders(headerOptions);

    return this.proxyHttp.get<ClaudeModelsResponse>(modelsUrl, { headers });
  }

  override testConnection(): Observable<boolean> {
    if (!this.isProxyEnabled()) {
      return super.testConnection();
    }

    const settings = this.proxySettings.getSettings();

    if (!settings.claude.apiKey) {
      return from(Promise.resolve(false));
    }

    const apiUrl = this.buildProxyApiUrl();

    const headerOptions = this.buildProxyHeaders(this.buildCommonHeaders(settings.claude.apiKey));
    const headers = new HttpHeaders(headerOptions);

    const testRequest: ClaudeRequest = {
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    };

    return this.proxyHttp.post<ClaudeResponse>(apiUrl, testRequest, { headers }).pipe(
      map(() => true),
      catchError(() => from(Promise.resolve(false)))
    );
  }

  /**
   * Tests if the proxy server itself is reachable.
   * This method sends a lightweight HEAD request to the proxy URL
   * to verify connectivity without consuming API resources.
   * @returns Observable<boolean> - true if proxy is reachable, false otherwise
   */
  testProxyConnection(): Observable<boolean> {
    const proxyConfig = this.proxySettingsService.getClaudeProxyConfig();

    // If proxy is not enabled or URL is missing, return false
    if (!proxyConfig?.enabled || !proxyConfig.url) {
      return of(false);
    }

    const baseUrl = proxyConfig.url.endsWith('/') ? proxyConfig.url.slice(0, -1) : proxyConfig.url;

    const headers: Record<string, string> = {};
    if (proxyConfig.authToken) {
      const headerName = this.getAuthHeaderName(proxyConfig);
      headers[headerName] = `Bearer ${proxyConfig.authToken}`;
    }

    return this.proxyHttp.head(baseUrl, {
      headers: new HttpHeaders(headers),
      observe: 'response'
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
