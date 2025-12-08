import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { SubscriptionService } from './subscription.service';
import { environment } from '../../../environments/environment';

export interface CharacterChatModule {
  CharacterChatService: new (aiService: unknown) => CharacterChatServiceInterface;
}

export interface CharacterChatServiceInterface {
  buildSystemPrompt(character: CharacterInfo, storyContext: StoryContext, knowledgeCutoff?: KnowledgeCutoff): string;
  formatCharacterInfo(character: CharacterInfo): string;
  buildContextWithCutoff(storyContext: StoryContext, cutoff: KnowledgeCutoff): string;
  chat(
    character: CharacterInfo,
    message: string,
    conversationHistory: ChatMessage[],
    storyContext: StoryContext,
    knowledgeCutoff: KnowledgeCutoff | undefined,
    modelId: string
  ): Promise<string>;
  getSuggestedStarters(character: CharacterInfo, language?: string): string[];
}

export interface CharacterInfo {
  name: string;
  description?: string;
  personality?: string;
  background?: string;
  goals?: string;
  relationships?: string;
  notes?: string;
}

export interface StoryContext {
  summary?: string;
  chapters?: ChapterContext[];
}

export interface ChapterContext {
  title: string;
  summary?: string;
  order: number;
  scenes?: SceneContext[];
}

export interface SceneContext {
  title: string;
  summary?: string;
  order: number;
}

export interface KnowledgeCutoff {
  chapterOrder: number;
  sceneOrder?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Beat Rewrite module interfaces
export interface BeatRewriteModule {
  BeatRewriteService: new (aiService: unknown) => BeatRewriteServiceInterface;
}

export interface BeatRewriteServiceInterface {
  buildRewritePrompt(originalText: string, instruction: string, context?: RewriteContext): string;
  rewrite(originalText: string, instruction: string, context: RewriteContext, modelId: string): Promise<string>;
  getSuggestedPrompts(text: string, language?: string): string[];
  analyzeForSuggestions(text: string): string[];
}

export interface RewriteContext {
  storyOutline?: string;
  sceneContext?: string;
  codexEntries?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PremiumModuleService {
  private readonly API_URL = environment.premiumApiUrl;

  private settingsService = inject(SettingsService);
  private subscriptionService = inject(SubscriptionService);

  private characterChatModule$ = new BehaviorSubject<CharacterChatModule | null>(null);
  private beatRewriteModule$ = new BehaviorSubject<BeatRewriteModule | null>(null);
  private isLoading$ = new BehaviorSubject<boolean>(false);
  private loadError$ = new BehaviorSubject<string | null>(null);

  /** Observable for the loaded Character Chat module */
  get characterChatModule(): Observable<CharacterChatModule | null> {
    return this.characterChatModule$.asObservable();
  }

  /** Whether the module is currently loading */
  get isLoading(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  /** Any error that occurred during loading */
  get loadError(): Observable<string | null> {
    return this.loadError$.asObservable();
  }

  /** Check if Character Chat module is loaded */
  get isCharacterChatLoaded(): boolean {
    return this.characterChatModule$.value !== null;
  }

  /** Observable for the loaded Beat Rewrite module */
  get beatRewriteModule(): Observable<BeatRewriteModule | null> {
    return this.beatRewriteModule$.asObservable();
  }

  /** Check if Beat Rewrite module is loaded */
  get isBeatRewriteLoaded(): boolean {
    return this.beatRewriteModule$.value !== null;
  }

  /**
   * Load the Character Chat premium module
   * Only works for verified premium subscribers
   */
  async loadCharacterChatModule(): Promise<CharacterChatModule | null> {
    // Check if already loaded
    if (this.characterChatModule$.value) {
      return this.characterChatModule$.value;
    }

    // Check premium status first
    if (!this.subscriptionService.isPremium) {
      this.loadError$.next('Premium subscription required');
      return null;
    }

    const settings = this.settingsService.getSettings();
    const email = settings.premium?.email;

    if (!email) {
      this.loadError$.next('No subscription email configured');
      return null;
    }

    this.isLoading$.next(true);
    this.loadError$.next(null);

    try {
      const url = `${this.API_URL}/premium/character-chat?email=${encodeURIComponent(email)}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 403) {
          this.loadError$.next('Premium subscription required');
        } else {
          this.loadError$.next(`Failed to load module: ${response.status}`);
        }
        return null;
      }

      const moduleCode = await response.text();

      // Create a blob URL and dynamically import the module
      const blob = new Blob([moduleCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        const module = await import(/* webpackIgnore: true */ blobUrl) as CharacterChatModule;
        this.characterChatModule$.next(module);
        return module;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

    } catch (error) {
      console.error('Failed to load Character Chat module:', error);
      this.loadError$.next('Failed to load premium feature. Please check your connection.');
      return null;

    } finally {
      this.isLoading$.next(false);
    }
  }

  /**
   * Load the Beat Rewrite premium module
   * Only works for verified premium subscribers
   */
  async loadBeatRewriteModule(): Promise<BeatRewriteModule | null> {
    // Check if already loaded
    if (this.beatRewriteModule$.value) {
      return this.beatRewriteModule$.value;
    }

    // Check premium status first
    if (!this.subscriptionService.isPremium) {
      this.loadError$.next('Premium subscription required');
      return null;
    }

    const settings = this.settingsService.getSettings();
    const email = settings.premium?.email;

    if (!email) {
      this.loadError$.next('No subscription email configured');
      return null;
    }

    this.isLoading$.next(true);
    this.loadError$.next(null);

    try {
      const url = `${this.API_URL}/premium/beat-rewrite?email=${encodeURIComponent(email)}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 403) {
          this.loadError$.next('Premium subscription required');
        } else {
          this.loadError$.next(`Failed to load module: ${response.status}`);
        }
        return null;
      }

      const moduleCode = await response.text();

      // Create a blob URL and dynamically import the module
      const blob = new Blob([moduleCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        const module = await import(/* webpackIgnore: true */ blobUrl) as BeatRewriteModule;
        this.beatRewriteModule$.next(module);
        return module;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

    } catch (error) {
      console.error('Failed to load Beat Rewrite module:', error);
      this.loadError$.next('Failed to load premium feature. Please check your connection.');
      return null;

    } finally {
      this.isLoading$.next(false);
    }
  }

  /**
   * Clear the loaded modules (e.g., on logout or subscription expiry)
   */
  clearModule(): void {
    this.characterChatModule$.next(null);
    this.beatRewriteModule$.next(null);
    this.loadError$.next(null);
  }
}
