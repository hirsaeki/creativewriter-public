import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, tap, takeUntil } from 'rxjs';
import { OpenRouterApiService, OpenRouterRequest, OpenRouterResponse } from '../../core/services/openrouter-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ProxySettingsService } from './proxy-settings.service';

@Injectable({
  providedIn: 'root'
})
export class OpenRouterApiProxyService extends OpenRouterApiService {
  private proxySettingsService = inject(ProxySettingsService);
  private proxyHttp = inject(HttpClient);
  private proxySettingsServiceRef = inject(SettingsService);
  private proxyAiLogger = inject(AIRequestLoggerService);

  private proxyAbortSubjects = new Map<string, Subject<void>>();
  private proxyRequestMetadata = new Map<string, { logId: string; startTime: number }>();

  private getProxyUrl(): string {
    const proxyConfig = this.proxySettingsService.getOpenRouterProxyConfig();
    if (proxyConfig?.url) {
      return proxyConfig.url.endsWith('/')
        ? `${proxyConfig.url}api/v1/chat/completions`
        : `${proxyConfig.url}/api/v1/chat/completions`;
    }
    return '';
  }

  private getProxyAuthHeaders(): Record<string, string> {
    const proxyConfig = this.proxySettingsService.getOpenRouterProxyConfig();
    if (proxyConfig?.authToken) {
      return { 'X-Proxy-Auth': `Bearer ${proxyConfig.authToken}` };
    }
    return {};
  }

  private generateProxyRequestId(): string {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  private cleanupProxyRequest(requestId: string): void {
    const abortSubject = this.proxyAbortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.complete();
      this.proxyAbortSubjects.delete(requestId);
    }
    this.proxyRequestMetadata.delete(requestId);
  }

  override abortRequest(requestId: string): void {
    const abortSubject = this.proxyAbortSubjects.get(requestId);
    const metadata = this.proxyRequestMetadata.get(requestId);

    if (abortSubject && metadata) {
      const duration = Date.now() - metadata.startTime;
      this.proxyAiLogger.logAborted(metadata.logId, duration);
      abortSubject.next();
      this.cleanupProxyRequest(requestId);
    } else {
      super.abortRequest(requestId);
    }
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
  } = {}): Observable<OpenRouterResponse> {
    const proxyConfig = this.proxySettingsService.getOpenRouterProxyConfig();

    if (!proxyConfig?.enabled) {
      return super.generateText(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();
    const proxyUrl = this.getProxyUrl();

    if (!settings.openRouter.enabled || !settings.openRouter.apiKey) {
      throw new Error('OpenRouter API ist nicht aktiviert oder API-Key fehlt');
    }

    const model = options.model || settings.openRouter.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: proxyUrl,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging
    });

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${settings.openRouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Creative Writer',
      ...this.getProxyAuthHeaders()
    });

    const request: OpenRouterRequest = {
      model: model,
      messages: options.messages && options.messages.length > 0
        ? options.messages
        : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.openRouter.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.openRouter.topP
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);
    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    return this.proxyHttp.post<OpenRouterResponse>(proxyUrl, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          const content = response.choices?.[0]?.message?.content || '';
          this.proxyAiLogger.logSuccess(logId, content, duration);
          this.cleanupProxyRequest(requestId);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          let errorMessage = 'Unknown error';

          if (error.status) {
            errorMessage = `HTTP ${error.status}: `;
            if (error.status === 400) {
              errorMessage += 'Bad Request - ';
            } else if (error.status === 401) {
              errorMessage += 'Unauthorized - ';
            } else if (error.status === 403) {
              errorMessage += 'Forbidden - ';
            } else if (error.status === 404) {
              errorMessage += 'Not Found - ';
            } else if (error.status === 429) {
              errorMessage += 'Rate Limited - ';
            } else if (error.status === 500) {
              errorMessage += 'Server Error - ';
            }
          }

          if (error.error?.error?.message) {
            errorMessage += error.error.error.message;
          } else if (error.error?.message) {
            errorMessage += error.error.message;
          } else if (error.message) {
            errorMessage += error.message;
          }

          this.proxyAiLogger.logError(logId, errorMessage, duration);
          this.cleanupProxyRequest(requestId);
        }
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
    const proxyConfig = this.proxySettingsService.getOpenRouterProxyConfig();

    if (!proxyConfig?.enabled) {
      return super.generateTextStream(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();
    const proxyUrl = this.getProxyUrl();

    if (!settings.openRouter.enabled || !settings.openRouter.apiKey) {
      throw new Error('OpenRouter API ist nicht aktiviert oder API-Key fehlt');
    }

    const model = options.model || settings.openRouter.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: proxyUrl,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging
    });

    const request: OpenRouterRequest = {
      model: model,
      messages: options.messages && options.messages.length > 0
        ? options.messages
        : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.openRouter.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.openRouter.topP,
      stream: true
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);
    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    const proxyAuthHeaders = this.getProxyAuthHeaders();

    return new Observable<string>(observer => {
      let accumulatedContent = '';
      let aborted = false;

      const abortController = new AbortController();

      const abortSubscription = abortSubject.subscribe(() => {
        aborted = true;
        abortController.abort();
        observer.complete();
        this.cleanupProxyRequest(requestId);
      });

      fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Creative Writer',
          ...proxyAuthHeaders
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      }).then(async response => {
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const readStream = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (aborted || done) {
              if (done && !aborted) {
                const duration = Date.now() - startTime;
                observer.complete();
                this.proxyAiLogger.logSuccess(logId, accumulatedContent, duration);
                this.cleanupProxyRequest(requestId);
                abortSubscription.unsubscribe();
              }
              return;
            }

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
                  const delta = parsed.choices?.[0]?.delta;
                  if (delta) {
                    if (delta.reasoning_content || delta.thinking) {
                      continue;
                    }
                    if (delta.content) {
                      accumulatedContent += delta.content;
                      observer.next(delta.content);
                    }
                  }
                } catch {
                  // Ignore parsing errors for incomplete JSON
                }
              }
            }

            return readStream();
          });
        };

        return readStream();
      }).catch(error => {
        if (aborted) return;

        const duration = Date.now() - startTime;
        let errorMessage = 'Unknown error';

        if (error.message) {
          errorMessage = error.message;
        }

        observer.error(error);
        this.proxyAiLogger.logError(logId, errorMessage, duration);
        this.cleanupProxyRequest(requestId);
        abortSubscription.unsubscribe();
      });

      return () => {
        aborted = true;
        abortController.abort();
        abortSubscription.unsubscribe();
      };
    }).pipe(
      takeUntil(abortSubject)
    );
  }
}
