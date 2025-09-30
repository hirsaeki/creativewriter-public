import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, takeUntil, Subject, catchError } from 'rxjs';
import { SettingsService } from './settings.service';
import { AIRequestLoggerService } from './ai-request-logger.service';

export interface GoogleGeminiRequest {
  contents: {
    parts: {
      text: string;
    }[];
    role?: 'user' | 'model';
  }[];
  // Prefer true system instruction channel when present
  systemInstruction?: {
    parts: { text: string }[];
  };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
  safetySettings?: {
    category: string;
    threshold: string;
  }[];
}

export interface GoogleGeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: {
      category: string;
      probability: string;
    }[];
  }[];
  promptFeedback?: {
    safetyRatings: {
      category: string;
      probability: string;
    }[];
    blockReason?: string;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GoogleGeminiApiService {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);
  private aiLogger = inject(AIRequestLoggerService);

  private readonly API_BASE_URL = '/api/gemini/models';
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
  } = {}): Observable<GoogleGeminiResponse> {
    const settings = this.settingsService.getSettings();
    const startTime = Date.now();
    
    if (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) {
      throw new Error('Google Gemini API is not enabled or API key is missing');
    }

    const model = options.model || settings.googleGemini.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'User-Agent': 'NovelCrafter/1.0',
      'X-Client-Name': 'NovelCrafter',
      'X-Client-Version': '1.0',
      'X-API-Key': settings.googleGemini.apiKey // Pass API key to proxy
    });

    // Convert messages format to Gemini format (with systemInstruction when provided)
    const { contents, systemInstruction } = this.convertMessagesToContents(options.messages, prompt);

    const request: GoogleGeminiRequest = {
      contents: contents,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : settings.googleGemini.temperature,
        topP: options.topP !== undefined ? options.topP : settings.googleGemini.topP,
        maxOutputTokens: maxTokens
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_CIVIC_INTEGRITY",
          threshold: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
        }
      ]
    };

    // Create abort subject for this request
    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);

    const url = `${this.API_BASE_URL}/${model}:generateContent`;

    // Log the request with comprehensive details (after all variables are declared)
    const logId = this.aiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt,
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
        contentFilterSettings: {
          harassment: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE',
          hateSpeech: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE',
          sexuallyExplicit: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE',
          dangerousContent: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE',
          civicIntegrity: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
        }
      }
    });
    
    // Store request metadata for abort handling
    this.requestMetadata.set(requestId, { logId, startTime });

    // Debug logging for Gemini API
    console.log('🔍 Gemini API Debug:', {
      model: model,
      maxOutputTokens: maxTokens,
      wordCount: options.wordCount,
      contentsLength: contents.length,
      temperature: request.generationConfig?.temperature,
      requestUrl: url,
      contentsPreview: contents.map(c => ({ role: c.role, textLength: c.parts[0].text.length })),
      contentFilterSettings: {
        harassment: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE',
        hateSpeech: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE',
        sexuallyExplicit: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE',
        dangerousContent: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE',
        civicIntegrity: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
      },
      safetySettingsCount: request.safetySettings?.length
    });

    return this.http.post<GoogleGeminiResponse>(url, request, { headers }).pipe(
      takeUntil(abortSubject),
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Debug logging for response
          console.log('🔍 Gemini Response Debug:', {
            duration: duration + 'ms',
            contentLength: content.length,
            wordCount: content.split(/\s+/).length,
            contentPreview: content.substring(0, 200) + '...',
            usageMetadata: response.usageMetadata,
            finishReason: response.candidates?.[0]?.finishReason,
            candidatesCount: response.candidates?.length,
            safetyRatings: response.candidates?.[0]?.safetyRatings,
            promptFeedback: response.promptFeedback,
            fullResponse: response // Log full response to see structure
          });

          // Special logging for prompt feedback
          if (response.promptFeedback) {
            console.log('🛡️ Gemini Prompt Feedback:', {
              blockReason: response.promptFeedback.blockReason,
              safetyRatings: response.promptFeedback.safetyRatings,
              hasBlockReason: !!response.promptFeedback.blockReason,
              safetyRatingsCount: response.promptFeedback.safetyRatings?.length
            });
          } else {
            console.log('ℹ️ No promptFeedback in response');
          }
          
          // Log additional debug info including prompt feedback
          this.aiLogger.logDebugInfo(logId, {
            responseStructure: {
              candidatesCount: response.candidates?.length,
              finishReason: response.candidates?.[0]?.finishReason,
              hasUsageMetadata: !!response.usageMetadata,
              safetyRatingsCount: response.candidates?.[0]?.safetyRatings?.length,
              hasPromptFeedback: !!response.promptFeedback
            },
            usageMetadata: response.usageMetadata,
            safetyRatings: response.candidates?.[0]?.safetyRatings,
            promptFeedback: response.promptFeedback
          });
          
          this.aiLogger.logSuccess(logId, content, duration, {
            httpStatus: 200,
            responseHeaders: { 'content-type': 'application/json' },
            safetyRatings: {
              promptFeedback: response.promptFeedback,
              candidateSafetyRatings: response.candidates?.[0]?.safetyRatings,
              finishReason: response.candidates?.[0]?.finishReason
            }
          });
          this.cleanupRequest(requestId);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const errorDetails = this.extractErrorDetails(error);
          
          // Log comprehensive error information
          console.error('🔍 Gemini API Error Debug:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            duration: duration + 'ms',
            errorDetails,
            fullError: error,
            headers: error.headers,
            errorType: error.name
          });
          
          // Log debug info for error analysis
          this.aiLogger.logDebugInfo(logId, {
            errorAnalysis: {
              httpStatus: error.status,
              statusText: error.statusText,
              errorName: error.name,
              hasErrorBody: !!error.error,
              headers: error.headers?.keys ? Object.fromEntries(error.headers.keys().map((key: string) => [key, error.headers.get(key)])) : 'none',
              url: error.url
            },
            rawError: {
              message: error.message,
              stack: error.stack?.substring(0, 500)
            }
          });
          
          this.aiLogger.logError(logId, errorDetails.message, duration, {
            httpStatus: error.status,
            errorDetails: errorDetails,
            responseHeaders: error.headers?.keys ? Object.fromEntries(error.headers.keys().map((key: string) => [key, error.headers.get(key)])) : undefined,
            safetyRatings: errorDetails.details // Safety ratings may be in error details for blocked content
          });
          this.cleanupRequest(requestId);
        }
      })
    );
  }

  private convertMessagesToContents(
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
        // Use Gemini's dedicated systemInstruction channel
        if (!systemInstruction) {
          systemInstruction = { parts: [{ text: message.content }] };
        } else {
          // If multiple system messages exist, append as additional user context to preserve order
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
    
    if (!settings.googleGemini.enabled || !settings.googleGemini.apiKey) {
      throw new Error('Google Gemini API is not enabled or API key is missing');
    }

    const model = options.model || settings.googleGemini.model;
    if (!model) {
      throw new Error('No AI model selected');
    }

    const maxTokens = options.maxTokens || 500;
    const wordCount = options.wordCount || Math.floor(maxTokens / 1.3);

    // Convert messages format to Gemini format (with systemInstruction when provided)
    const { contents, systemInstruction } = this.convertMessagesToContents(options.messages, prompt);

    const request: GoogleGeminiRequest = {
      contents: contents,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : settings.googleGemini.temperature,
        topP: options.topP !== undefined ? options.topP : settings.googleGemini.topP,
        maxOutputTokens: maxTokens
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE'
        },
        {
          category: "HARM_CATEGORY_CIVIC_INTEGRITY",
          threshold: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
        }
      ]
    };

    // Create abort subject for this request
    const requestId = options.requestId || this.generateRequestId();
    const abortSubject = new Subject<void>();
    this.abortSubjects.set(requestId, abortSubject);

    // Use alt=sse for proper Server-Sent Events streaming
    const url = `${this.API_BASE_URL}/${model}:streamGenerateContent?alt=sse`;

    // Log the request with comprehensive details (after all variables are declared)
    const logId = this.aiLogger.logRequest({
      endpoint: url,
      model: model,
      wordCount: wordCount,
      maxTokens: maxTokens,
      prompt: prompt,
      apiProvider: 'gemini',
      streamingMode: true,
      requestDetails: {
        temperature: request.generationConfig?.temperature,
        topP: request.generationConfig?.topP,
        contentsLength: contents.length,
        safetySettings: request.safetySettings?.length ? `${request.safetySettings.length} settings` : undefined,
        requestId: requestId,
        messagesFormat: options.messages ? 'structured' : 'simple',
        contentFilterSettings: {
          harassment: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE',
          hateSpeech: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE',
          sexuallyExplicit: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE',
          dangerousContent: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE',
          civicIntegrity: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
        },
        streamingUrl: url
      }
    });
    
    // Store request metadata for abort handling
    this.requestMetadata.set(requestId, { logId, startTime });

    // Debug logging for Gemini API
    console.log('🔍 Gemini Streaming API Debug:', {
      model: model,
      maxOutputTokens: maxTokens,
      wordCount: options.wordCount,
      contentsLength: contents.length,
      temperature: request.generationConfig?.temperature,
      requestUrl: url,
      contentsPreview: contents.map(c => ({ role: c.role, textLength: c.parts[0].text.length })),
      contentFilterSettings: {
        harassment: settings.googleGemini.contentFilter?.harassment || 'BLOCK_NONE',
        hateSpeech: settings.googleGemini.contentFilter?.hateSpeech || 'BLOCK_NONE',
        sexuallyExplicit: settings.googleGemini.contentFilter?.sexuallyExplicit || 'BLOCK_NONE',
        dangerousContent: settings.googleGemini.contentFilter?.dangerousContent || 'BLOCK_NONE',
        civicIntegrity: settings.googleGemini.contentFilter?.civicIntegrity || 'BLOCK_NONE'
      },
      safetySettingsCount: request.safetySettings?.length
    });

    return new Observable<string>(observer => {
      let accumulatedContent = '';
      let buffer = ''; // Buffer for incomplete JSON chunks
      let aborted = false;
      let timeoutId: number;
      
      // Create AbortController for cancellation
      const abortController = new AbortController();
      
      // Subscribe to abort signal
      const abortSubscription = abortSubject.subscribe(() => {
        aborted = true;
        abortController.abort();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        observer.complete();
        this.cleanupRequest(requestId);
      });
      
      // Use fetch for streaming since Angular HttpClient doesn't support streaming responses well
      console.log('🔍 Gemini Streaming Request:', {
        url: url,
        method: 'POST',
        request: JSON.stringify(request, null, 2)
      });
      
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'User-Agent': 'NovelCrafter/1.0',
          'X-Client-Name': 'NovelCrafter',
          'X-Client-Version': '1.0',
          'X-API-Key': settings.googleGemini.apiKey // Pass API key to proxy
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      }).then(response => {
        console.log('🔍 Gemini Streaming Response:', {
          status: response.status,
          headers: Object.fromEntries(Array.from(response.headers.entries())),
          url: url,
          ok: response.ok,
          statusText: response.statusText
        });
        
        if (!response.ok) {
          return response.text().then(errorText => {
            console.error('🔍 Gemini Error Response Body:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
          });
        }
        
        // Check if response is JSON (proxy doesn't support streaming)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          console.log('🔍 Gemini: Proxy returns JSON, falling back to non-streaming response');
          
          // Read complete response as JSON
          return response.json().then(data => {
            console.log('🔍 Gemini Complete Response:', data);
            
            // Handle array of responses from proxy
            let fullText = '';
            if (Array.isArray(data)) {
              // Proxy returns array of response objects
              data.forEach(response => {
                if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
                  fullText += response.candidates[0].content.parts[0].text;
                }
              });
            } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              // Single response object
              fullText = data.candidates[0].content.parts[0].text;
            }
            
            if (!fullText) {
              throw new Error('No text content in response');
            }
            
            accumulatedContent = fullText;
              
              // Simulate streaming by sending text in chunks
              const chunkSize = 50; // Characters per chunk
              let position = 0;
              
              const sendChunk = () => {
                if (aborted) return;
                
                if (position < fullText.length) {
                  const chunk = fullText.substring(position, position + chunkSize);
                  observer.next(chunk);
                  position += chunkSize;
                  timeoutId = setTimeout(sendChunk, 20); // 20ms delay between chunks
                } else {
                  observer.complete();
                  const duration = Date.now() - startTime;
                  console.log('🔍 Gemini Simulated Streaming Complete:', {
                    duration: duration + 'ms',
                    totalContentLength: accumulatedContent.length,
                    wordCount: accumulatedContent.split(/\s+/).length,
                    mode: 'simulated-streaming'
                  });
                  
                  // Log comprehensive success info including prompt feedback
                  this.aiLogger.logDebugInfo(logId, {
                    streamingType: 'simulated',
                    chunkCount: Math.ceil(fullText.length / chunkSize),
                    chunkSize: chunkSize,
                    totalChunks: Math.ceil(fullText.length / chunkSize),
                    promptFeedback: data.promptFeedback || (Array.isArray(data) && data[0]?.promptFeedback)
                  });
                  
                  this.aiLogger.logSuccess(logId, accumulatedContent, duration, {
                    httpStatus: 200,
                    responseHeaders: { 'content-type': 'application/json' },
                    safetyRatings: {
                      promptFeedback: data.promptFeedback || (Array.isArray(data) && data[0]?.promptFeedback),
                      candidateSafetyRatings: data.candidates?.[0]?.safetyRatings || (Array.isArray(data) && data[0]?.candidates?.[0]?.safetyRatings),
                      finishReason: data.candidates?.[0]?.finishReason || (Array.isArray(data) && data[0]?.candidates?.[0]?.finishReason)
                    }
                  });
                  this.cleanupRequest(requestId);
                  abortSubscription.unsubscribe();
                }
              };
              
              sendChunk();
          });
        }
        
        // Original streaming code for real SSE responses
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
                console.log('🔍 Gemini Streaming Complete:', {
                  duration: duration + 'ms',
                  totalContentLength: accumulatedContent.length,
                  wordCount: accumulatedContent.split(/\s+/).length,
                  mode: 'real-streaming'
                });
                
                // Log comprehensive success info for real streaming
                this.aiLogger.logDebugInfo(logId, {
                  streamingType: 'real',
                  mode: 'server-sent-events',
                  bufferLength: buffer.length
                });
                
                observer.complete();
                this.aiLogger.logSuccess(logId, accumulatedContent, duration, {
                  httpStatus: 200,
                  responseHeaders: { 'content-type': 'text/event-stream' },
                  safetyRatings: {
                    // Safety ratings from streaming will be captured via logDebugInfo during streaming
                  }
                });
                this.cleanupRequest(requestId);
                abortSubscription.unsubscribe();
              }
              return;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            console.log('🔍 Gemini Raw Chunk:', chunk);
            
            // Process SSE format for Gemini API
            // Buffer incomplete chunks
            buffer += chunk;
            const lines = buffer.split('\n');
            
            // Keep the last potentially incomplete line in the buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              console.log('🔍 Gemini Processing Line:', line);
              
              if (line.trim().startsWith('data: ')) {
                const data = line.substring(6).trim();
                
                // Skip empty data or [DONE] signal
                if (!data || data === '[DONE]') {
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  console.log('🔍 Gemini SSE Chunk:', parsed);
                  
                  // Gemini API sends partial text in each chunk
                  if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const newText = parsed.candidates[0].content.parts[0].text;
                    accumulatedContent += newText;
                    console.log('🔍 Gemini New Text:', newText);
                    observer.next(newText);
                  }
                  
                  // Check for finish reason
                  if (parsed.candidates?.[0]?.finishReason) {
                    console.log('🔍 Gemini Finish Reason:', parsed.candidates[0].finishReason);
                  }
                  
                  // Check for prompt feedback in streaming chunk
                  if (parsed.promptFeedback) {
                    console.log('🛡️ Gemini Streaming Prompt Feedback:', parsed.promptFeedback);
                    // Store prompt feedback for later logging
                    this.aiLogger.logDebugInfo(logId, {
                      streamingPromptFeedback: parsed.promptFeedback
                    });
                  }
                } catch (e) {
                  console.warn('🔍 Gemini Parse Error:', e, 'Data:', data);
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
        const errorDetails = this.extractErrorDetails(error);
        
        // Log comprehensive error information for streaming
        console.error('🔍 Gemini Streaming API Error Debug:', {
          name: error.name,
          message: error.message,
          duration: duration + 'ms',
          errorDetails,
          aborted: aborted,
          fullError: error,
          stack: error.stack
        });
        
        // Log debug info for streaming error
        this.aiLogger.logDebugInfo(logId, {
          streamingError: {
            name: error.name,
            message: error.message,
            aborted: aborted,
            accumulatedContentLength: accumulatedContent.length
          },
          connectionInfo: {
            url: url,
            requestMethod: 'POST'
          }
        });
        
        observer.error(error);
        this.aiLogger.logError(logId, errorDetails.message, duration, {
          httpStatus: error.status || 0,
          errorDetails: errorDetails,
          safetyRatings: errorDetails.details // Safety ratings may be in error details for blocked content
        });
        this.cleanupRequest(requestId);
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

  private generateRequestId(): string {
    return 'gemini_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  testConnection(): Observable<Record<string, unknown>> {
    const url = '/api/gemini/test';
    console.log('🔍 Testing Gemini proxy connection at:', url);
    
    return this.http.get<Record<string, unknown>>(url).pipe(
      tap((response: Record<string, unknown>) => {
        console.log('✅ Gemini proxy test successful:', response);
      }),
      catchError(error => {
        console.error('❌ Gemini proxy test failed:', error);
        throw error;
      })
    );
  }

  private extractErrorDetails(error: Record<string, unknown>): { message: string; code?: string; status?: number; details?: Record<string, unknown> } {
    // Handle different error structures from Google API
    let message = 'Unknown error';
    let code: string | undefined;
    let status: number | undefined;
    let details: Record<string, unknown> | undefined;

    // Check for content filter errors first
    const contentFilterError = this.extractContentFilterError(error);
    if (contentFilterError) {
      return contentFilterError;
    }

    // HTTP error response from Angular HttpClient
    const errorObj = error as { error?: { error?: { message?: string; code?: string; status?: string; details?: Record<string, unknown> } }; status?: number };
    const errorAny = error as unknown as { 
      error?: { 
        error?: { message?: string; code?: string; status?: string; details?: Record<string, unknown> };
        message?: string;
        code?: string;
      } | string; 
      status?: number; 
      message?: string; 
      statusText?: string;
      code?: string;
      name?: string;
    };
    
    if (errorObj.error) {
      status = errorObj.status || status;
      
      // Google API error structure: error.error.error.message
      if (errorObj.error && errorObj.error.error) {
        const apiError = errorObj.error.error;
        message = apiError.message || message;
        code = (apiError.code || apiError.status) as string;
        details = apiError.details;
      }
      // Direct error object: error.error.message
      else if (errorAny.error && typeof errorAny.error === 'object' && errorAny.error.message) {
        message = errorAny.error.message;
        code = errorAny.error.code || 'UNKNOWN_ERROR';
      }
      // String error response
      else if (typeof errorAny.error === 'string') {
        message = errorAny.error;
      }
    }
    // Network or other errors
    else if (errorAny.message) {
      message = errorAny.message;
      code = errorAny.code || errorAny.name || 'UNKNOWN_ERROR';
    }

    // Add HTTP status context
    if (status) {
      const statusText = this.getStatusText(status);
      message = `${statusText} (${status}): ${message}`;
    }

    // Add specific error codes context
    if (code) {
      switch (code) {
        case 'PERMISSION_DENIED':
          message += ' - Check your API key and billing account';
          break;
        case 'RESOURCE_EXHAUSTED':
          message += ' - API quota exceeded';
          break;
        case 'INVALID_ARGUMENT':
          message += ' - Invalid request parameters';
          break;
        case 'FAILED_PRECONDITION':
          message += ' - Request precondition failed';
          break;
        case 'UNAVAILABLE':
          message += ' - Service temporarily unavailable';
          break;
        case 'DEADLINE_EXCEEDED':
          message += ' - Request timeout';
          break;
      }
    }

    return { message, code, status, details };
  }

  private extractContentFilterError(error: Record<string, unknown>): { message: string; code?: string; status?: number; details?: Record<string, unknown> } | null {
    let contentFilterMessage: string | null = null;
    const details: Record<string, unknown> = {};
    const errorObj = error as { candidates?: { finishReason?: string }[] };
    const errorAny = error as unknown as { 
      candidates?: { 
        finishReason?: string;
        safetyRatings?: { category: string; probability: string }[];
      }[]; 
      message?: string; 
      statusText?: string;
      promptFeedback?: {
        blockReason?: string;
        safetyRatings?: { category: string; probability: string }[];
      };
      error?: {
        error?: {
          message?: string;
        };
      };
      status?: number;
    };

    // Check for content filtering in successful responses with SAFETY finish reason
    if (errorObj.candidates?.[0]?.finishReason === 'SAFETY') {
      contentFilterMessage = 'Content blocked by safety filters';
      details['finishReason'] = 'SAFETY';
      details['safetyRatings'] = (errorObj.candidates?.[0] as { safetyRatings?: unknown })?.safetyRatings;
    }
    // Check for OTHER finish reason which can indicate content filtering
    else if (errorObj.candidates?.[0]?.finishReason === 'OTHER') {
      contentFilterMessage = 'Content generation stopped due to safety or other constraints';
      details['finishReason'] = 'OTHER';
      details['safetyRatings'] = (errorObj.candidates?.[0] as { safetyRatings?: unknown })?.safetyRatings;
    }
    // Check prompt feedback for blocking
    else if (errorAny.promptFeedback?.blockReason) {
      contentFilterMessage = `Prompt blocked: ${errorAny.promptFeedback.blockReason}`;
      details['blockReason'] = errorAny.promptFeedback.blockReason;
      details['safetyRatings'] = errorAny.promptFeedback.safetyRatings;
    }
    // Check for safety-related error messages
    else if (errorAny.error?.error?.message?.toLowerCase().includes('blocked')) {
      contentFilterMessage = `Content blocked: ${errorAny.error.error.message}`;
      details['originalError'] = errorAny.error.error;
    }
    // Check for safety ratings that might indicate high-risk content
    else if (errorAny.candidates?.[0]?.safetyRatings) {
      const candidates = errorAny.candidates as { safetyRatings: { category: string; probability: string }[] }[];
      const highRiskRatings = candidates[0].safetyRatings.filter((rating) => 
        rating.probability === 'HIGH' || rating.probability === 'MEDIUM'
      );
      
      if (highRiskRatings.length > 0) {
        const categories = highRiskRatings.map((r) => r.category).join(', ');
        contentFilterMessage = `Content flagged for safety categories: ${categories}`;
        details['safetyRatings'] = errorAny.candidates[0].safetyRatings;
        details['highRiskCategories'] = categories;
      }
    }

    if (contentFilterMessage) {
      return {
        message: contentFilterMessage,
        code: 'CONTENT_FILTER',
        status: errorAny.status || 200, // Content filtering can happen with 200 status
        details
      };
    }

    return null;
  }

  private getStatusText(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
      default: return 'HTTP Error';
    }
  }
}
