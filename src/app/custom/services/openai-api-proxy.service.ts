import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, tap, takeUntil, catchError, throwError } from 'rxjs';
import { OpenAICompatibleApiService, OpenAICompatibleRequest, OpenAICompatibleResponse } from '../../core/services/openai-compatible-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ProxySettingsService } from './proxy-settings.service';

@Injectable({
  providedIn: 'root'
})
export class OpenAIApiProxyService extends OpenAICompatibleApiService {
  private proxySettingsService = inject(ProxySettingsService);
  private proxyHttp = inject(HttpClient);
  private proxySettingsServiceRef = inject(SettingsService);
  private proxyAiLogger = inject(AIRequestLoggerService);

  private proxyAbortSubjects = new Map<string, Subject<void>>();
  private proxyRequestMetadata = new Map<string, { logId: string; startTime: number }>();

  private getAuthHeaders(): Record<string, string> {
    const authToken = this.proxySettingsService.getOpenAICompatibleAuthToken();
    if (authToken) {
      return { 'Authorization': `Bearer ${authToken}` };
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
  } = {}): Observable<OpenAICompatibleResponse> {
    const authToken = this.proxySettingsService.getOpenAICompatibleAuthToken();

    if (!authToken) {
      return super.generateText(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.openAICompatible.enabled || !settings.openAICompatible.baseUrl) {
      return throwError(() => new Error('OpenAI-Compatible API is not enabled or base URL is missing'));
    }

    const model = options.model || settings.openAICompatible.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || settings.openAICompatible.maxTokens;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    const url = `${settings.openAICompatible.baseUrl}/v1/chat/completions`;

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging,
      apiProvider: 'openaiCompatible',
      streamingMode: options.stream || false,
      requestDetails: {
        temperature: options.temperature !== undefined ? options.temperature : settings.openAICompatible.temperature,
        topP: options.topP !== undefined ? options.topP : settings.openAICompatible.topP,
        baseUrl: settings.openAICompatible.baseUrl
      }
    });

    const request: OpenAICompatibleRequest = {
      model: model,
      messages: options.messages && options.messages.length > 0
        ? options.messages
        : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.openAICompatible.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.openAICompatible.topP
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);
    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    const authHeaders = this.getAuthHeaders();

    return this.proxyHttp.post<OpenAICompatibleResponse>(url, request, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        ...authHeaders
      })
    }).pipe(
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
      }),
      catchError(error => {
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
    const authToken = this.proxySettingsService.getOpenAICompatibleAuthToken();

    if (!authToken) {
      return super.generateTextStream(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.openAICompatible.enabled || !settings.openAICompatible.baseUrl) {
      return throwError(() => new Error('OpenAI-Compatible API is not enabled or base URL is missing'));
    }

    const model = options.model || settings.openAICompatible.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || settings.openAICompatible.maxTokens;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    const url = `${settings.openAICompatible.baseUrl}/v1/chat/completions`;

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging,
      apiProvider: 'openaiCompatible',
      streamingMode: true,
      requestDetails: {
        temperature: options.temperature !== undefined ? options.temperature : settings.openAICompatible.temperature,
        topP: options.topP !== undefined ? options.topP : settings.openAICompatible.topP,
        baseUrl: settings.openAICompatible.baseUrl
      }
    });

    const request: OpenAICompatibleRequest = {
      model: model,
      messages: options.messages && options.messages.length > 0
        ? options.messages
        : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: options.temperature !== undefined ? options.temperature : settings.openAICompatible.temperature,
      top_p: options.topP !== undefined ? options.topP : settings.openAICompatible.topP,
      stream: true
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);
    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    const authHeaders = this.getAuthHeaders();

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

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
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
