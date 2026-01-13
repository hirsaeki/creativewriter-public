import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap, takeUntil, catchError, throwError } from 'rxjs';
import { OllamaApiService, OllamaResponse, OllamaChatResponse, OllamaGenerateRequest, OllamaChatRequest } from '../../core/services/ollama-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ProxySettingsService } from './proxy-settings.service';

@Injectable({
  providedIn: 'root'
})
export class OllamaApiProxyService extends OllamaApiService {
  private proxySettingsService = inject(ProxySettingsService);
  private proxyHttp = inject(HttpClient);
  private proxySettingsServiceRef = inject(SettingsService);
  private proxyAiLogger = inject(AIRequestLoggerService);

  private proxyAbortSubjects = new Map<string, Subject<void>>();
  private proxyRequestMetadata = new Map<string, { logId: string; startTime: number }>();

  private getAuthHeaders(): Record<string, string> {
    const authToken = this.proxySettingsService.getOllamaAuthToken();
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
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<OllamaResponse | OllamaChatResponse> {
    const authToken = this.proxySettingsService.getOllamaAuthToken();

    if (!authToken) {
      return super.generateText(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.ollama.enabled || !settings.ollama.baseUrl) {
      return throwError(() => new Error('Ollama is not enabled or base URL is missing'));
    }

    const model = options.model || settings.ollama.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || settings.ollama.maxTokens;
    const temperature = options.temperature !== undefined ? options.temperature : settings.ollama.temperature;
    const topP = options.topP !== undefined ? options.topP : settings.ollama.topP;

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    let url: string;
    let requestBody: OllamaGenerateRequest | OllamaChatRequest;

    if (options.messages && options.messages.length > 0) {
      url = `${settings.ollama.baseUrl}/api/chat`;
      requestBody = {
        model: model,
        messages: options.messages,
        stream: options.stream || false,
        options: {
          temperature: temperature,
          top_p: topP,
          num_predict: maxTokens
        }
      } as OllamaChatRequest;
    } else {
      url = `${settings.ollama.baseUrl}/api/generate`;
      requestBody = {
        model: model,
        prompt: prompt,
        stream: options.stream || false,
        options: {
          temperature: temperature,
          top_p: topP,
          num_predict: maxTokens
        }
      } as OllamaGenerateRequest;
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: Math.floor(maxTokens / 1.3),
      maxTokens: maxTokens,
      prompt: prompt,
      apiProvider: 'ollama',
      streamingMode: options.stream || false,
      requestDetails: {
        temperature: temperature,
        topP: topP,
        baseUrl: settings.ollama.baseUrl
      }
    });

    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    const authHeaders = this.getAuthHeaders();

    return this.proxyHttp.post<OllamaResponse | OllamaChatResponse>(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      }
    }).pipe(
      takeUntil(abortSubject),
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;

          let responseText = '';
          if ('response' in response) {
            responseText = response.response;
          } else {
            responseText = response.message.content;
          }

          this.proxyAiLogger.logSuccess(logId, responseText, duration);
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
    const authToken = this.proxySettingsService.getOllamaAuthToken();

    if (!authToken) {
      return super.generateTextStream(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.ollama.enabled || !settings.ollama.baseUrl) {
      return throwError(() => new Error('Ollama is not enabled or base URL is missing'));
    }

    const model = options.model || settings.ollama.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || settings.ollama.maxTokens;
    const temperature = options.temperature !== undefined ? options.temperature : settings.ollama.temperature;
    const topP = options.topP !== undefined ? options.topP : settings.ollama.topP;

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    let url: string;
    let requestBody: OllamaGenerateRequest | OllamaChatRequest;

    if (options.messages && options.messages.length > 0) {
      url = `${settings.ollama.baseUrl}/api/chat`;
      requestBody = {
        model: model,
        messages: options.messages,
        stream: true,
        options: {
          temperature: temperature,
          top_p: topP,
          num_predict: maxTokens
        }
      } as OllamaChatRequest;
    } else {
      url = `${settings.ollama.baseUrl}/api/generate`;
      requestBody = {
        model: model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: temperature,
          top_p: topP,
          num_predict: maxTokens
        }
      } as OllamaGenerateRequest;
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: options.wordCount || Math.floor(maxTokens / 1.3),
      maxTokens: maxTokens,
      prompt: prompt,
      apiProvider: 'ollama',
      streamingMode: true,
      requestDetails: {
        temperature: temperature,
        topP: topP,
        baseUrl: settings.ollama.baseUrl
      }
    });

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
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);

                  let text = '';
                  if ('response' in data && data.response) {
                    text = data.response;
                  } else if ('message' in data && data.message?.content) {
                    text = data.message.content;
                  }

                  if (text) {
                    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
                  }

                  if (text) {
                    accumulatedContent += text;
                    observer.next(text);
                  }

                  if (data.done) {
                    const metadata = this.proxyRequestMetadata.get(requestId);
                    if (metadata) {
                      const duration = Date.now() - metadata.startTime;
                      this.proxyAiLogger.logSuccess(metadata.logId, accumulatedContent, duration);
                      this.cleanupProxyRequest(requestId);
                    }
                    observer.complete();
                    abortSubscription.unsubscribe();
                    return;
                  }
                } catch {
                  // Ignore parsing errors for incomplete JSON
                }
              }
            }
          }
        } catch (readError) {
          observer.error(readError);
        }
      }).catch(error => {
        if (aborted) return;

        const metadata = this.proxyRequestMetadata.get(requestId);
        if (metadata) {
          const duration = Date.now() - metadata.startTime;
          this.proxyAiLogger.logError(metadata.logId, error.message || 'Unknown error', duration);
          this.cleanupProxyRequest(requestId);
        }

        observer.error(error);
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
