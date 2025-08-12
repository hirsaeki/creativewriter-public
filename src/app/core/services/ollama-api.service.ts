import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, takeUntil, Subject, catchError, throwError, map } from 'rxjs';
import { SettingsService } from './settings.service';
import { AIRequestLoggerService } from './ai-request-logger.service';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
  context?: number[];
}

export interface OllamaChatRequest {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaModelsResponse {
  models: {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      parent_model: string;
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    };
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class OllamaApiService {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);
  private aiLogger = inject(AIRequestLoggerService);

  private abortSubjects = new Map<string, Subject<void>>();
  private requestMetadata = new Map<string, { logId: string; startTime: number }>();

  generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<OllamaResponse | OllamaChatResponse> {
    const settings = this.settingsService.getSettings();
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

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Create abort subject for this request
    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);

    let url: string;
    let requestBody: OllamaGenerateRequest | OllamaChatRequest;

    // Use chat endpoint if messages are provided, otherwise use generate
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

    // Log the request
    const logId = this.aiLogger.logRequest({
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

    this.requestMetadata.set(requestId, { logId, startTime });

    return this.http.post<OllamaResponse | OllamaChatResponse>(url, requestBody, { headers })
      .pipe(
        takeUntil(abortSubject),
        tap(response => {
          const metadata = this.requestMetadata.get(requestId);
          if (metadata) {
            const duration = Date.now() - metadata.startTime;
            
            // Extract response text based on response type
            let responseText = '';
            
            if ('response' in response) {
              // Generate response
              responseText = response.response;
            } else {
              // Chat response
              responseText = response.message.content;
            }

            this.aiLogger.logSuccess(metadata.logId, responseText, duration);

            this.requestMetadata.delete(requestId);
            this.abortSubjects.delete(requestId);
          }
        }),
        catchError(error => {
          const metadata = this.requestMetadata.get(requestId);
          if (metadata) {
            const duration = Date.now() - metadata.startTime;
            this.aiLogger.logError(metadata.logId, error.message || 'Unknown error', duration);

            this.requestMetadata.delete(requestId);
            this.abortSubjects.delete(requestId);
          }

          console.error('Ollama API error:', error);
          return throwError(() => error);
        })
      );
  }

  listModels(): Observable<OllamaModelsResponse> {
    const settings = this.settingsService.getSettings();
    
    if (!settings.ollama.baseUrl) {
      return throwError(() => new Error('Ollama base URL is not configured'));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const url = `${settings.ollama.baseUrl}/api/tags`;

    return this.http.get<OllamaModelsResponse>(url, { headers })
      .pipe(
        catchError(error => {
          console.error('Failed to load Ollama models:', error);
          return throwError(() => error);
        })
      );
  }

  testConnection(): Observable<boolean> {
    const settings = this.settingsService.getSettings();
    
    if (!settings.ollama.baseUrl) {
      return throwError(() => new Error('Ollama base URL is not configured'));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const url = `${settings.ollama.baseUrl}/api/tags`;

    return this.http.get(url, { headers })
      .pipe(
        map(() => true),
        tap(() => console.log('Ollama connection test successful')),
        catchError(error => {
          console.error('Ollama connection test failed:', error);
          return throwError(() => new Error('Failed to connect to Ollama server'));
        })
      );
  }

  cancelRequest(requestId: string): void {
    const abortSubject = this.abortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.next();
      abortSubject.complete();
      this.abortSubjects.delete(requestId);
      
      const metadata = this.requestMetadata.get(requestId);
      if (metadata) {
        const duration = Date.now() - metadata.startTime;
        this.aiLogger.logError(metadata.logId, 'Request cancelled by user', duration);
        this.requestMetadata.delete(requestId);
      }
    }
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}