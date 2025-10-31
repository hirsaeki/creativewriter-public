import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Story, Chapter, Scene } from '../models/story.interface';

export interface SceneLocation {
  chapterId: string;
  sceneId: string;
  chapterNumber: number;
  sceneNumber: number;
  chapterTitle: string;
  sceneTitle: string;
}

export interface NavigationState {
  currentLocation: SceneLocation | null;
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalScenes: number;
}

@Injectable({
  providedIn: 'root'
})
export class SceneNavigationService {
  private story: Story | null = null;
  private activeChapterId: string | null = null;
  private activeSceneId: string | null = null;

  private navigationStateSubject = new BehaviorSubject<NavigationState>({
    currentLocation: null,
    hasPrevious: false,
    hasNext: false,
    currentIndex: 0,
    totalScenes: 0
  });

  navigationState$: Observable<NavigationState> = this.navigationStateSubject.asObservable();

  /**
   * Set the current story context
   */
  setStory(story: Story): void {
    this.story = story;
    this.updateNavigationState();
  }

  /**
   * Set the active scene
   */
  setActiveScene(chapterId: string, sceneId: string): void {
    this.activeChapterId = chapterId;
    this.activeSceneId = sceneId;
    this.updateNavigationState();
  }

  /**
   * Check if there is a previous scene
   */
  hasPreviousScene(): boolean {
    return this.getPreviousScene() !== null;
  }

  /**
   * Check if there is a next scene
   */
  hasNextScene(): boolean {
    return this.getNextScene() !== null;
  }

  /**
   * Get the previous scene location
   */
  getPreviousScene(): SceneLocation | null {
    if (!this.story || !this.activeChapterId || !this.activeSceneId) {
      return null;
    }

    let previousScene: { chapter: Chapter; scene: Scene } | null = null;

    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          if (previousScene) {
            return this.createSceneLocation(previousScene.chapter, previousScene.scene);
          }
          return null;
        }
        previousScene = { chapter, scene };
      }
    }

    return null;
  }

  /**
   * Get the next scene location
   */
  getNextScene(): SceneLocation | null {
    if (!this.story || !this.activeChapterId || !this.activeSceneId) {
      return null;
    }

    let foundCurrent = false;

    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        if (foundCurrent) {
          return this.createSceneLocation(chapter, scene);
        }
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          foundCurrent = true;
        }
      }
    }

    return null;
  }

  /**
   * Get the current scene index (1-based)
   */
  getCurrentSceneIndex(): number {
    if (!this.story || !this.activeChapterId || !this.activeSceneId) {
      return 0;
    }

    let index = 0;
    for (const chapter of this.story.chapters) {
      for (const scene of chapter.scenes) {
        index++;
        if (chapter.id === this.activeChapterId && scene.id === this.activeSceneId) {
          return index;
        }
      }
    }

    return 0;
  }

  /**
   * Get the total number of scenes in the story
   */
  getTotalScenes(): number {
    if (!this.story) {
      return 0;
    }
    return this.story.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0);
  }

  /**
   * Get scene ID display string (e.g., "C1S2")
   */
  getSceneIdDisplay(chapterId?: string, sceneId?: string): string {
    if (!this.story) {
      return '';
    }

    const targetChapterId = chapterId || this.activeChapterId;
    const targetSceneId = sceneId || this.activeSceneId;

    if (!targetChapterId || !targetSceneId) {
      return '';
    }

    const chapter = this.story.chapters.find(c => c.id === targetChapterId);
    if (!chapter) {
      return '';
    }

    const scene = chapter.scenes.find(s => s.id === targetSceneId);
    if (!scene) {
      return '';
    }

    const chapterNum = chapter.chapterNumber || chapter.order;
    const sceneNum = scene.sceneNumber || scene.order;

    return `C${chapterNum}S${sceneNum}`;
  }

  /**
   * Get chapter title with number (e.g., "C1:Chapter Title")
   */
  getChapterTitle(chapterId?: string): string {
    if (!this.story) {
      return '';
    }

    const targetChapterId = chapterId || this.activeChapterId;
    if (!targetChapterId) {
      return '';
    }

    const chapter = this.story.chapters.find(c => c.id === targetChapterId);
    if (!chapter) {
      return '';
    }

    const chapterNum = chapter.chapterNumber || chapter.order;
    return `C${chapterNum}:${chapter.title}`;
  }

  /**
   * Get scene title with chapter and scene numbers (e.g., "C1S2:Scene Title")
   */
  getSceneTitle(chapterId?: string, sceneId?: string): string {
    if (!this.story) {
      return '';
    }

    const targetChapterId = chapterId || this.activeChapterId;
    const targetSceneId = sceneId || this.activeSceneId;

    if (!targetChapterId || !targetSceneId) {
      return '';
    }

    const chapter = this.story.chapters.find(c => c.id === targetChapterId);
    if (!chapter) {
      return '';
    }

    const scene = chapter.scenes.find(s => s.id === targetSceneId);
    if (!scene) {
      return '';
    }

    const chapterNum = chapter.chapterNumber || chapter.order;
    const sceneNum = scene.sceneNumber || scene.order;

    return `C${chapterNum}S${sceneNum}:${scene.title}`;
  }

  /**
   * Get the current scene location details
   */
  getCurrentLocation(): SceneLocation | null {
    if (!this.story || !this.activeChapterId || !this.activeSceneId) {
      return null;
    }

    const chapter = this.story.chapters.find(c => c.id === this.activeChapterId);
    if (!chapter) {
      return null;
    }

    const scene = chapter.scenes.find(s => s.id === this.activeSceneId);
    if (!scene) {
      return null;
    }

    return this.createSceneLocation(chapter, scene);
  }

  /**
   * Create a SceneLocation object from chapter and scene
   */
  private createSceneLocation(chapter: Chapter, scene: Scene): SceneLocation {
    return {
      chapterId: chapter.id,
      sceneId: scene.id,
      chapterNumber: chapter.chapterNumber || chapter.order,
      sceneNumber: scene.sceneNumber || scene.order,
      chapterTitle: chapter.title,
      sceneTitle: scene.title
    };
  }

  /**
   * Update the navigation state observable
   */
  private updateNavigationState(): void {
    const state: NavigationState = {
      currentLocation: this.getCurrentLocation(),
      hasPrevious: this.hasPreviousScene(),
      hasNext: this.hasNextScene(),
      currentIndex: this.getCurrentSceneIndex(),
      totalScenes: this.getTotalScenes()
    };

    this.navigationStateSubject.next(state);
  }
}
