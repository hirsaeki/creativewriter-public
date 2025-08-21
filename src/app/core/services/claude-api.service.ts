import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, takeUntil, Subject, catchError, from, map } from 'rxjs';
import { SettingsService } from './settings.service';
import { AIRequestLoggerService } from './ai-request-logger.service';

export interface ClaudeRequest {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  system?: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: {
    type: string;
    text: string;
  }[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeModel {
  created_at: string;
  display_name: string;
  id: string;
  type: string;
}

export interface ClaudeModelsResponse {
  data: ClaudeModel[];
  first_id?: string;
  has_more: boolean;
  last_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeApiService {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);
  private aiLogger = inject(AIRequestLoggerService);

  private readonly API_URL: string;
  private readonly MODELS_URL: string;
  private readonly API_VERSION = '2023-06-01';
  private readonly isDevelopment = !window.location.hostname.includes('.de') && !window.location.hostname.includes('.com');
  private abortSubjects = new Map<string, Subject<void>>();
  private requestMetadata = new Map<string, { logId: string; startTime: number }>();

  constructor() {
    // Use proxy in development, direct API in production
    if (this.isDevelopment) {
      this.API_URL = '/api/anthropic/v1/messages';
      this.MODELS_URL = '/api/anthropic/v1/models';
    } else {
      this.API_URL = 'https://api.anthropic.com/v1/messages';
      this.MODELS_URL = 'https://api.anthropic.com/v1/models';
    }
  }

  generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<ClaudeResponse> {
    const settings = this.settingsService.getSettings();
    const startTime = Date.now();
    
    if (!settings.claude.enabled || !settings.claude.apiKey) {
      throw new Error('Claude API is not enabled or API key is missing');
    }

    const model = options.model || settings.claude.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 4096;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    // Log the request
    const logId = this.aiLogger.logRequest({
      endpoint: this.API_URL,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt
    });

    const headerOptions: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': settings.claude.apiKey,
      'anthropic-version': this.API_VERSION
    };

    // Add CORS header for production
    if (!this.isDevelopment) {
      headerOptions['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const headers = new HttpHeaders(headerOptions);

    // Convert messages format to Claude format
    const messages = this.convertMessagesToClaudeFormat(options.messages, prompt);
    
    // Extract system message if present
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

    const requestId = options.requestId || this.generateRequestId();
    this.requestMetadata.set(requestId, { logId, startTime });

    if (options.stream) {
      return this.handleStreamingResponse(request, headers);
    }

    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);

    return this.http.post<ClaudeResponse>(this.API_URL, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap(response => {
        const endTime = Date.now();
        const metadata = this.requestMetadata.get(requestId);
        
        if (metadata) {
          const content = response.content[0]?.text || '';
          const duration = endTime - metadata.startTime;
          this.aiLogger.logSuccess(metadata.logId, content, duration);
        }

        this.cleanup(requestId);
      }),
      catchError(error => {
        const metadata = this.requestMetadata.get(requestId);
        if (metadata) {
          const duration = Date.now() - metadata.startTime;
          this.aiLogger.logError(metadata.logId, error.message || 'Unknown error', duration);
        }
        this.cleanup(requestId);
        throw error;
      })
    );
  }

  generateTextStream(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
  } = {}): Observable<string> {
    const settings = this.settingsService.getSettings();
    
    if (!settings.claude.enabled || !settings.claude.apiKey) {
      throw new Error('Claude API is not enabled or API key is missing');
    }

    const model = options.model || settings.claude.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 4096;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    // Log the request
    const logId = this.aiLogger.logRequest({
      endpoint: this.API_URL,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt
    });

    // Convert messages format to Claude format
    const messages = this.convertMessagesToClaudeFormat(options.messages, prompt);
    
    // Extract system message if present
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

    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);

    return new Observable<string>(observer => {
      const startTime = Date.now();
      let accumulatedText = '';

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': settings.claude.apiKey,
        'anthropic-version': this.API_VERSION
      };

      // Add CORS header for production
      if (!this.isDevelopment) {
        fetchHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      fetch(this.API_URL, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(request)
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
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const chunk = parsed.delta.text;
                  accumulatedText += chunk;
                  observer.next(chunk);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        // Log the complete response
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.aiLogger.logSuccess(logId, accumulatedText, duration);

        observer.complete();
      }).catch(error => {
        const duration = Date.now() - startTime;
        this.aiLogger.logError(logId, error.message || 'Unknown error', duration);
        observer.error(error);
      }).finally(() => {
        this.cleanup(requestId);
      });

      // Handle abort
      const subscription = abortSubject.subscribe(() => {
        observer.complete();
      });

      return () => {
        subscription.unsubscribe();
        this.cleanup(requestId);
      };
    }).pipe(takeUntil(abortSubject));
  }

  private handleStreamingResponse(request: ClaudeRequest, headers: HttpHeaders): Observable<ClaudeResponse> {
    // For non-streaming response, we'll use the regular HTTP client
    // This is a placeholder for actual streaming implementation if needed
    return this.http.post<ClaudeResponse>(this.API_URL, { ...request, stream: false }, { headers });
  }

  private convertMessagesToClaudeFormat(messages?: {role: 'system' | 'user' | 'assistant', content: string}[], prompt?: string): {role: 'user' | 'assistant', content: string}[] {
    if (!messages || messages.length === 0) {
      return [{ role: 'user', content: prompt || '' }];
    }

    // Filter out system messages as Claude handles them separately
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  abortRequest(requestId: string): void {
    const abortSubject = this.abortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.next();
      abortSubject.complete();
      this.cleanup(requestId);
    }
  }

  private cleanup(requestId: string): void {
    this.abortSubjects.delete(requestId);
    this.requestMetadata.delete(requestId);
  }

  private generateRequestId(): string {
    return 'claude_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  listModels(): Observable<ClaudeModelsResponse> {
    const settings = this.settingsService.getSettings();
    
    if (!settings.claude.enabled || !settings.claude.apiKey) {
      throw new Error('Claude API is not enabled or API key is missing');
    }

    const headerOptions: Record<string, string> = {
      'X-API-Key': settings.claude.apiKey,
      'anthropic-version': this.API_VERSION
    };

    // Add CORS header for production
    if (!this.isDevelopment) {
      headerOptions['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const headers = new HttpHeaders(headerOptions);

    return this.http.get<ClaudeModelsResponse>(this.MODELS_URL, { headers }).pipe(
      catchError(error => {
        console.error('Failed to load Claude models:', error);
        throw error;
      })
    );
  }

  testConnection(): Observable<boolean> {
    const settings = this.settingsService.getSettings();
    
    if (!settings.claude.apiKey) {
      return from(Promise.resolve(false));
    }

    const headerOptions: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': settings.claude.apiKey,
      'anthropic-version': this.API_VERSION
    };

    // Add CORS header for production
    if (!this.isDevelopment) {
      headerOptions['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const headers = new HttpHeaders(headerOptions);

    // Test with a minimal request
    const testRequest: ClaudeRequest = {
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    };

    return this.http.post<ClaudeResponse>(this.API_URL, testRequest, { headers }).pipe(
      map(() => true),
      catchError(() => from(Promise.resolve(false)))
    );
  }
}