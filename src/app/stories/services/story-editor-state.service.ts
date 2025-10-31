import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Story, Scene } from '../models/story.interface';
import { StoryService } from './story.service';
import { PromptManagerService } from '../../shared/services/prompt-manager.service';
import { StoryStatsService } from './story-stats.service';

export interface EditorState {
  story: Story | null;
  activeChapterId: string | null;
  activeSceneId: string | null;
  activeScene: Scene | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  wordCount: number;
  lastUserActivityTime: number;
  isStreamingActive: boolean;
}

export interface SaveOptions {
  force?: boolean;
  skipPromptManagerRefresh?: boolean;
}

export interface StoryContext {
  storyId: string;
  chapterId?: string;
  sceneId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StoryEditorStateService {
  private storyService = inject(StoryService);
  private promptManager = inject(PromptManagerService);
  private storyStatsService = inject(StoryStatsService);

  // State subjects
  private stateSubject = new BehaviorSubject<EditorState>({
    story: null,
    activeChapterId: null,
    activeSceneId: null,
    activeScene: null,
    hasUnsavedChanges: false,
    isSaving: false,
    wordCount: 0,
    lastUserActivityTime: Date.now(),
    isStreamingActive: false
  });

  // Derived observables
  state$: Observable<EditorState> = this.stateSubject.asObservable();

  story$: Observable<Story | null> = this.state$.pipe(
    map(state => state.story)
  );

  activeScene$: Observable<Scene | null> = this.state$.pipe(
    map(state => state.activeScene)
  );

  hasUnsavedChanges$: Observable<boolean> = this.state$.pipe(
    map(state => state.hasUnsavedChanges)
  );

  wordCount$: Observable<number> = this.state$.pipe(
    map(state => state.wordCount)
  );

  isSaving$: Observable<boolean> = this.state$.pipe(
    map(state => state.isSaving)
  );

  /**
   * Observable that emits true when it's safe to reload the story
   * (no unsaved changes, no recent activity, not streaming)
   */
  canReloadSafely$: Observable<boolean> = combineLatest([
    this.hasUnsavedChanges$,
    this.state$
  ]).pipe(
    map(([hasUnsaved, state]) => {
      if (hasUnsaved || state.isStreamingActive || state.isSaving) {
        return false;
      }
      // Also check if user was active in the last 5 seconds
      const timeSinceActivity = Date.now() - state.lastUserActivityTime;
      return timeSinceActivity > 5000; // 5 seconds
    })
  );

  // Save operation tracking
  private pendingSave = false;
  private currentSavePromise: Promise<void> | null = null;

  /**
   * Load a story by ID
   */
  async loadStory(storyId: string, preferredChapterId?: string, preferredSceneId?: string): Promise<void> {
    const story = await this.storyService.getStory(storyId);

    if (!story) {
      throw new Error(`Story with ID ${storyId} not found`);
    }

    // Initialize prompt manager with current story
    await this.promptManager.setCurrentStory(story.id);

    let activeChapterId: string | null = null;
    let activeSceneId: string | null = null;
    let activeScene: Scene | null = null;

    // Select requested scene if provided; otherwise last scene
    if (preferredChapterId && preferredSceneId) {
      const ch = story.chapters.find(c => c.id === preferredChapterId);
      const sc = ch?.scenes.find(s => s.id === preferredSceneId);
      if (ch && sc) {
        activeChapterId = ch.id;
        activeSceneId = sc.id;
        activeScene = sc;
      }
    }

    // Fallback to last scene if no scene selected
    if (!activeScene && story.chapters && story.chapters.length > 0) {
      const lastChapter = story.chapters[story.chapters.length - 1];
      if (lastChapter.scenes && lastChapter.scenes.length > 0) {
        const lastScene = lastChapter.scenes[lastChapter.scenes.length - 1];
        activeChapterId = lastChapter.id;
        activeSceneId = lastScene.id;
        activeScene = lastScene;
      }
    }

    // Calculate word count
    const wordCount = this.storyStatsService.calculateTotalStoryWordCount(story);

    // Update state
    this.updateState({
      story,
      activeChapterId,
      activeSceneId,
      activeScene,
      wordCount,
      hasUnsavedChanges: false
    });
  }

  /**
   * Set the active scene
   */
  async setActiveScene(chapterId: string, sceneId: string): Promise<void> {
    const state = this.stateSubject.value;

    if (!state.story) {
      throw new Error('No story loaded');
    }

    const scene = await this.storyService.getScene(state.story.id, chapterId, sceneId);

    if (!scene) {
      throw new Error(`Scene not found: ${chapterId}/${sceneId}`);
    }

    this.updateState({
      activeChapterId: chapterId,
      activeSceneId: sceneId,
      activeScene: scene
    });
  }

  /**
   * Update the current scene content
   */
  updateSceneContent(content: string): void {
    const state = this.stateSubject.value;

    if (!state.activeScene) {
      return;
    }

    // Update the scene content
    state.activeScene.content = content;

    // Recalculate word count
    const wordCount = state.story
      ? this.storyStatsService.calculateTotalStoryWordCount(state.story)
      : 0;

    this.updateState({
      activeScene: { ...state.activeScene },
      hasUnsavedChanges: true,
      wordCount
    });
  }

  /**
   * Update the current scene title
   */
  updateSceneTitle(title: string): void {
    const state = this.stateSubject.value;

    if (!state.activeScene) {
      return;
    }

    state.activeScene.title = title;

    this.updateState({
      activeScene: { ...state.activeScene },
      hasUnsavedChanges: true
    });
  }

  /**
   * Update the story title
   */
  updateStoryTitle(title: string): void {
    const state = this.stateSubject.value;

    if (!state.story) {
      return;
    }

    state.story.title = title;

    this.updateState({
      story: { ...state.story },
      hasUnsavedChanges: true
    });
  }

  /**
   * Save the story (with debounce protection)
   */
  async saveStory(options: SaveOptions = {}): Promise<void> {
    const state = this.stateSubject.value;

    // Prevent concurrent saves unless forced
    if (state.isSaving && !options.force) {
      this.pendingSave = true;
      if (this.currentSavePromise) {
        await this.currentSavePromise;
      }
      return;
    }

    // Skip save if no changes (unless forced)
    if (!state.hasUnsavedChanges && !options.force) {
      return;
    }

    this.updateState({ isSaving: true });

    const saveOperation = (async () => {
      try {
        // Save active scene changes
        if (state.activeScene && state.activeChapterId && state.story) {
          await this.storyService.updateScene(
            state.story.id,
            state.activeChapterId,
            state.activeScene.id,
            {
              title: state.activeScene.title,
              content: state.activeScene.content
            }
          );
        }

        // Save story title if changed
        if (state.story) {
          const currentStory = await this.storyService.getStory(state.story.id);
          if (currentStory && currentStory.title !== state.story.title) {
            await this.storyService.updateStory({
              ...currentStory,
              title: state.story.title,
              updatedAt: new Date()
            });
          }
        }

        this.updateState({ hasUnsavedChanges: false });

        // Refresh prompt manager unless skipped
        if (!options.skipPromptManagerRefresh && state.story) {
          await this.promptManager.setCurrentStory(null);
          await new Promise(resolve => setTimeout(resolve, 50));
          await this.promptManager.setCurrentStory(state.story.id);
        }

      } catch (error) {
        console.error('Error saving story:', error);
        // Re-mark as unsaved so it can be retried
        this.updateState({ hasUnsavedChanges: true });
        throw error;
      } finally {
        this.updateState({ isSaving: false });

        // If there was a pending save request during save, execute it
        if (this.pendingSave) {
          this.pendingSave = false;
          setTimeout(() => this.saveStory(), 100);
        }
      }
    })();

    this.currentSavePromise = saveOperation;

    try {
      await saveOperation;
    } finally {
      if (this.currentSavePromise === saveOperation) {
        this.currentSavePromise = null;
      }
    }
  }

  /**
   * Check if there's a pending save operation
   */
  hasPendingSave(): boolean {
    return this.pendingSave || this.stateSubject.value.isSaving;
  }

  /**
   * Record user activity (typing, clicking, etc.)
   */
  recordUserActivity(): void {
    this.updateState({
      lastUserActivityTime: Date.now()
    });
  }

  /**
   * Get time since last user activity in milliseconds
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.stateSubject.value.lastUserActivityTime;
  }

  /**
   * Reload the story from database (for sync updates)
   */
  async reloadStory(): Promise<void> {
    const state = this.stateSubject.value;

    if (!state.story) {
      return;
    }

    try {
      const updatedStory = await this.storyService.getStory(state.story.id);

      if (!updatedStory) {
        return;
      }

      let newActiveScene: Scene | null = null;
      let newActiveChapterId = state.activeChapterId;
      let newActiveSceneId = state.activeSceneId;

      // Preserve the active scene if it still exists
      if (state.activeChapterId && state.activeSceneId) {
        const chapter = updatedStory.chapters.find(c => c.id === state.activeChapterId);
        const scene = chapter?.scenes.find(s => s.id === state.activeSceneId);

        if (chapter && scene) {
          newActiveScene = scene;
        } else {
          // Scene no longer exists, select the last scene
          if (updatedStory.chapters.length > 0) {
            const lastChapter = updatedStory.chapters[updatedStory.chapters.length - 1];
            if (lastChapter.scenes.length > 0) {
              const lastScene = lastChapter.scenes[lastChapter.scenes.length - 1];
              newActiveChapterId = lastChapter.id;
              newActiveSceneId = lastScene.id;
              newActiveScene = lastScene;
            }
          }
        }
      }

      // Calculate word count
      const wordCount = this.storyStatsService.calculateTotalStoryWordCount(updatedStory);

      // Update state
      this.updateState({
        story: updatedStory,
        activeChapterId: newActiveChapterId,
        activeSceneId: newActiveSceneId,
        activeScene: newActiveScene,
        wordCount
      });

      // Refresh prompt manager
      await this.promptManager.setCurrentStory(updatedStory.id);

    } catch (error) {
      console.error('Error reloading story:', error);
    }
  }

  /**
   * Check if reload should be allowed (no recent activity, no unsaved changes)
   */
  shouldAllowReload(minInactivityMs = 5000): boolean {
    const state = this.stateSubject.value;

    if (state.hasUnsavedChanges || state.isStreamingActive || state.isSaving) {
      return false;
    }

    return this.getTimeSinceLastActivity() > minInactivityMs;
  }

  /**
   * Recalculate word count from current story
   */
  recalculateWordCount(): void {
    const state = this.stateSubject.value;

    if (!state.story) {
      return;
    }

    const wordCount = this.storyStatsService.calculateTotalStoryWordCount(state.story);

    this.updateState({ wordCount });
  }

  /**
   * Set streaming active state (for AI generation)
   */
  setStreamingActive(isActive: boolean): void {
    this.updateState({ isStreamingActive: isActive });
  }

  /**
   * Get current story ID
   */
  getCurrentStoryId(): string | null {
    return this.stateSubject.value.story?.id || null;
  }

  /**
   * Get current chapter ID
   */
  getCurrentChapterId(): string | null {
    return this.stateSubject.value.activeChapterId;
  }

  /**
   * Get current scene ID
   */
  getCurrentSceneId(): string | null {
    return this.stateSubject.value.activeSceneId;
  }

  /**
   * Get current story context for AI operations
   */
  getCurrentContext(): StoryContext | null {
    const state = this.stateSubject.value;

    if (!state.story) {
      return null;
    }

    return {
      storyId: state.story.id,
      chapterId: state.activeChapterId || undefined,
      sceneId: state.activeSceneId || undefined
    };
  }

  /**
   * Get current state snapshot
   */
  getCurrentState(): EditorState {
    return this.stateSubject.value;
  }

  /**
   * Update state with partial update
   */
  private updateState(partialState: Partial<EditorState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      ...partialState
    });
  }
}
