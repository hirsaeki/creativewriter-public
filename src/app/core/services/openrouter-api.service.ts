import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, takeUntil, Subject } from 'rxjs';
import { SettingsService } from './settings.service';
import { AIRequestLoggerService } from './ai-request-logger.service';

export interface OpenRouterRequest {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OpenRouterApiService {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);
  private aiLogger = inject(AIRequestLoggerService);

  private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private abortSubjects = new Map<string, Subject<void>>();
  private requestMetadata = new Map<string, { logId: string; startTime: number }>();

  generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    wordCount?: number;
    requestId?: string;
    messages?: {role: 'system' | 'user' | 'assistant', content: string}[];
    stream?: boolean;
  } = {}): Observable<OpenRouterResponse> {
    const settings = this.settingsService.getSettings();
    const startTime = Date.now();
    
    if (!settings.openRouter.enabled || !settings.openRouter.apiKey) {
      throw new Error('OpenRouter API ist nicht aktiviert oder API-Key fehlt');
    }

    const model = options.model || settings.openRouter.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    // Build prompt for logging - use messages if prompt is empty
    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    // Log the request
    const logId = this.aiLogger.logRequest({
      endpoint: this.API_URL,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: promptForLogging
    });

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${settings.openRouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Creative Writer'
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

    // Create abort subject for this request
    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);
    
    // Store request metadata for abort handling
    this.requestMetadata.set(requestId, { logId, startTime });

    return this.http.post<OpenRouterResponse>(this.API_URL, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          const content = response.choices?.[0]?.message?.content || '';
          this.aiLogger.logSuccess(logId, content, duration);
          this.cleanupRequest(requestId);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          let errorMessage = 'Unknown error';
          
          // Extract detailed error information
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
          
          // Add error details
          if (error.error?.error?.message) {
            errorMessage += error.error.error.message;
          } else if (error.error?.message) {
            errorMessage += error.error.message;
          } else if (error.message) {
            errorMessage += error.message;
          }
          
          
          this.aiLogger.logError(logId, errorMessage, duration);
          this.cleanupRequest(requestId);
        }
      })
    );
  }

  abortRequest(requestId: string): void {
    const abortSubject = this.abortSubjects.get(requestId);
    const metadata = this.requestMetadata.get(requestId);
    
    if (abortSubject && metadata) {
      // Log the abort
      const duration = Date.now() - metadata.startTime;
      this.aiLogger.logAborted(metadata.logId, duration);
      
      // Abort the request
      abortSubject.next();
      this.cleanupRequest(requestId);
    }
  }

  private cleanupRequest(requestId: string): void {
    const abortSubject = this.abortSubjects.get(requestId);
    if (abortSubject) {
      abortSubject.complete();
      this.abortSubjects.delete(requestId);
    }
    this.requestMetadata.delete(requestId);
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
    const startTime = Date.now();
    
    if (!settings.openRouter.enabled || !settings.openRouter.apiKey) {
      throw new Error('OpenRouter API ist nicht aktiviert oder API-Key fehlt');
    }

    const model = options.model || settings.openRouter.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    // Build prompt for logging - use messages if prompt is empty
    let promptForLogging = prompt;
    if (!promptForLogging && options.messages && options.messages.length > 0) {
      promptForLogging = options.messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');
    }

    // Log the request
    const logId = this.aiLogger.logRequest({
      endpoint: this.API_URL,
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

    // Create abort subject for this request
    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);
    
    // Store request metadata for abort handling
    this.requestMetadata.set(requestId, { logId, startTime });


    return new Observable<string>(observer => {
      let accumulatedContent = '';
      let aborted = false;
      
      // Create AbortController for cancellation
      const abortController = new AbortController();
      
      // Subscribe to abort signal
      const abortSubscription = abortSubject.subscribe(() => {
        aborted = true;
        abortController.abort();
        observer.complete();
        this.cleanupRequest(requestId);
      });
      
      // Use fetch for streaming
      fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Creative Writer'
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      }).then(async response => {
        if (!response.ok) {
          // Try to get error body
          const errorBody = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
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
                this.aiLogger.logSuccess(logId, accumulatedContent, duration);
                this.cleanupRequest(requestId);
                abortSubscription.unsubscribe();
              }
              return;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.substring(6).trim();
                if (data === '[DONE]') {
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    const newText = parsed.choices[0].delta.content;
                    accumulatedContent += newText;
                    observer.next(newText);
                  }
                } catch {
                  // Ignore parsing errors for incomplete JSON
                }
              }
            }
            
            return readStream();
          });
        }
        
        return readStream();
      }).catch(error => {
        if (aborted) return; // Don't handle errors if we aborted
        
        const duration = Date.now() - startTime;
        let errorMessage = 'Unknown error';
        
        // Extract detailed error information for streaming
        if (error.message) {
          errorMessage = error.message;
        }
        
        
        observer.error(error);
        this.aiLogger.logError(logId, errorMessage, duration);
        this.cleanupRequest(requestId);
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

  private generateRequestId(): string {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
}
