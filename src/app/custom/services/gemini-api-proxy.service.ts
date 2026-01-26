import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, takeUntil, tap, of, map, catchError, throwError } from 'rxjs';
import { GoogleGeminiApiService, GoogleGeminiRequest, GoogleGeminiResponse } from '../../core/services/google-gemini-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { AIRequestLoggerService } from '../../core/services/ai-request-logger.service';
import { ProxySettingsService } from './proxy-settings.service';
import { ReverseProxyConfig } from '../models/proxy-settings.interface';
import { GeminiModelsResponse } from '../../core/models/model.interface';

@Injectable({
  providedIn: 'root'
})
export class GeminiApiProxyService extends GoogleGeminiApiService {
  private proxySettingsService = inject(ProxySettingsService);
  private proxyHttp = inject(HttpClient);
  private proxySettingsServiceRef = inject(SettingsService);
  private proxyAiLogger = inject(AIRequestLoggerService);

  private proxyAbortSubjects = new Map<string, Subject<void>>();
  private proxyRequestMetadata = new Map<string, { logId: string; startTime: number }>();

  override generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<GoogleGeminiResponse> {
    const proxyConfig = this.proxySettingsService.getGoogleGeminiProxyConfig();

    if (!proxyConfig?.enabled || !proxyConfig.url) {
      return super.generateText(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) {
      return throwError(() => new Error('Google Gemini API is not enabled or API key is missing'));
    }

    const model = options.model || settings.googleGemini.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    const proxyUrl = proxyConfig.url.endsWith('/')
      ? proxyConfig.url.slice(0, -1)
      : proxyConfig.url;
    const url = `${proxyUrl}/models/${model}:generateContent`;

    const headersObj: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NovelCrafter/1.0',
      'X-Client-Name': 'NovelCrafter',
      'X-Client-Version': '1.0',
      'X-API-Key': settings.googleGemini.apiKey
    };

    if (proxyConfig.authToken) {
      const headerName = this.getAuthHeaderName(proxyConfig);
      headersObj[headerName] = `Bearer ${proxyConfig.authToken}`;
    }

    const headers = new HttpHeaders(headersObj);

    const { contents, systemInstruction } = this.convertMessagesToContentsProxy(options.messages, prompt);

    const request: GoogleGeminiRequest = {
      contents: contents,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : settings.googleGemini.temperature,
        topP: options.topP !== undefined ? options.topP : settings.googleGemini.topP,
        maxOutputTokens: maxTokens
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE' }
      ]
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging,
      apiProvider: 'gemini',
      streamingMode: false,
      requestDetails: {
        temperature: request.generationConfig?.temperature,
        topP: request.generationConfig?.topP,
        contentsLength: contents.length,
        hasSystemInstruction: !!systemInstruction,
        safetySettings: request.safetySettings?.length ? `${request.safetySettings.length} settings` : undefined,
        requestId: requestId,
        messagesFormat: options.messages ? 'structured' : 'simple',
        proxyEnabled: true
      }
    });

    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    return this.proxyHttp.post<GoogleGeminiResponse>(url, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

          this.proxyAiLogger.logSuccess(logId, content, duration, {
            httpStatus: 200,
            responseHeaders: { 'content-type': 'application/json' },
            safetyRatings: {
              promptFeedback: response.promptFeedback,
              candidateSafetyRatings: response.candidates?.[0]?.safetyRatings,
              finishReason: response.candidates?.[0]?.finishReason
            }
          });
          this.cleanupProxyRequest(requestId);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.proxyAiLogger.logError(logId, error.message || 'Unknown error', duration, {
            httpStatus: error.status || 0
          });
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
    const proxyConfig = this.proxySettingsService.getGoogleGeminiProxyConfig();

    if (!proxyConfig?.enabled || !proxyConfig.url) {
      return super.generateTextStream(prompt, options);
    }

    const settings = this.proxySettingsServiceRef.getSettings();
    const startTime = Date.now();

    if (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) {
      return throwError(() => new Error('Google Gemini API is not enabled or API key is missing'));
    }

    const model = options.model || settings.googleGemini.model;
    if (!model) {
      return throwError(() => new Error('No AI model selected'));
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    const proxyUrl = proxyConfig.url.endsWith('/')
      ? proxyConfig.url.slice(0, -1)
      : proxyConfig.url;
    const url = `${proxyUrl}/models/${model}:streamGenerateContent?alt=sse`;

    const { contents, systemInstruction } = this.convertMessagesToContentsProxy(options.messages, prompt);

    const request: GoogleGeminiRequest = {
      contents: contents,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : settings.googleGemini.temperature,
        topP: options.topP !== undefined ? options.topP : settings.googleGemini.topP,
        maxOutputTokens: maxTokens
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE' },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE' }
      ]
    };

    const requestId = options.requestId || this.generateProxyRequestId();
    const abortSubject = new Subject<void>();
    this.proxyAbortSubjects.set(requestId, abortSubject);

    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
    }

    const logId = this.proxyAiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging,
      apiProvider: 'gemini',
      streamingMode: true,
      requestDetails: {
        temperature: request.generationConfig?.temperature,
        topP: request.generationConfig?.topP,
        contentsLength: contents.length,
        safetySettings: request.safetySettings?.length ? `${request.safetySettings.length} settings` : undefined,
        requestId: requestId,
        messagesFormat: options.messages ? 'structured' : 'simple',
        proxyEnabled: true,
        streamingUrl: url
      }
    });

    this.proxyRequestMetadata.set(requestId, { logId, startTime });

    return new Observable<string>(observer => {
      let accumulatedContent = '';
      let buffer = '';
      let aborted = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      const abortController = new AbortController();

      const abortSubscription = abortSubject.subscribe(() => {
        aborted = true;
        abortController.abort();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        observer.complete();
        this.cleanupProxyRequest(requestId);
      });

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'User-Agent': 'NovelCrafter/1.0',
        'X-Client-Name': 'NovelCrafter',
        'X-Client-Version': '1.0',
        'X-API-Key': settings.googleGemini.apiKey
      };

      if (proxyConfig.authToken) {
        const headerName = this.getAuthHeaderName(proxyConfig);
        fetchHeaders[headerName] = `Bearer ${proxyConfig.authToken}`;
      }

      fetch(url, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(request),
        signal: abortController.signal
      }).then(response => {
        if (!response.ok) {
          return response.text().then(errorText => {
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
          });
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json().then(data => {
            let fullText = '';
            if (Array.isArray(data)) {
              data.forEach(resp => {
                if (resp.candidates?.[0]?.content?.parts?.[0]?.text) {
                  fullText += resp.candidates[0].content.parts[0].text;
                }
              });
            } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              fullText = data.candidates[0].content.parts[0].text;
            }

            if (!fullText) {
              throw new Error('No text content in response');
            }

            accumulatedContent = fullText;

            const chunkSize = 50;
            let position = 0;

            const sendChunk = () => {
              if (aborted) return;

              if (position < fullText.length) {
                const chunk = fullText.substring(position, position + chunkSize);
                observer.next(chunk);
                position += chunkSize;
                timeoutId = setTimeout(sendChunk, 20);
              } else {
                observer.complete();
                const duration = Date.now() - startTime;

                this.proxyAiLogger.logSuccess(logId, accumulatedContent, duration, {
                  httpStatus: 200,
                  responseHeaders: { 'content-type': 'application/json' }
                });
                this.cleanupProxyRequest(requestId);
                abortSubscription.unsubscribe();
              }
            };

            sendChunk();
          });
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();

        const readStream = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (aborted || done) {
              if (done && !aborted) {
                const duration = Date.now() - startTime;

                observer.complete();
                this.proxyAiLogger.logSuccess(logId, accumulatedContent, duration, {
                  httpStatus: 200,
                  responseHeaders: { 'content-type': 'text/event-stream' }
                });
                this.cleanupProxyRequest(requestId);
                abortSubscription.unsubscribe();
              }
              return;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.substring(6).trim();

                if (!data || data === '[DONE]') {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const newText = parsed.candidates[0].content.parts[0].text;
                    accumulatedContent += newText;
                    observer.next(newText);
                  }
                } catch {
                  // Parse error - data may be incomplete or malformed
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

        observer.error(error);
        this.proxyAiLogger.logError(logId, error.message || 'Unknown error', duration, {
          httpStatus: error.status || 0
        });
        this.cleanupProxyRequest(requestId);
        abortSubscription.unsubscribe();
      });

      return () => {
        aborted = true;
        abortController.abort();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        abortSubscription.unsubscribe();
      };
    }).pipe(
      takeUntil(abortSubject)
    );
  }

  private convertMessagesToContentsProxy(
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[],
    fallbackPrompt?: string
  ): { contents: {parts: {text: string}[], role?: 'user' | 'model'}[]; systemInstruction?: { parts: { text: string }[] } } {
    if (!messages || messages.length === 0) {
      return {
        contents: [{ parts: [{ text: fallbackPrompt || '' }], role: 'user' }]
      };
    }

    const contents: {parts: {text: string}[], role?: 'user' | 'model'}[] = [];
    let systemInstruction: { parts: { text: string }[] } | undefined;

    for (const message of messages) {
      if (message.role === 'system') {
        if (!systemInstruction) {
          systemInstruction = { parts: [{ text: message.content }] };
        } else {
          contents.push({ parts: [{ text: `System: ${message.content}` }], role: 'user' });
        }
      } else if (message.role === 'user') {
        contents.push({ parts: [{ text: message.content }], role: 'user' });
      } else if (message.role === 'assistant') {
        contents.push({ parts: [{ text: message.content }], role: 'model' });
      }
    }

    return { contents, systemInstruction };
  }

  private generateProxyRequestId(): string {
    return 'gemini_proxy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Returns the appropriate auth header name based on the proxy configuration.
   * - 'authorization' (default): Uses 'Authorization' header for transparent proxies
   * - 'x-proxy-auth': Uses 'X-Proxy-Auth' header for explicit proxies
   */
  private getAuthHeaderName(proxyConfig: ReverseProxyConfig): string {
    return proxyConfig.authHeaderType === 'x-proxy-auth' ? 'X-Proxy-Auth' : 'Authorization';
  }

  private cleanupProxyRequest(requestId: string): void {
    const abortSubject = this.proxyAbortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.complete();
      this.proxyAbortSubjects.delete(requestId);
    }
    this.proxyRequestMetadata.delete(requestId);
  }

  /**
   * Lists available Gemini models from the proxy.
   * Returns models in Google Gemini API format.
   */
  listModels(): Observable<GeminiModelsResponse> {
    const proxyConfig = this.proxySettingsService.getGoogleGeminiProxyConfig();

    if (!proxyConfig?.enabled || !proxyConfig.url) {
      return of({ models: [] });
    }

    const settings = this.proxySettingsServiceRef.getSettings();

    if (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) {
      return of({ models: [] });
    }

    const proxyUrl = proxyConfig.url.endsWith('/')
      ? proxyConfig.url.slice(0, -1)
      : proxyConfig.url;
    const modelsUrl = `${proxyUrl}/models`;

    const headersObj: Record<string, string> = {
      'User-Agent': 'NovelCrafter/1.0',
      'X-Client-Name': 'NovelCrafter',
      'X-Client-Version': '1.0',
      'X-API-Key': settings.googleGemini.apiKey
    };

    if (proxyConfig.authToken) {
      const headerName = this.getAuthHeaderName(proxyConfig);
      headersObj[headerName] = `Bearer ${proxyConfig.authToken}`;
    }

    const headers = new HttpHeaders(headersObj);

    return this.proxyHttp.get<GeminiModelsResponse>(modelsUrl, { headers }).pipe(
      catchError(() => of({ models: [] }))
    );
  }

  /**
   * Check if proxy is enabled for Gemini.
   */
  isProxyEnabled(): boolean {
    const proxyConfig = this.proxySettingsService.getGoogleGeminiProxyConfig();
    return !!(proxyConfig?.enabled && proxyConfig.url);
  }

  /**
   * Test proxy connection by sending a lightweight request to the proxy URL.
   * Returns Observable<boolean> - true if connection succeeds, false otherwise.
   * Does not throw errors.
   */
  testProxyConnection(): Observable<boolean> {
    const proxyConfig = this.proxySettingsService.getGoogleGeminiProxyConfig();

    // If proxy is not enabled or URL is missing, return false
    if (!proxyConfig?.enabled || !proxyConfig.url) {
      return of(false);
    }

    const proxyUrl = proxyConfig.url.endsWith('/')
      ? proxyConfig.url.slice(0, -1)
      : proxyConfig.url;

    // Use models endpoint for a lightweight GET request to test connectivity
    const testUrl = `${proxyUrl}/models`;

    const headersObj: Record<string, string> = {
      'User-Agent': 'NovelCrafter/1.0',
      'X-Client-Name': 'NovelCrafter',
      'X-Client-Version': '1.0'
    };

    // Note: API key is intentionally NOT sent during proxy connection test
    // to prevent potential API key leakage to malicious proxy URLs.
    // The proxy connection test only verifies connectivity, not API functionality.

    // Add proxy auth token if configured (consistent with other methods)
    if (proxyConfig.authToken) {
      const headerName = this.getAuthHeaderName(proxyConfig);
      headersObj[headerName] = `Bearer ${proxyConfig.authToken}`;
    }

    const headers = new HttpHeaders(headersObj);

    return this.proxyHttp.get(testUrl, { headers, observe: 'response' }).pipe(
      map(response => response.status >= 200 && response.status < 400),
      catchError(() => of(false))
    );
  }
}
