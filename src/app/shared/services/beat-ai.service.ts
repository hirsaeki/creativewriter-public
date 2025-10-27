import { Injectable, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, ReplaySubject, Subject, Subscription, catchError, finalize, from, map, of, scan, switchMap, tap } from 'rxjs';
import { BeatAI, BeatAIGenerationEvent } from '../../stories/models/beat-ai.interface';
import { Story } from '../../stories/models/story.interface';
import { OpenRouterApiService } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../core/services/google-gemini-api.service';
import { OllamaApiService } from '../../core/services/ollama-api.service';
import { ClaudeApiService } from '../../core/services/claude-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { PromptManagerService } from './prompt-manager.service';
import { CodexRelevanceService, CodexEntry as CodexRelevanceEntry } from '../../core/services/codex-relevance.service';
import { CodexEntry, CustomField } from '../../stories/models/codex.interface';
import { BeatHistoryService } from './beat-history.service';

type ProviderType = 'ollama' | 'claude' | 'gemini' | 'openrouter';

interface GenerationContext {
  beatId: string;
  provider: ProviderType;
  prompt: string;
  options: {
    model?: string;
    temperature?: number;
    topP?: number;
  };
  wordCount: number;
  maxTokens: number;
  requestId: string;
  resultSubject: ReplaySubject<string>;
  streamingSubscription?: Subscription;
  fallbackSubscription?: Subscription;
  fallbackStatus: 'idle' | 'prepared' | 'running' | 'completed';
  latestContent?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BeatAIService implements OnDestroy {
  private readonly openRouterApi = inject(OpenRouterApiService);
  private readonly googleGeminiApi = inject(GoogleGeminiApiService);
  private readonly ollamaApi = inject(OllamaApiService);
  private readonly claudeApi = inject(ClaudeApiService);
  private readonly settingsService = inject(SettingsService);
  private readonly storyService = inject(StoryService);
  private readonly codexService = inject(CodexService);
  private readonly promptManager = inject(PromptManagerService);
  private readonly codexRelevanceService = inject(CodexRelevanceService);
  private readonly beatHistoryService = inject(BeatHistoryService);
  private readonly document = inject(DOCUMENT);
  
  private generationSubject = new Subject<BeatAIGenerationEvent>();
  public generation$ = this.generationSubject.asObservable();
  private activeGenerations = new Map<string, string>(); // beatId -> requestId
  private isStreamingSubject = new Subject<boolean>();
  public isStreaming$ = this.isStreamingSubject.asObservable();
  private htmlEntityDecoder: HTMLTextAreaElement | null = null;
  private entityDecodeBuffers = new Map<string, string>();
  private generationContexts = new Map<string, GenerationContext>();
  private pendingVisibilityFallbacks = new Set<string>();

  constructor() {
    const doc = this.document;
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    const doc = this.document;
    if (doc && typeof doc.removeEventListener === 'function') {
      doc.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.cleanupAllContexts();
  }

  private handleVisibilityChange = (): void => {
    const doc = this.document;
    if (!doc) {
      return;
    }

    if (doc.hidden) {
      this.prepareVisibilityFallbacks();
    } else {
      this.resumeVisibilityFallbacks();
    }
  };

  private cleanupAllContexts(): void {
    this.generationContexts.forEach(context => {
      context.streamingSubscription?.unsubscribe();
      context.fallbackSubscription?.unsubscribe();
    });
    this.generationContexts.clear();
    this.pendingVisibilityFallbacks.clear();
    this.activeGenerations.clear();
    this.entityDecodeBuffers.clear();
  }

  private prepareVisibilityFallbacks(): void {
    if (this.activeGenerations.size === 0) {
      return;
    }

    this.activeGenerations.forEach((requestId, beatId) => {
      const context = this.generationContexts.get(beatId);
      if (!context || context.fallbackStatus !== 'idle') {
        return;
      }

      this.pendingVisibilityFallbacks.add(beatId);
      context.fallbackStatus = 'prepared';

      if (requestId) {
        this.abortProviderRequest(context.provider, requestId);
      }

      this.entityDecodeBuffers.delete(beatId);
      this.activeGenerations.delete(beatId);
    });

    this.resumeVisibilityFallbacks();
  }

  private resumeVisibilityFallbacks(): void {
    if (this.pendingVisibilityFallbacks.size === 0) {
      return;
    }

    Array.from(this.pendingVisibilityFallbacks).forEach(beatId => {
      const context = this.generationContexts.get(beatId);
      if (!context || context.fallbackStatus === 'running' || context.fallbackStatus === 'completed') {
        return;
      }

      context.fallbackStatus = 'running';
      const fallbackRequestId = this.createProviderRequestId(context.provider);
      context.requestId = fallbackRequestId;
      this.activeGenerations.set(beatId, fallbackRequestId);

      const fallback$ = this.executeNonStreamingFallback(context).pipe(
        tap(content => {
          context.latestContent = content;
        })
      );

      const subscription = fallback$.subscribe({
        next: content => {
          context.resultSubject.next(content);
        },
        error: error => {
          this.generationSubject.next({ beatId, chunk: '', isComplete: true });
          context.resultSubject.error(error);
          this.handleFallbackCleanup(beatId);
        },
        complete: () => {
          this.generationSubject.next({ beatId, chunk: '', isComplete: true });
          context.resultSubject.complete();
          this.handleFallbackCleanup(beatId);
        }
      });

      context.fallbackSubscription = subscription;
    });
  }

  private handleFallbackCleanup(beatId: string): void {
    const context = this.generationContexts.get(beatId);
    if (context) {
      context.fallbackStatus = 'completed';
    }
    this.cleanupContext(beatId);
  }

  private createProviderRequestId(provider: ProviderType): string {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    switch (provider) {
      case 'gemini':
        return `gemini_visibility_${suffix}`;
      case 'claude':
        return `claude_visibility_${suffix}`;
      case 'openrouter':
        return `openrouter_visibility_${suffix}`;
      case 'ollama':
        return `ollama_visibility_${suffix}`;
      default:
        return `beat_visibility_${suffix}`;
    }
  }

  private abortProviderRequest(provider: ProviderType, requestId: string): void {
    if (!requestId) {
      return;
    }

    switch (provider) {
      case 'gemini':
        this.googleGeminiApi.abortRequest(requestId);
        break;
      case 'claude':
        this.claudeApi.abortRequest(requestId);
        break;
      case 'openrouter':
        this.openRouterApi.abortRequest(requestId);
        break;
      case 'ollama':
        this.ollamaApi.abortRequest(requestId);
        break;
    }
  }

  private executeNonStreamingFallback(context: GenerationContext): Observable<string> {
    const { provider, prompt, options, maxTokens, wordCount, requestId, beatId } = context;
    const messages = this.parseStructuredPrompt(prompt);

    switch (provider) {
      case 'gemini':
        return this.googleGeminiApi.generateText(prompt, {
          model: options.model,
          maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          wordCount,
          requestId,
          messages
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            const rawContent = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const decodedContent = this.decodeHtmlEntities(rawContent);
            const combined = pending ? pending + decodedContent : decodedContent;
            return this.removeDuplicateCharacterAnalyses(combined);
          })
        );
      case 'claude':
        return this.claudeApi.generateText(prompt, {
          model: options.model,
          maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          wordCount,
          requestId,
          messages
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            const rawContent = response.content?.[0]?.text || '';
            const decodedContent = this.decodeHtmlEntities(rawContent);
            const combined = pending ? pending + decodedContent : decodedContent;
            return this.removeDuplicateCharacterAnalyses(combined);
          })
        );
      case 'openrouter':
        return this.openRouterApi.generateText(prompt, {
          model: options.model,
          maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          wordCount,
          requestId,
          messages
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            const rawContent = response.choices?.[0]?.message?.content || '';
            const decodedContent = this.decodeHtmlEntities(rawContent);
            const combined = pending ? pending + decodedContent : decodedContent;
            return this.removeDuplicateCharacterAnalyses(combined);
          })
        );
      case 'ollama':
        return this.ollamaApi.generateText(prompt, {
          model: options.model,
          maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          requestId,
          messages,
          stream: false
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            let rawContent = '';
            if (response && 'response' in response && response.response) {
              rawContent = response.response;
            } else if (response && 'message' in response && response.message?.content) {
              rawContent = response.message.content;
            }
            const decodedContent = this.decodeHtmlEntities(rawContent);
            const combined = pending ? pending + decodedContent : decodedContent;
            return this.removeDuplicateCharacterAnalyses(combined);
          })
        );
      default:
        return of('');
    }
  }

  private cleanupContext(beatId: string): void {
    const context = this.generationContexts.get(beatId);
    if (context) {
      context.streamingSubscription?.unsubscribe();
      context.fallbackSubscription?.unsubscribe();
    }

    this.generationContexts.delete(beatId);
    this.pendingVisibilityFallbacks.delete(beatId);
    this.activeGenerations.delete(beatId);
    this.entityDecodeBuffers.delete(beatId);

    if (this.activeGenerations.size === 0) {
      this.isStreamingSubject.next(false);
    }
  }

  private decodeHtmlEntities(text: string): string {
    if (!text || text.indexOf('&') === -1) {
      return text;
    }

    const doc = this.document;
    if (!doc || typeof doc.createElement !== 'function') {
      return text;
    }

    if (!this.htmlEntityDecoder) {
      this.htmlEntityDecoder = doc.createElement('textarea');
    }

    this.htmlEntityDecoder.innerHTML = text;
    const decoded = this.htmlEntityDecoder.value || this.htmlEntityDecoder.textContent || text;
    this.htmlEntityDecoder.value = '';
    this.htmlEntityDecoder.textContent = '';
    return decoded;
  }

  private decodeStreamingChunk(beatId: string, chunk: string): string {
    if (!chunk) {
      return chunk;
    }

    const buffered = (this.entityDecodeBuffers.get(beatId) || '') + chunk;

    if (buffered.indexOf('&') === -1) {
      this.entityDecodeBuffers.set(beatId, '');
      return buffered;
    }

    let remainder = '';
    let processable = buffered;
    const lastAmpIndex = buffered.lastIndexOf('&');
    if (lastAmpIndex !== -1) {
      const nextSemicolonIndex = buffered.indexOf(';', lastAmpIndex);
      if (nextSemicolonIndex === -1) {
        remainder = buffered.substring(lastAmpIndex);
        processable = buffered.substring(0, lastAmpIndex);
      }
    }

    const decoded = this.decodeHtmlEntities(processable);
    this.entityDecodeBuffers.set(beatId, remainder);
    return decoded;
  }

  private flushEntityDecodeBuffer(beatId: string): string {
    const remainder = this.entityDecodeBuffers.get(beatId);
    if (remainder === undefined) {
      return '';
    }

    this.entityDecodeBuffers.delete(beatId);
    if (!remainder) {
      return '';
    }

    return this.decodeHtmlEntities(remainder);
  }

  generateBeatContent(prompt: string, beatId: string, options: {
    wordCount?: number;
    model?: string;
    temperature?: number;
    topP?: number;
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
    beatPosition?: number;
    beatType?: 'story' | 'scene';
    customContext?: {
      selectedScenes: string[];
      includeStoryOutline: boolean;
      selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
    };
    action?: 'generate' | 'rewrite';
    existingText?: string;
  } = {}): Observable<string> {
    const settings = this.settingsService.getSettings();

    let provider: ProviderType | null = null;
    let actualModelId: string | null = null;

    if (options.model) {
      const [modelProvider, ...modelIdParts] = options.model.split(':');
      provider = modelProvider as ProviderType;
      actualModelId = modelIdParts.join(':');
    }

    const useGoogleGemini = provider === 'gemini' && settings.googleGemini.enabled && settings.googleGemini.apiKey;
    const useOpenRouter = provider === 'openrouter' && settings.openRouter.enabled && settings.openRouter.apiKey;
    const useOllama = provider === 'ollama' && settings.ollama.enabled && settings.ollama.baseUrl;
    const useClaude = provider === 'claude' && settings.claude.enabled && settings.claude.apiKey;

    if (!useGoogleGemini && !useOpenRouter && !useOllama && !useClaude) {
      console.warn('No AI API configured, using fallback content');
      return this.generateFallbackContent(prompt, beatId);
    }

    this.isStreamingSubject.next(true);
    this.generationSubject.next({
      beatId,
      chunk: '',
      isComplete: false
    });

    const wordCount = options.wordCount || 400;

    return this.buildStructuredPromptFromTemplate(prompt, beatId, { ...options, wordCount }).pipe(
      switchMap(enhancedPrompt => {
        const calculatedTokens = Math.ceil(wordCount * 2.5);
        const maxTokens = Math.max(calculatedTokens, 3000);
        const resolvedProvider: ProviderType = useOllama
          ? 'ollama'
          : useClaude
            ? 'claude'
            : useGoogleGemini
              ? 'gemini'
              : 'openrouter';
        const requestId = this.createProviderRequestId(resolvedProvider);

        this.activeGenerations.set(beatId, requestId);

        const updatedOptions = { ...options, model: actualModelId || undefined };

        let apiCall: Observable<string>;
        if (resolvedProvider === 'ollama') {
          apiCall = this.callOllamaAPI(enhancedPrompt, updatedOptions, maxTokens, wordCount, requestId, beatId);
        } else if (resolvedProvider === 'claude') {
          apiCall = this.callClaudeStreamingAPI(enhancedPrompt, updatedOptions, maxTokens, wordCount, requestId, beatId);
        } else if (resolvedProvider === 'gemini') {
          apiCall = this.callGoogleGeminiStreamingAPI(enhancedPrompt, updatedOptions, maxTokens, wordCount, requestId, beatId);
        } else {
          apiCall = this.callOpenRouterStreamingAPI(enhancedPrompt, updatedOptions, maxTokens, wordCount, requestId, beatId);
        }

        const guardedApiCall = apiCall.pipe(
          catchError(() => {
            this.pendingVisibilityFallbacks.delete(beatId);
            this.activeGenerations.delete(beatId);
            this.entityDecodeBuffers.delete(beatId);
            if (this.activeGenerations.size === 0) {
              this.isStreamingSubject.next(false);
            }
            this.generationSubject.next({
              beatId,
              chunk: '',
              isComplete: true
            });
            return this.generateFallbackContent(prompt, beatId);
          })
        );

        const resultSubject = new ReplaySubject<string>(1);
        const context: GenerationContext = {
          beatId,
          provider: resolvedProvider,
          prompt: enhancedPrompt,
          options: {
            model: updatedOptions.model,
            temperature: updatedOptions.temperature,
            topP: updatedOptions.topP
          },
          wordCount,
          maxTokens,
          requestId,
          resultSubject,
          fallbackStatus: 'idle'
        };

        this.generationContexts.set(beatId, context);

        const subscription = guardedApiCall.subscribe({
          next: value => {
            context.latestContent = value;
            resultSubject.next(value);
          },
          error: error => {
            resultSubject.error(error);
            this.cleanupContext(beatId);
          },
          complete: () => {
            if (this.pendingVisibilityFallbacks.has(beatId) && context.fallbackStatus !== 'completed') {
              return;
            }
            resultSubject.complete();
            this.cleanupContext(beatId);
          }
        });

        context.streamingSubscription = subscription;

        return new Observable<string>(observer => {
          const subjectSubscription = resultSubject.subscribe(observer);
          return () => {
            subjectSubscription.unsubscribe();
            if (this.generationContexts.has(beatId)) {
              this.stopGeneration(beatId);
            }
          };
        }).pipe(
          finalize(() => {
            // Save to version history after generation completes
            const finalContent = context.latestContent;
            if (finalContent && finalContent.trim().length > 0) {
              // Call saveToHistory asynchronously (don't block)
              this.saveToHistory(beatId, prompt, finalContent, options).catch(error => {
                console.error('[BeatAIService] Error saving to history:', error);
              });
            }
          })
        );
      })
    );
  }

  private callGoogleGeminiStreamingAPI(prompt: string, options: { model?: string; temperature?: number; topP?: number }, maxTokens: number, wordCount: number, requestId: string, beatId: string): Observable<string> {
    // Parse the structured prompt to extract messages
    const messages = this.parseStructuredPrompt(prompt);
    
    let accumulatedContent = '';
    this.entityDecodeBuffers.set(beatId, '');
    return this.googleGeminiApi.generateTextStream(prompt, {
      model: options.model,
      maxTokens: maxTokens,
      wordCount: wordCount,
      requestId: requestId,
      messages: messages
    }).pipe(
      map(chunk => this.decodeStreamingChunk(beatId, chunk)),
      tap((decodedChunk: string) => {
        // Emit each chunk as it arrives
        accumulatedContent += decodedChunk;
        this.generationSubject.next({
          beatId,
          chunk: decodedChunk,
          isComplete: false
        });
      }),
      scan((acc, decodedChunk) => acc + decodedChunk, ''), // Accumulate chunks
      tap({
        complete: () => {
          if (this.pendingVisibilityFallbacks.has(beatId)) {
            return;
          }
          const remainder = this.flushEntityDecodeBuffer(beatId);
          if (remainder) {
            accumulatedContent += remainder;
            this.generationSubject.next({
              beatId,
              chunk: remainder,
              isComplete: false
            });
          }
          // Post-process to remove duplicate character analyses
          accumulatedContent = this.removeDuplicateCharacterAnalyses(accumulatedContent);
          
          // Emit completion
          this.generationSubject.next({
            beatId,
            chunk: '',
            isComplete: true
          });
          
          // Clean up active generation
          this.activeGenerations.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        },
        error: () => {
          // Clean up on error
          this.activeGenerations.delete(beatId);
          this.entityDecodeBuffers.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        }
      }),
      map(() => accumulatedContent), // Return full content at the end
      catchError(() => {
        
        // Try non-streaming API as fallback
        return this.googleGeminiApi.generateText(prompt, {
          model: options.model,
          maxTokens: maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          wordCount: wordCount,
          requestId: requestId,
          messages: messages
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            const rawContent = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const decodedContent = this.decodeHtmlEntities(rawContent);
            accumulatedContent = pending ? pending + decodedContent : decodedContent;
            
            // Simulate streaming by emitting in chunks
            const chunkSize = 50;
            for (let i = 0; i < accumulatedContent.length; i += chunkSize) {
              const chunk = accumulatedContent.substring(i, i + chunkSize);
              this.generationSubject.next({
                beatId,
                chunk: chunk,
                isComplete: false
              });
            }
            
            // Emit completion
            this.generationSubject.next({
              beatId,
              chunk: '',
              isComplete: true
            });
            
            // Clean up
            this.activeGenerations.delete(beatId);
            
            // Signal streaming stopped if no more active generations
            if (this.activeGenerations.size === 0) {
              this.isStreamingSubject.next(false);
            }
            
            return accumulatedContent;
          })
        );
      })
    );
  }

  private callOpenRouterStreamingAPI(prompt: string, options: { model?: string; temperature?: number; topP?: number }, maxTokens: number, wordCount: number, requestId: string, beatId: string): Observable<string> {
    // Parse the structured prompt to extract messages
    const messages = this.parseStructuredPrompt(prompt);

    let accumulatedContent = '';
    this.entityDecodeBuffers.set(beatId, '');
    
    return this.openRouterApi.generateTextStream(prompt, {
      model: options.model,
      maxTokens: maxTokens,
      wordCount: wordCount,
      requestId: requestId,
      messages: messages
    }).pipe(
      map(chunk => this.decodeStreamingChunk(beatId, chunk)),
      tap((decodedChunk: string) => {
        // Emit each chunk as it arrives
        accumulatedContent += decodedChunk;
        this.generationSubject.next({
          beatId,
          chunk: decodedChunk,
          isComplete: false
        });
      }),
      scan((acc, decodedChunk) => acc + decodedChunk, ''), // Accumulate chunks
      tap({
        complete: () => {
          if (this.pendingVisibilityFallbacks.has(beatId)) {
            return;
          }
          const remainder = this.flushEntityDecodeBuffer(beatId);
          if (remainder) {
            accumulatedContent += remainder;
            this.generationSubject.next({
              beatId,
              chunk: remainder,
              isComplete: false
            });
          }
          // Post-process to remove duplicate character analyses
          accumulatedContent = this.removeDuplicateCharacterAnalyses(accumulatedContent);
          
          // Emit completion
          this.generationSubject.next({
            beatId,
            chunk: '',
            isComplete: true
          });
          
          // Clean up active generation
          this.activeGenerations.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        },
        error: () => {
          // Clean up on error
          this.activeGenerations.delete(beatId);
          this.entityDecodeBuffers.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        }
      }),
      map(() => accumulatedContent) // Return full content at the end
    );
  }

  private callOllamaAPI(prompt: string, options: { model?: string; temperature?: number; topP?: number }, maxTokens: number, wordCount: number, requestId: string, beatId: string): Observable<string> {
    // Parse the structured prompt to extract messages
    const messages = this.parseStructuredPrompt(prompt);
    
    let accumulatedContent = '';
    this.entityDecodeBuffers.set(beatId, '');
    
    return this.ollamaApi.generateTextStream(prompt, {
      model: options.model,
      maxTokens: maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      wordCount: wordCount,
      requestId: requestId,
      messages: messages
    }).pipe(
      map(chunk => this.decodeStreamingChunk(beatId, chunk)),
      tap((decodedChunk: string) => {
        // Emit each chunk as it arrives
        accumulatedContent += decodedChunk;
        this.generationSubject.next({
          beatId,
          chunk: decodedChunk,
          isComplete: false
        });
      }),
      scan((acc, decodedChunk) => acc + decodedChunk, ''), // Accumulate chunks
      tap({
        complete: () => {
          if (this.pendingVisibilityFallbacks.has(beatId)) {
            return;
          }
          const remainder = this.flushEntityDecodeBuffer(beatId);
          if (remainder) {
            accumulatedContent += remainder;
            this.generationSubject.next({
              beatId,
              chunk: remainder,
              isComplete: false
            });
          }
          // Post-process to remove duplicate character analyses
          accumulatedContent = this.removeDuplicateCharacterAnalyses(accumulatedContent);
          
          // Emit completion
          this.generationSubject.next({
            beatId,
            chunk: '',
            isComplete: true
          });
          
          // Clean up active generation
          this.activeGenerations.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        },
        error: () => {
          // Clean up on error
          this.activeGenerations.delete(beatId);
          this.entityDecodeBuffers.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        }
      }),
      map(() => accumulatedContent) // Return full content at the end
    );
  }

  private callClaudeStreamingAPI(prompt: string, options: { model?: string; temperature?: number; topP?: number }, maxTokens: number, wordCount: number, requestId: string, beatId: string): Observable<string> {
    // Parse the structured prompt to extract messages
    const messages = this.parseStructuredPrompt(prompt);
    
    let accumulatedContent = '';
    this.entityDecodeBuffers.set(beatId, '');
    
    return this.claudeApi.generateTextStream(prompt, {
      model: options.model,
      maxTokens: maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      wordCount: wordCount,
      requestId: requestId,
      messages: messages
    }).pipe(
      map(chunk => this.decodeStreamingChunk(beatId, chunk)),
      tap((decodedChunk: string) => {
        // Emit each chunk as it arrives
        accumulatedContent += decodedChunk;
        this.generationSubject.next({
          beatId,
          chunk: decodedChunk,
          isComplete: false
        });
      }),
      scan((acc, decodedChunk) => acc + decodedChunk, ''), // Accumulate chunks
      tap({
        complete: () => {
          if (this.pendingVisibilityFallbacks.has(beatId)) {
            return;
          }
          const remainder = this.flushEntityDecodeBuffer(beatId);
          if (remainder) {
            accumulatedContent += remainder;
            this.generationSubject.next({
              beatId,
              chunk: remainder,
              isComplete: false
            });
          }
          // Post-process to remove duplicate character analyses
          accumulatedContent = this.removeDuplicateCharacterAnalyses(accumulatedContent);
          
          // Emit completion
          this.generationSubject.next({
            beatId,
            chunk: '',
            isComplete: true
          });
          
          // Clean up active generation
          this.activeGenerations.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        },
        error: () => {
          // Clean up on error
          this.activeGenerations.delete(beatId);
          this.entityDecodeBuffers.delete(beatId);
          
          // Signal streaming stopped if no more active generations
          if (this.activeGenerations.size === 0) {
            this.isStreamingSubject.next(false);
          }
        }
      }),
      map(() => accumulatedContent), // Return full content at the end
      catchError(() => {
        // Try non-streaming API as fallback
        return this.claudeApi.generateText(prompt, {
          model: options.model,
          maxTokens: maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          wordCount: wordCount,
          requestId: requestId,
          messages: messages
        }).pipe(
          map(response => {
            const pending = this.flushEntityDecodeBuffer(beatId);
            const rawContent = response.content?.[0]?.text || '';
            const decodedContent = this.decodeHtmlEntities(rawContent);
            accumulatedContent = pending ? pending + decodedContent : decodedContent;
            
            // Simulate streaming by emitting in chunks
            const chunkSize = 50;
            for (let i = 0; i < accumulatedContent.length; i += chunkSize) {
              const chunk = accumulatedContent.substring(i, i + chunkSize);
              this.generationSubject.next({
                beatId,
                chunk: chunk,
                isComplete: false
              });
            }
            
            // Emit completion
            this.generationSubject.next({
              beatId,
              chunk: '',
              isComplete: true
            });
            
            // Clean up
            this.activeGenerations.delete(beatId);
            
            // Signal streaming stopped if no more active generations
            if (this.activeGenerations.size === 0) {
              this.isStreamingSubject.next(false);
            }
            
            return accumulatedContent;
          })
        );
      })
    );
  }

  private parseStructuredPrompt(prompt: string): {role: 'system' | 'user' | 'assistant', content: string}[] {
    // Parse XML-like message structure from the template
    const messagePattern = /<message role="(system|user|assistant)">([\s\S]*?)<\/message>/gi;
    const messages: {role: 'system' | 'user' | 'assistant', content: string}[] = [];
    
    let match;
    while ((match = messagePattern.exec(prompt)) !== null) {
      const role = match[1] as 'system' | 'user' | 'assistant';
      const content = match[2].trim();
      messages.push({ role, content });
    }
    
    // If no structured messages found, treat as single user message
    if (messages.length === 0) {
      messages.push({ role: 'user', content: prompt });
    }
    
    return messages;
  }

  // Legacy template - now replaced by story.settings.beatGenerationTemplate

  private buildStructuredPromptFromTemplate(userPrompt: string, beatId: string, options: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
    wordCount?: number;
    beatType?: 'story' | 'scene';
    customContext?: {
      selectedScenes: string[];
      includeStoryOutline: boolean;
      selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
    };
  }): Observable<string> {
    if (!options.storyId) {
      return of(userPrompt);
    }

    return from(this.storyService.getStory(options.storyId)).pipe(
      switchMap((story: Story | null) => {
        if (!story || !story.settings) {
          return of(userPrompt);
        }

        // Set current story in prompt manager
        return from(this.promptManager.setCurrentStory(story.id)).pipe(
          switchMap(async () => {
            // Get codex entries in XML format
            const allCodexEntries = this.codexService.getAllCodexEntries(options.storyId!);
            
            // Get scene context - either from custom context or default behavior
            let sceneContext = '';
            
            if (options.customContext && options.customContext.selectedScenes.length > 0) {
              // Check if we'll be using a modified story outline
              if (options.customContext.includeStoryOutline) {
                // Story outline is included. Check if current scene is selected
                const currentSceneSelected = options.customContext.selectedSceneContexts.some(
                  ctx => ctx.sceneId === options.sceneId
                );
                
                if (currentSceneSelected) {
                  // Current scene is selected and will be included via sceneFullText
                  // Get its content from our selected scenes
                  const currentScene = options.customContext.selectedSceneContexts.find(
                    ctx => ctx.sceneId === options.sceneId
                  );
                  sceneContext = currentScene ? currentScene.content : '';
                } else {
                  // Current scene not explicitly selected, get default content
                  sceneContext = options.sceneId 
                    ? await this.promptManager.getCurrentOrPreviousSceneText(options.sceneId, beatId)
                    : '';
                }
              } else {
                // If no story outline, use custom selected scenes context
                sceneContext = options.customContext.selectedScenes.join('\n\n');
              }
            } else {
              // Default behavior: get current scene text
              sceneContext = options.sceneId 
                ? await this.promptManager.getCurrentOrPreviousSceneText(options.sceneId, beatId)
                : '';
            }
            
            // Convert to relevance service format and filter
            const convertedEntries = this.convertCodexEntriesToRelevanceFormat(allCodexEntries);
            const relevantEntries = await this.codexRelevanceService.getRelevantEntries(
              convertedEntries,
              sceneContext,
              userPrompt,
              1000 // Max tokens for codex
            ).toPromise() || [];
            
            // Convert back to original format for XML generation
            const filteredCodexEntries = this.filterCodexEntriesByRelevance(
              allCodexEntries,
              relevantEntries
            );
            
            // Always include all Notes entries (check multiple possible names)
            const notizenKeywords = ['notizen', 'notes', 'note'];
            const notizenCategory = allCodexEntries.find(cat => 
              notizenKeywords.some(keyword => 
                cat.category.toLowerCase().includes(keyword)
              )
            );
            
            if (notizenCategory && notizenCategory.entries.length > 0) {
              // Check if this category already exists in filtered entries
              const existingNotesIndex = filteredCodexEntries.findIndex(cat => 
                cat.category === notizenCategory.category
              );
              if (existingNotesIndex >= 0) {
                // Replace with full Notes category (ensure all entries are included)
                filteredCodexEntries[existingNotesIndex] = notizenCategory;
              } else {
                // Add full Notes category
                filteredCodexEntries.push(notizenCategory);
              }
            }
        
            // Find protagonist for point of view
            const protagonist = this.findProtagonist(filteredCodexEntries);
            const pointOfView = protagonist 
              ? `<pointOfView type="first person" character="${this.escapeXml(protagonist)}"/>`
              : '';
        
        
        const codexText = filteredCodexEntries.length > 0 
          ? '<codex>\n' + filteredCodexEntries.map(categoryData => {
              const categoryType = this.getCategoryXmlType(categoryData.category);
              
              return categoryData.entries.map((entry: CodexEntry) => {
                let entryXml = `<${categoryType} name="${this.escapeXml(entry.title)}"`;
                
                // Add aliases if present
                if (entry.metadata?.['aliases']) {
                  entryXml += ` aliases="${this.escapeXml(entry.metadata['aliases'])}"`;
                }
                
                // Add story role for characters
                if (entry.metadata?.['storyRole'] && categoryData.category === 'Characters') {
                  entryXml += ` storyRole="${this.escapeXml(entry.metadata['storyRole'])}"`;
                }
                
                entryXml += '>\n';
                
                // Main description
                if (entry.content) {
                  entryXml += `  <description>${this.escapeXml(entry.content)}</description>\n`;
                }
                
                // Custom fields
                const customFields = entry.metadata?.['customFields'] || [];
                if (Array.isArray(customFields)) {
                  customFields.forEach((field: CustomField) => {
                    const fieldName = this.sanitizeXmlTagName(field.name);
                    entryXml += `  <${fieldName}>${this.escapeXml(field.value)}</${fieldName}>\n`;
                  });
                }
                
                // Additional metadata fields
                if (entry.metadata) {
                  Object.entries(entry.metadata)
                    .filter(([key]) => key !== 'storyRole' && key !== 'customFields' && key !== 'aliases')
                    .filter(([, value]) => value !== null && value !== undefined && value !== '')
                    .forEach(([key, value]) => {
                      const tagName = this.sanitizeXmlTagName(key);
                      entryXml += `  <${tagName}>${this.escapeXml(String(value))}</${tagName}>\n`;
                    });
                }
                
                entryXml += `</${categoryType}>`;
                return entryXml;
              }).join('\n');
            }).join('\n') + '\n</codex>'
          : '';


        // Get story so far in XML format
        // Check custom context settings first, then fallback to beatType
        let storySoFar = '';
        if (options.sceneId) {
          if (options.customContext !== undefined) {
            // Use custom context settings
            if (options.customContext.includeStoryOutline) {
              if (options.customContext.selectedSceneContexts.length > 0) {
                // Build modified story outline with selected scenes replaced by their full text
                storySoFar = await this.buildModifiedStoryOutline(
                  options.sceneId, 
                  options.customContext.selectedSceneContexts,
                  story
                );
              } else {
                // No scenes selected, use default story outline
                storySoFar = await this.promptManager.getStoryXmlFormat(options.sceneId);
              }
            } else {
              storySoFar = '';
            }
          } else {
            // Default behavior: For SceneBeat, we get the story without scene summaries
            storySoFar = options.beatType === 'scene' 
              ? await this.promptManager.getStoryXmlFormatWithoutSummaries(options.sceneId)
              : await this.promptManager.getStoryXmlFormat(options.sceneId);
          }
        }

        // Build template placeholders
        const placeholdersRaw = {
          systemMessage: story.settings!.systemMessage,
          codexEntries: codexText,
          storySoFar: storySoFar,
          storyTitle: story.title || 'Story',
          sceneFullText: sceneContext, // Use the sceneContext we built above
          wordCount: (options.wordCount || 200).toString(),
          prompt: userPrompt,
          pointOfView: pointOfView,
          writingStyle: story.settings!.beatInstruction === 'continue' 
            ? 'Continue the story' 
            : 'Stay in the moment'
        } as const;

        // Escape only plain-text placeholders that are injected into XML blocks
        // Keep XML fragments (codexEntries, storySoFar, pointOfView) as-is
        const placeholders: Record<string, string> = {
          systemMessage: this.escapeXml(placeholdersRaw.systemMessage),
          codexEntries: placeholdersRaw.codexEntries,
          storySoFar: placeholdersRaw.storySoFar,
          storyTitle: this.escapeXml(placeholdersRaw.storyTitle),
          sceneFullText: this.escapeXml(placeholdersRaw.sceneFullText),
          wordCount: placeholdersRaw.wordCount,
          prompt: this.escapeXml(placeholdersRaw.prompt),
          pointOfView: placeholdersRaw.pointOfView,
          writingStyle: this.escapeXml(placeholdersRaw.writingStyle)
        };

        // Log the final codex text to debug
        
        // Use template from story settings and replace placeholders
        let processedTemplate = story.settings!.beatGenerationTemplate;
        
        Object.entries(placeholders).forEach(([key, value]) => {
          const placeholder = `{${key}}`;
          const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          processedTemplate = processedTemplate.replace(regex, value || '');
        });

            return processedTemplate;
          })
        );
      }),
      map(result => result)
    );
  }

  private generateFallbackContent(prompt: string, beatId: string): Observable<string> {
    const fallbackContent = this.generateSampleContent(prompt);
    this.entityDecodeBuffers.delete(beatId);
    
    
    // Emit generation complete with fallback
    this.generationSubject.next({
      beatId,
      chunk: fallbackContent,
      isComplete: true
    });
    
    // Signal streaming stopped
    this.isStreamingSubject.next(false);
    
    return of(fallbackContent);
  }

  private generateSampleContent(prompt: string): string {
    // This would be replaced with actual AI API call
    const templates = [
      `Der Protagonist ${this.getRandomName()} betritt den Raum und bemerkt sofort die angespannte Atmosphäre. Die Luft scheint zu knistern vor unausgesprochenen Worten und unterdrückten Emotionen.`,
      
      `Mit einem tiefen Atemzug sammelt ${this.getRandomName()} Mut und tritt vor. Was als einfache Begegnung begann, entwickelt sich schnell zu einem Wendepunkt, der alles verändern wird.`,
      
      `Die Stille wird durchbrochen, als ${this.getRandomName()} endlich die Worte ausspricht, die schon so lange auf der Zunge lagen. Ein Moment der Wahrheit, der keine Rückkehr zulässt.`,
      
      `Plötzlich wird ${this.getRandomName()} klar, dass nichts mehr so sein wird wie zuvor. Die Realität bricht über sie herein wie eine kalte Welle, die alles mit sich reißt.`,
      
      `In diesem entscheidenden Augenblick muss ${this.getRandomName()} eine Wahl treffen. Links oder rechts, vorwärts oder zurück - jede Entscheidung wird Konsequenzen haben.`
    ];
    
    // Simple keyword matching for more relevant content
    const keywords = prompt.toLowerCase();
    if (keywords.includes('konfrontation') || keywords.includes('streit')) {
      return `Der Konflikt eskaliert, als ${this.getRandomName()} nicht länger schweigen kann. Die aufgestauten Emotionen brechen sich Bahn und verwandeln das Gespräch in eine hitzige Auseinandersetzung, bei der keine Seite bereit ist nachzugeben.`;
    } else if (keywords.includes('entdeckung') || keywords.includes('geheimnis')) {
      return `${this.getRandomName()} stößt auf etwas Unerwartetes. Was zunächst wie ein belangloser Fund aussieht, entpuppt sich als Schlüssel zu einem gut gehüteten Geheimnis, das alles in Frage stellt.`;
    } else if (keywords.includes('flucht') || keywords.includes('entkommen')) {
      return `Die Zeit drängt. ${this.getRandomName()} muss schnell handeln, denn die Gelegenheit zur Flucht wird nicht lange bestehen. Jeder Herzschlag zählt, jeder Schritt könnte der letzte sein.`;
    }
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getRandomName(): string {
    const names = ['Sarah', 'Michael', 'Lisa', 'David', 'Anna', 'Thomas', 'Julia', 'Martin', 'Sophie', 'Alex'];
    return names[Math.floor(Math.random() * names.length)];
  }


  createNewBeat(beatType: 'story' | 'scene' = 'story'): BeatAI {
    return {
      id: this.generateId(),
      prompt: '',
      generatedContent: '',
      isGenerating: false,
      isCollapsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      wordCount: 400,
      beatType: beatType,
      includeStoryOutline: true
    };
  }

  private generateId(): string {
    return 'beat-' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Save generated content to version history
   * Called automatically after successful generation
   */
  private async saveToHistory(
    beatId: string,
    prompt: string,
    content: string,
    options: {
      model?: string;
      beatType?: 'story' | 'scene';
      wordCount?: number;
      storyId?: string;
      customContext?: {
        selectedScenes: string[];
        includeStoryOutline: boolean;
        selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
      };
      action?: 'generate' | 'rewrite';
      existingText?: string;
    }
  ): Promise<void> {
    // Don't save if content is empty or fallback
    if (!content || content.trim().length === 0) {
      return;
    }

    // Don't save if storyId is not provided
    if (!options.storyId) {
      console.warn(`[BeatAIService] Cannot save version history without storyId for beat ${beatId}`);
      return;
    }

    try {
      // Extract selected scenes from custom context
      const selectedScenes = options.customContext?.selectedSceneContexts?.map(ctx => ({
        sceneId: ctx.sceneId,
        chapterId: ctx.chapterId
      }));

      const versionId = await this.beatHistoryService.saveVersion(
        beatId,
        options.storyId,
        {
          content,
          prompt,
          model: options.model || 'unknown',
          beatType: options.beatType || 'story',
          wordCount: options.wordCount || 400,
          generatedAt: new Date(),
          characterCount: content.length,
          isCurrent: true,
          selectedScenes,
          includeStoryOutline: options.customContext?.includeStoryOutline,
          action: options.action || 'generate',
          existingText: options.existingText
        }
      );

      console.log(`[BeatAIService] Saved version ${versionId} to history for beat ${beatId}`);
    } catch (error) {
      console.error(`[BeatAIService] Failed to save version history for beat ${beatId}:`, error);
      // Don't throw - history saving failure shouldn't break generation
    }
  }

  // Public method to preview the structured prompt
  previewPrompt(userPrompt: string, beatId: string, options: {
    storyId?: string;
    chapterId?: string;
    sceneId?: string;
    wordCount?: number;
    beatType?: 'story' | 'scene';
    customContext?: {
      selectedScenes: string[];
      includeStoryOutline: boolean;
      selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[];
    };
  }): Observable<string> {
    return this.buildStructuredPromptFromTemplate(userPrompt, beatId, options);
  }

  stopGeneration(beatId: string): void {
    const context = this.generationContexts.get(beatId);
    const requestId = this.activeGenerations.get(beatId) || context?.requestId;

    if (context && requestId) {
      this.abortProviderRequest(context.provider, requestId);
    } else if (requestId) {
      if (requestId.startsWith('gemini_')) {
        this.googleGeminiApi.abortRequest(requestId);
      } else if (requestId.startsWith('claude_')) {
        this.claudeApi.abortRequest(requestId);
      } else if (requestId.startsWith('ollama_')) {
        this.ollamaApi.abortRequest(requestId);
      } else {
        this.openRouterApi.abortRequest(requestId);
      }
    }

    context?.resultSubject.complete();

    this.cleanupContext(beatId);

    this.generationSubject.next({
      beatId,
      chunk: '',
      isComplete: true
    });
  }

  isGenerating(beatId: string): boolean {
    return this.activeGenerations.has(beatId);
  }

  private getCategoryXmlType(category: string): string {
    const mapping: Record<string, string> = {
      'Characters': 'character',
      'Locations': 'location',
      'Objects': 'item',
      'Notes': 'other'
    };
    return mapping[category] || 'other';
  }

  private escapeXml(text: string | unknown): string {
    // Ensure the input is a string
    const str = String(text || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private sanitizeXmlTagName(name: string | unknown): string {
    // Convert to camelCase and remove invalid characters
    const str = String(name || '');
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  private findProtagonist(codexEntries: { category: string; entries: CodexEntry[]; icon?: string }[]): string | null {
    // Look for character entries with storyRole "Protagonist"
    for (const categoryData of codexEntries) {
      if (categoryData.category === 'Characters') {
        for (const entry of categoryData.entries) {
          const storyRole = entry.metadata?.['storyRole'];
          if (storyRole === 'Protagonist') {
            return entry.title;
          }
        }
      }
    }
    return null;
  }

  private convertCodexEntriesToRelevanceFormat(codexEntries: { category: string; entries: CodexEntry[]; icon?: string }[]): CodexRelevanceEntry[] {
    const converted: CodexRelevanceEntry[] = [];
    
    for (const categoryData of codexEntries) {
      const categoryMap: Record<string, 'character' | 'location' | 'object' | 'lore' | 'other'> = {
        'Characters': 'character',
        'Locations': 'location',
        'Objects': 'object',
        'Notes': 'other',
        'Lore': 'lore'
      };
      
      const category = categoryMap[categoryData.category] || 'other';
      
      for (const entry of categoryData.entries) {
        // Extract aliases from metadata
        const aliases: string[] = [];
        if (entry.metadata?.['aliases']) {
          const aliasValue = entry.metadata['aliases'];
          if (typeof aliasValue === 'string' && aliasValue) {
            aliases.push(...aliasValue.split(',').map((a: string) => a.trim()).filter((a: string) => a));
          }
        }
        
        // Extract keywords from tags - these are crucial for relevance matching
        // Create a copy of tags to avoid mutating the original array
        const keywords: string[] = entry.tags ? [...entry.tags] : [];
        
        // Also extract important words from the title as additional keywords
        const titleWords = entry.title.split(/\s+/)
          .filter(word => word.length > 3)
          .map(word => word.toLowerCase());
        keywords.push(...titleWords);
        
        // Determine importance based on story role or category
        let importance: 'major' | 'minor' | 'background' = 'minor';
        if (entry.metadata?.['storyRole']) {
          const role = entry.metadata['storyRole'];
          if (role === 'Protagonist' || role === 'Antagonist') {
            importance = 'major';
          } else if (role === 'Hintergrundcharakter') {
            importance = 'background';
          }
        }
        
        converted.push({
          id: entry.id,
          title: entry.title,
          category: category,
          content: entry.content || '',
          aliases: aliases,
          keywords: keywords,
          importance: importance,
          globalInclude: !!(entry.metadata?.['globalInclude']) || entry.alwaysInclude || false,
          lastMentioned: entry.metadata?.['lastMentioned'] as number | undefined,
          mentionCount: entry.metadata?.['mentionCount'] as number | undefined
        });
      }
    }
    
    return converted;
  }

  private filterCodexEntriesByRelevance(
    allCodexEntries: { category: string; entries: CodexEntry[]; icon?: string }[], 
    relevantEntries: CodexRelevanceEntry[]
  ): { category: string; entries: CodexEntry[]; icon?: string }[] {
    const relevantIds = new Set(relevantEntries.map(e => e.id));
    
    return allCodexEntries.map(categoryData => {
      return {
        ...categoryData,
        entries: categoryData.entries.filter((entry: CodexEntry) => relevantIds.has(entry.id))
      };
    }).filter(categoryData => categoryData.entries.length > 0);
  }

  private removeDuplicateCharacterAnalyses(content: string): string {
    // Pattern to detect character analysis sections
    // Look for patterns like "Character: Name" or "Charakter: Name" or similar variations
    const characterAnalysisPattern = /(?:^|\n)((?:Character|Charakter|Figur|Person)[:\s]+[^\n]+(?:\n(?!(?:Character|Charakter|Figur|Person)[:\s])[^\n]*)*)/gi;
    
    // Find all character analysis sections
    const analyses = new Map<string, string>();
    let match;
    
    while ((match = characterAnalysisPattern.exec(content)) !== null) {
      const fullAnalysis = match[1];
      // Extract character name (first line)
      const firstLine = fullAnalysis.split('\n')[0];
      const characterName = firstLine.replace(/^(?:Character|Charakter|Figur|Person)[:\s]+/i, '').trim();
      
      // Store only the first occurrence of each character analysis
      if (characterName && !analyses.has(characterName.toLowerCase())) {
        analyses.set(characterName.toLowerCase(), match[0]);
      }
    }
    
    // If we found duplicate analyses, rebuild the content without duplicates
    if (analyses.size > 0) {
      let processedContent = content;
      const seenCharacters = new Set<string>();
      
      // Replace all character analyses with markers first
      let markerIndex = 0;
      const markers = new Map<string, string>();
      
      processedContent = content.replace(characterAnalysisPattern, (match, analysis) => {
        const firstLine = analysis.split('\n')[0];
        const characterName = firstLine.replace(/^(?:Character|Charakter|Figur|Person)[:\s]+/i, '').trim().toLowerCase();
        
        if (characterName && !seenCharacters.has(characterName)) {
          seenCharacters.add(characterName);
          const marker = `###CHAR_ANALYSIS_${markerIndex}###`;
          markers.set(marker, match);
          markerIndex++;
          return marker;
        }
        return ''; // Remove duplicate
      });
      
      // Replace markers back with original content
      markers.forEach((original, marker) => {
        processedContent = processedContent.replace(marker, original);
      });
      
      // Clean up any resulting double newlines
      processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
      
      return processedContent.trim();
    }
    
    return content;
  }

  /**
   * Build a modified story outline where selected scenes have their full text instead of summaries
   */
  private async buildModifiedStoryOutline(
    targetSceneId: string, 
    selectedSceneContexts: { sceneId: string; chapterId: string; content: string; }[],
    story: Story
  ): Promise<string> {
    // Create a map of scene IDs to their full content for quick lookup
    const sceneTextMap = new Map<string, string>();
    selectedSceneContexts.forEach(context => {
      sceneTextMap.set(context.sceneId, context.content);
    });

    if (!story || !story.chapters) return '';

    let xml = '<storySoFar>\n';
    
    // Group chapters by acts (for now, all in act 1)
    xml += '  <act number="1">\n';
    
    const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);
    
    for (const chapter of sortedChapters) {
      if (!chapter.scenes || chapter.scenes.length === 0) continue;
      
      xml += `    <chapter title="${this.escapeXml(chapter.title)}" number="${chapter.order}">\n`;
      
      const sortedScenes = [...chapter.scenes].sort((a, b) => a.order - b.order);
      
      for (const scene of sortedScenes) {
        // Stop before the target scene
        if (scene.id === targetSceneId) {
          xml += '    </chapter>\n';
          xml += '  </act>\n';
          xml += '</storySoFar>';
          return xml;
        }
        
        xml += `      <scene title="${this.escapeXml(scene.title)}" number="${scene.order}">`;
        
        // Check if this scene should use full text instead of summary
        if (sceneTextMap.has(scene.id)) {
          // Use the full text from selected scenes
          const fullText = sceneTextMap.get(scene.id)!;
          xml += this.escapeXml(fullText);
        } else {
          // Use summary if available, otherwise use full text from scene
          const content = scene.summary || this.extractFullTextFromScene(scene);
          xml += this.escapeXml(content);
        }
        
        xml += '</scene>\n';
      }
      
      xml += '    </chapter>\n';
    }
    
    xml += '  </act>\n';
    xml += '</storySoFar>';
    
    return xml;
  }

  private extractFullTextFromScene(scene: { content?: string }): string {
    if (!scene.content) return '';

    // Use DOM parser for more reliable HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(scene.content, 'text/html');
    
    // Remove all beat AI wrapper elements and their contents
    const beatWrappers = doc.querySelectorAll('.beat-ai-wrapper, .beat-ai-node');
    beatWrappers.forEach(element => element.remove());
    
    // Remove beat markers and comments
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    
    textNodes.forEach(textNode => {
      // Remove beat markers like [Beat: description]
      textNode.textContent = textNode.textContent?.replace(/\[Beat:[^\]]*\]/g, '') || '';
    });
    
    // Convert to text while preserving paragraph structure
    let cleanText = '';
    const paragraphs = doc.querySelectorAll('p');
    
    for (const p of paragraphs) {
      const text = p.textContent?.trim() || '';
      if (text) {
        cleanText += text + '\n\n';
      } else {
        // Empty paragraph becomes single newline
        cleanText += '\n';
      }
    }
    
    // If no paragraphs found, fall back to body text
    if (!paragraphs.length) {
      cleanText = doc.body.textContent || '';
    }
    
    // Clean up extra whitespace
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanText = cleanText.trim();

    return cleanText;
  }
}
